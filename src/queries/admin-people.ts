import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminPeopleApi } from '@/api/admin-people';
import { qk } from './keys';

/**
 * Nhóm "Cộng đồng" của bàn quản trị.
 *
 * Refetch contract — mọi mutation ở đây invalidate `qk.adminRoot()`: xác thực hay khoá một
 * người đều đổi cả bảng người dùng lẫn các mục đếm ở tổng quan, mà liệt kê từng key thì sẽ
 * bỏ sót đúng tổ hợp bộ lọc trường mà người dùng đang mở.
 */

export function useAdminUsers(school: string) {
  return useQuery({
    queryKey: qk.adminUsers(school),
    queryFn: () => adminPeopleApi.getUsers(school),
    placeholderData: keepPreviousData,
  });
}

export function useAdminSchools() {
  return useQuery({ queryKey: qk.adminSchools(), queryFn: adminPeopleApi.getSchools });
}

export function useSchoolLinks() {
  return useQuery({ queryKey: qk.adminSchoolLinks(), queryFn: adminPeopleApi.getSchoolLinks });
}

export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminPeopleApi.verifyUser(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useToggleUserLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminPeopleApi.toggleLock(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useToggleSchoolLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPeopleApi.toggleSchoolLink(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminSchoolLinks() }),
  });
}
