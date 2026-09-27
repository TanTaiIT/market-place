import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPeopleApi } from '@/api/admin-people';
import type { UserFilter } from '@/api/admin-people';
import { adminApi } from '@/api/admin';
import type { ModStatus } from '@/api/admin';
import { useCategories } from './listings';
import { qk } from './keys';
import { usePagedList } from './paged';

/**
 * Bảng người dùng toàn hệ thống (master).
 *
 * Refetch contract — mọi mutation ở đây quét `adminUsersRoot()`: khoá một người hay gỡ án phạt
 * đều đổi hàng đang hiện, mà liệt kê từng key thì sẽ bỏ sót đúng tổ hợp bộ lọc người dùng đang
 * mở. KHÔNG quét `adminRoot()` như bản trước: nó kéo theo cả hàng đợi duyệt tin và ma trận phủ
 * sóng, hai thứ không đổi vì một lượt khoá tài khoản.
 */

/**
 * @param enabled Tắt khi người xem KHÔNG phải master — `GET /users` là route master-only
 *   (`requireMaster`), nên để nó tự chạy là một lượt 403 mỗi lần màn mount.
 */
export function useAdminUsers(filter: UserFilter = {}, enabled = true) {
  const term = (filter.q ?? '').trim();
  // Gõ tìm là gõ từng ký tự; không hoãn thì mỗi phím là một lượt gọi BE (xem `useAllOrgs`).
  const [settled, setSettled] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const status = filter.status;

  return usePagedList(
    qk.adminUsers(settled, status ?? 'all'),
    (page) => adminPeopleApi.getUsers({ q: settled, status }, page),
    { enabled, keepPrevious: true, staleTime: 60_000 },
  );
}

function usePeopleMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminUsersRoot() }),
  });
}

export function useSetUserLock() {
  return usePeopleMutation(adminPeopleApi.setLock);
}

/**
 * Gỡ án phạt không đổi field nào trên hàng người dùng (bộ đếm từ chối không nằm trong
 * `AdminUser`), nhưng vẫn quét: quota của người đó đổi ngay, và người bấm cần thấy màn hình
 * phản hồi chứ không phải tin lời toast.
 */
export function useClearRejections() {
  return usePeopleMutation(adminPeopleApi.clearRejections);
}

/** Phục hồi bậc đổi thẳng `trustLevel` trên hàng — quét cùng gốc để hàng hiện đúng bậc mới. */
export function useRestoreTrust() {
  return usePeopleMutation(adminPeopleApi.restoreTrust);
}

/** Đặt/gỡ quản chế đổi `probation` trên hàng — cùng gốc quét với các thao tác khác. */
export function useSetProbation() {
  return usePeopleMutation(adminPeopleApi.setProbation);
}

export function useLiftProbation() {
  return usePeopleMutation(adminPeopleApi.liftProbation);
}

/**
 * Điều chỉnh ví. KHÔNG quét cache nào: BE không có đường đọc ví người khác, nên không tồn tại
 * query nào để làm mới — bằng chứng duy nhất của lượt điều chỉnh là sổ cái phía BE.
 */
export function useAdjustWallet() {
  return useMutation({ mutationFn: adminPeopleApi.adjustWallet });
}

/**
 * Mọi tin một người đã đăng, mọi trạng thái bàn duyệt thấy (`GET /moderation/listings?seller=`).
 *
 * KHÔNG gửi `X-Org-Id` dù master đang chọn một nhóm ở bàn quản trị: câu hỏi ở màn này là "người
 * này đã đăng những gì", không phải "trong nhóm đang chọn". Không có header thì scope của master
 * là mọi nhóm + trục công khai.
 */
export function useUserListings(sellerId: string, status?: ModStatus) {
  const { data: categories } = useCategories();
  const names = new Map((categories ?? []).map((c) => [c.id, c.name]));
  return usePagedList(
    qk.adminUserListings(sellerId, status ?? 'all'),
    (page) => adminApi.getListings(undefined, status, names, page, { seller: sellerId }),
    { enabled: !!sellerId, keepPrevious: true },
  );
}
