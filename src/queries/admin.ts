import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import type { ModStatus, SchoolFilter } from '@/api/admin';
import { qk } from './keys';

/**
 * Hook cho bàn quản trị. Dữ liệu còn là fixture in-memory (`@/api/admin`), nhưng vẫn đi qua
 * TanStack như mọi domain khác — đổi sang HTTP thật sau này chỉ phải sửa `adminApi`.
 */

/* -------------------------------- queries -------------------------------- */

export function useAdminOverview(school: SchoolFilter) {
  return useQuery({
    queryKey: qk.adminOverview(school),
    queryFn: () => adminApi.getOverview(school),
    // Đổi bộ lọc trường không được để cả màn nháy trắng rồi dựng lại bốn thẻ số.
    placeholderData: keepPreviousData,
  });
}

/** Hàng đợi của bàn duyệt — chỉ tin `pending`. */
export function useModerationQueue(school: SchoolFilter) {
  return useQuery({
    queryKey: qk.adminListings(school, 'pending'),
    queryFn: () => adminApi.getListings({ school, status: 'pending' }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminListings(filter: { school: SchoolFilter; status: ModStatus | 'all' }) {
  return useQuery({
    queryKey: qk.adminListings(filter.school, filter.status),
    queryFn: () => adminApi.getListings(filter),
    placeholderData: keepPreviousData,
  });
}

export function useAdminReports() {
  return useQuery({ queryKey: qk.adminReports(), queryFn: adminApi.getReports });
}

/* ------------------------------- mutations ------------------------------- */

/**
 * Refetch contract — cả ba mutation dưới đây đều invalidate `qk.adminRoot()`:
 * một lần duyệt đổi cùng lúc hàng đợi, bảng tin (mọi tổ hợp bộ lọc) và thẻ số ở tổng quan.
 * Liệt kê từng key sẽ bỏ sót đúng cái tổ hợp mà người dùng đang mở.
 *
 * Cố tình **không** optimistic: bàn duyệt đã có animation bay ra ngay khi bấm, nên người dùng
 * không chờ; thêm `onMutate` chỉ để ghi đè cache rồi rollback là rủi ro không đổi lại được gì.
 */
export function useSetListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; status: ModStatus; reason?: string }) =>
      adminApi.setStatus(v.id, v.status, v.reason),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useRemoveModListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.remove(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; hideTarget: boolean }) =>
      adminApi.resolveReport(v.id, v.hideTarget),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}
