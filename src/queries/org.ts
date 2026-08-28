import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api/org';
import type { JoinRequestStatus } from '@/api/org';
import { useEffect } from 'react';
import { useIsAuthenticated, useOrgSlug, useSetActiveOrg } from '@/stores/auth';
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
/**
 * Các tổ chức mình LÀ THÀNH VIÊN.
 *
 * Kèm một tác dụng phụ có chủ ý: **thuộc đúng MỘT tổ chức thì tự chọn nó**.
 *
 * BE vốn tự suy ra org trong ca đó (`tenant.middleware`) nên request vẫn chạy đúng — nhưng
 * phía client thì `activeOrgSlug` vẫn là `null`, và đó là một trạng thái ngầm đã đẻ ra một
 * chuỗi lỗi cùng kiểu: khoá cache tính bằng `slug ?? '-'`, cổng `enabled: Boolean(slug)` tắt
 * mọi query của bàn quản trị, và các phép tra `find(o => o.slug === slug)` không khớp ai.
 * Mỗi chỗ lại phải tự nhớ luật "một nhóm thì suy ra" — và đã quên ở bốn chỗ khác nhau.
 *
 * Ghi thẳng vào store là biến luật ngầm thành một giá trị có thật. Từ đó `X-Org-Slug` được
 * gửi TƯỜNG MINH, và mọi chỗ đọc `useOrgSlug()` đều nhận đúng một câu trả lời.
 *
 * Chỉ ghi khi CHƯA có lựa chọn nào: người đã tự chọn (hoặc master mượn slug nhóm khác) thì
 * không bị ghi đè. Có từ hai nhóm trở lên thì im lặng — lúc đó phải để họ chọn.
 */
export function useMyOrgs() {
  const isAuthenticated = useIsAuthenticated();
  const query = useQuery({
    queryKey: qk.myOrgs(),
    queryFn: orgApi.myOrgs,
    // Khách chưa đăng nhập không thuộc tổ chức nào — hỏi BE là một cú 401 mỗi lần mở app.
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const activeSlug = useOrgSlug();
  const setActiveOrg = useSetActiveOrg();
  const only = query.data?.length === 1 ? query.data[0].slug : undefined;

  useEffect(() => {
    if (!activeSlug && only) setActiveOrg(only);
  }, [activeSlug, only, setActiveOrg]);

  return query;
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
