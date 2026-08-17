import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api/org';
import type { JoinRequestStatus } from '@/api/org';
import { useOrgSlug } from '@/stores/auth';
import { canModerateOrg } from '@/api/admin';
import { useMyGrants } from './admin';
import { qk } from './keys';

/** Dưới ngưỡng này BE trả 400 — gọi rồi mới biết là phí một vòng và một dòng lỗi vô nghĩa. */
const MIN_LOOKUP_CHARS = 2;

/**
 * Tra cứu tổ chức cho dropdown.
 *
 * `enabled` chứ không phải `if` ở call-site: hook luôn được gọi, còn TanStack quyết định có
 * bay hay không (query.convention §3). `staleTime` dài vì danh sách tổ chức gần như tĩnh, và
 * mỗi lần gõ lại là một request tới một endpoint có rate limit chặt.
 */
export function useOrgLookup(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.orgLookup(term),
    queryFn: () => orgApi.lookup(term),
    enabled: term.length >= MIN_LOOKUP_CHARS,
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
 * Danh bạ thành viên của tổ chức, dựng từ đơn ĐÃ DUYỆT.
 *
 * BE chưa có route liệt kê thành viên, mà cả `createRoleGrant` lẫn `updateOrgUnit` đều cần
 * `userId` — đơn đã duyệt là nguồn duy nhất trong app ghép được `userId` với một cái tên đọc
 * được. Hệ quả phải nói ra ở màn hình: ai vào tổ chức bằng đường khác (người chủ do master chỉ
 * định lúc tạo tổ chức) sẽ KHÔNG có trong danh bạ này.
 *
 * Gộp theo `userId` chứ không theo `id` của đơn: một người bị từ chối rồi nộp lại và được duyệt
 * sẽ có hai đơn, mà danh bạ thì phải hiện đúng một dòng.
 */
export function useOrgRoster() {
  const queue = useJoinRequestQueue('approved');
  const rows = queue.data;
  const members = useMemo(
    () => Array.from(new Map((rows ?? []).map((r) => [r.userId, r])).values()),
    [rows],
  );
  return { ...queue, members };
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
 * tab + "đơn của tôi" của chính người duyệt nếu họ cũng đang có đơn ở đâu đó) và `adminRoot()`
 * — duyệt một đơn là thêm một thành viên, mà số thành viên nằm trên thẻ tổng quan.
 */
function useJoinRequestMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() });
      qc.invalidateQueries({ queryKey: qk.adminRoot() });
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
