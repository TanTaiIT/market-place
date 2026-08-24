import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminPeopleApi } from '@/api/admin-people';
import type { UserFilter } from '@/api/admin-people';
import { qk } from './keys';

/**
 * Bảng người dùng toàn hệ thống (master).
 *
 * Refetch contract — mọi mutation ở đây quét `adminUsersRoot()`: khoá một người hay gỡ án phạt
 * đều đổi hàng đang hiện, mà liệt kê từng key thì sẽ bỏ sót đúng tổ hợp bộ lọc người dùng đang
 * mở. KHÔNG quét `adminRoot()` như bản trước: nó kéo theo cả hàng đợi duyệt tin và ma trận phủ
 * sóng, hai thứ không đổi vì một lượt khoá tài khoản.
 */

export function useAdminUsers(filter: UserFilter = {}) {
  const term = (filter.q ?? '').trim();
  // Gõ tìm là gõ từng ký tự; không hoãn thì mỗi phím là một lượt gọi BE (xem `useAllOrgs`).
  const [settled, setSettled] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const status = filter.status;

  return useQuery({
    queryKey: qk.adminUsers(settled, status ?? 'all'),
    queryFn: () => adminPeopleApi.getUsers({ q: settled, status }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
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

/**
 * Điều chỉnh ví. KHÔNG quét cache nào: BE không có đường đọc ví người khác, nên không tồn tại
 * query nào để làm mới — bằng chứng duy nhất của lượt điều chỉnh là sổ cái phía BE.
 */
export function useAdjustWallet() {
  return useMutation({ mutationFn: adminPeopleApi.adjustWallet });
}
