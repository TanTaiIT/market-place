import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api/org';
import type { JoinRequestStatus } from '@/api/org';
import { useOrgSlug } from '@/stores/auth';
import { canModerateOrg } from '@/api/admin';
import { useMyGrants } from './admin';
import { qk } from './keys';

/** Độ dài tối thiểu của mã tham gia theo schema BE — gõ ngắn hơn thì chắc chắn 400. */
const MIN_CODE_CHARS = 4;

/**
 * Xem trước tổ chức đứng sau một mã tham gia.
 *
 * `enabled` chứ không phải `if` ở call-site: hook luôn được gọi, còn TanStack quyết định có
 * bay hay không (query.convention §3). `retry: false` vì mã sai trả 404 — thử lại ba lần một
 * mã không tồn tại chỉ làm người đang gõ dở thấy màn hình treo.
 */
export function useOrgByCode(code: string) {
  const trimmed = code.trim();
  return useQuery({
    queryKey: qk.orgByCode(trimmed),
    queryFn: () => orgApi.byCode(trimmed),
    enabled: trimmed.length >= MIN_CODE_CHARS,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Danh sách tổ chức của tôi. Đổi rất ít nên giữ cache lâu, tránh gọi lại mỗi lần mở màn. */
export function useMyOrgs() {
  return useQuery({
    queryKey: qk.myOrgs(),
    queryFn: orgApi.myOrgs,
    staleTime: 5 * 60_000,
  });
}

export function useMyJoinRequests() {
  return useQuery({
    queryKey: qk.myJoinRequests(),
    queryFn: orgApi.myRequests,
  });
}

export function useRequestJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgApi.requestJoin,
    // Không optimistic: đơn chỉ hợp lệ sau khi BE soi đủ ba chốt (đã là thành viên chưa, còn
    // trần đơn chờ không, hết cooldown chưa). Vẽ trước một dòng "đang chờ" rồi phải rút lại
    // khi BE từ chối là nói dối người dùng ngay ở bước họ cần chắc chắn nhất.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() });
      qc.invalidateQueries({ queryKey: qk.myOrgs() });
      // Hồ sơ nhóm mang cờ `joined` và số thành viên — gửi đơn xong mà không quét thì nút
      // vẫn mời người ta vào lại đúng nhóm họ vừa xin.
      qc.invalidateQueries({ queryKey: ['orgs', 'profile'] });
    },
  });
}

export function useCancelJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgApi.cancelRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() }),
  });
}

/* ------------------------ phía người duyệt ------------------------ */

/**
 * Hàng đợi đơn của tổ chức ĐANG HOẠT ĐỘNG.
 *
 * Không có tham số org: BE lấy từ `X-Org-Slug` mà `http.ts` gắn sẵn. Vì thế key phải chứa
 * `activeOrgSlug` — thiếu nó thì đổi tổ chức xong vẫn thấy hàng đợi của tổ chức cũ trong cache.
 */
export function useJoinRequestQueue(status?: JoinRequestStatus) {
  const orgSlug = useOrgSlug();
  const { data: grants } = useMyGrants();

  return useQuery({
    queryKey: qk.joinRequestQueue(orgSlug ?? '-', status ?? 'all'),
    queryFn: () => orgApi.joinRequests(status),
    // Chặn bằng grant chứ không chỉ bằng org: `AdminNav` gọi hook này để lấy con số badge cho
    // MỌI người mở ngăn kéo, mà manager danh mục (grant `category_province`) tuy là thành viên
    // org vẫn ăn 403 ở endpoint này — một request hỏng mỗi lần mở ngăn kéo.
    enabled: Boolean(orgSlug) && canModerateOrg(grants),
    placeholderData: keepPreviousData,
  });
}

/** Nhóm con để duyệt kèm xếp nhóm. Đổi rất ít nên cache lâu, cùng lý do với `useMyOrgs`. */
export function useOrgUnits() {
  const orgSlug = useOrgSlug();
  return useQuery({
    queryKey: qk.orgUnits(orgSlug ?? '-'),
    queryFn: orgApi.orgUnits,
    enabled: Boolean(orgSlug),
    staleTime: 5 * 60_000,
  });
}

/**
 * Danh bạ thành viên của tổ chức — nguồn là `GET /memberships`.
 *
 * Bản trước suy roster từ đơn gia nhập đã duyệt vì BE chưa có route; cách đó bỏ sót đúng những
 * người không đi qua đơn (chủ tổ chức do master chỉ định, người thêm thẳng vào roster) và giữ
 * lại người đã rời tổ chức, vì đơn approved không bao giờ bị xoá.
 *
 * `enabled` chặn bằng GRANT chứ không chỉ bằng org, cùng lý do với `useJoinRequestQueue`:
 * endpoint đòi quyền quản trị, thành viên thường gọi vào chỉ nhận 403.
 */
export function useOrgRoster() {
  const orgSlug = useOrgSlug();
  const { data: grants } = useMyGrants();

  const query = useQuery({
    queryKey: qk.orgMembers(orgSlug ?? '-'),
    queryFn: orgApi.members,
    enabled: Boolean(orgSlug) && canModerateOrg(grants),
    staleTime: 5 * 60_000,
  });

  return { ...query, members: query.data ?? [] };
}

/**
 * Refetch contract của ba mutation nhóm con: invalidate đúng key nhóm con của tổ chức đang hoạt
 * động. Không quét `['orgs']`: `myOrgs` và `orgLookup` cũng nằm dưới prefix đó và không hề lệch
 * khi thêm một nhóm.
 */
function useOrgUnitMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  const orgSlug = useOrgSlug();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgUnits(orgSlug ?? '-') }),
  });
}

export function useCreateOrgUnit() {
  return useOrgUnitMutation(orgApi.createUnit);
}

export function useUpdateOrgUnit() {
  return useOrgUnitMutation(orgApi.updateUnit);
}

export function useDeleteOrgUnit() {
  return useOrgUnitMutation(orgApi.deleteUnit);
}

/**
 * Refetch contract của cả ba mutation dưới đây: invalidate `joinRequestsRoot()` (hàng đợi mọi
 * tab + "đơn của tôi" của chính người duyệt nếu họ cũng đang có đơn ở đâu đó), `adminRoot()`
 * — duyệt một đơn là thêm một thành viên, mà số thành viên nằm trên thẻ tổng quan — và
 * `orgMembers()`: người vừa được duyệt phải xuất hiện ngay trong danh bạ, vì hai ô "chọn
 * người phụ trách" và "cấp quyền" đọc thẳng từ đó.
 */
function useJoinRequestMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  const orgSlug = useOrgSlug();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() });
      qc.invalidateQueries({ queryKey: qk.adminRoot() });
      qc.invalidateQueries({ queryKey: qk.orgMembers(orgSlug ?? '-') });
    },
  });
}

export function useApproveJoinRequest() {
  return useJoinRequestMutation((v: { id: string; unitId?: string | null }) =>
    orgApi.approveRequest(v.id, v.unitId),
  );
}

export function useRejectJoinRequest() {
  return useJoinRequestMutation((v: { id: string; reason?: string }) =>
    orgApi.rejectRequest(v.id, v.reason),
  );
}

export function useBulkApproveJoinRequests() {
  return useJoinRequestMutation((v: { ids: string[]; unitId?: string | null }) =>
    orgApi.bulkApprove(v.ids, v.unitId),
  );
}
