import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import type { AdminEvent, ModStatus } from '@/api/admin';
import { getSocket } from '@/api/socket';
import { qk } from './keys';
import { useCategories } from './listings';

/**
 * Bàn quản trị của một trường. BE scope theo organization trong JWT nên không hook nào ở đây
 * nhận tham số trường — quản trị đăng nhập bằng tài khoản trường nào thì thấy trường đó.
 */

/* -------------------------------- queries -------------------------------- */

export function useAdminOverview() {
  return useQuery({ queryKey: qk.adminOverview(), queryFn: adminApi.getOverview });
}

export function useAdminActivity() {
  return useQuery({ queryKey: qk.adminActivity(), queryFn: adminApi.getEvents });
}

/**
 * Tin cho bàn duyệt. Tên danh mục lấy từ `useCategories` (đã cache 30 phút) rồi truyền xuống,
 * để mỗi lần đổi tab không kéo thêm một lượt `/categories`.
 */
export function useAdminListings(status?: ModStatus) {
  const { data: categories } = useCategories();

  return useQuery({
    queryKey: qk.adminListings(status ?? 'all'),
    queryFn: () =>
      adminApi.getListings(status, new Map((categories ?? []).map((c) => [c.id, c.name]))),
    enabled: categories !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useAdminReports() {
  return useQuery({ queryKey: qk.adminReports(), queryFn: adminApi.getReports });
}

/* ------------------------------- mutations ------------------------------- */

/**
 * Refetch contract — cả ba mutation invalidate `qk.adminRoot()`: một lượt duyệt đổi cùng lúc
 * hàng đợi, bảng tin (mọi tab), thẻ số ở tổng quan và dòng hoạt động. Liệt kê từng key sẽ bỏ
 * sót đúng cái tab người dùng đang mở.
 */
export function useSetListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: ModStatus; reason?: string }) =>
      adminApi.setStatus(v.id, v.status, v.reason),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useRemoveModListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.remove(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; hideTarget: boolean }) =>
      adminApi.resolveReport(v.id, v.hideTarget),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

/* -------------------------------- realtime -------------------------------- */

/**
 * Vào phòng quản trị và đẩy sự kiện mới lên đầu dòng "Vừa diễn ra".
 *
 * BE chặn ở `admin:join` bằng role trong JWT, nên thành viên thường có emit thẳng cũng không
 * vào được — `canOpenAdmin` phía app chỉ là cửa giao diện.
 */
export function useAdminActivityStream(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onActivity = (payload: unknown) => {
      const log = payload as { actorName?: string; summary?: string; createdAt?: string };
      if (!log?.summary || !log.actorName) return;

      qc.setQueryData<AdminEvent[]>(qk.adminActivity(), (old = []) => [
        { tone: 'info', text: `${log.actorName} · ${log.summary}`, time: 'vừa xong' },
        ...old.slice(0, 19),
      ]);
      // Thẻ số đổi theo mỗi thao tác duyệt — để BE tính lại thay vì đoán ở client.
      qc.invalidateQueries({ queryKey: qk.adminOverview() });
    };

    socket.emit('admin:join');
    socket.on('admin:activity', onActivity);
    return () => {
      socket.off('admin:activity', onActivity);
    };
  }, [qc]);
}
