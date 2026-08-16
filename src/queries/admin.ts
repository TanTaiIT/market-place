import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import type { AdminEvent, ModStatus } from '@/api/admin';
import type { RerouteListing } from '@/api/generated';
import { joinAdminRoom, leaveAdminRoom, onSocketEvent } from '@/api/socket';
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
 * Quyền hệ thống của chính mình. Cache dài vì nó chỉ đổi khi có người cấp/thu hồi quyền —
 * hiếm, và lúc đó phiên đăng nhập cũng đã cần tải lại.
 */
export function useMyGrants() {
  return useQuery({
    queryKey: qk.myGrants(),
    queryFn: adminApi.getMyGrants,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hàng đợi trục danh mục. Phạm vi do BE quyết định từ `role_grants` của người gọi — client
 * không gửi danh mục/tỉnh nào cả, nên không có đường xem rộng hơn phần mình được cấp.
 */
export function usePublicQueue(status?: ModStatus) {
  const { data: categories } = useCategories();

  return useQuery({
    queryKey: qk.adminPublicQueue(status ?? 'all'),
    queryFn: () =>
      adminApi.getPublicQueue(status, new Map((categories ?? []).map((c) => [c.id, c.name]))),
    enabled: categories !== undefined,
    placeholderData: keepPreviousData,
  });
}

/** Ma trận phủ sóng của master — chỉ các ô chưa có người phụ trách hoặc đang tồn đọng. */
export function useCoverage() {
  return useQuery({ queryKey: qk.adminCoverage(), queryFn: adminApi.getCoverage });
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

/**
 * Chuyển tin sang ô (danh mục × tỉnh) khác — quyền của master.
 *
 * Refetch contract: cùng `adminRoot()` như các mutation trên, cộng thêm `adminCoverage()` nằm
 * sẵn trong prefix đó — chuyển một tin ra khỏi ô tồn đọng làm đổi luôn con số của ma trận phủ
 * sóng, nên hai màn không được rời nhau.
 */
export function useRerouteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & RerouteListing) =>
      adminApi.rerouteListing(v.id, { categoryId: v.categoryId, provinceCode: v.provinceCode }),
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
 *
 * Không chạm tới instance socket: `socket.ts` giữ nguyện vọng và dựng lại sau mỗi lần nối lại,
 * nên bàn quản trị mở lâu không bị chết realtime sau một lần app xuống background.
 */
export function useAdminActivityStream(): void {
  const qc = useQueryClient();

  useEffect(() => {
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

    joinAdminRoom();
    const off = onSocketEvent('admin:activity', onActivity);

    return () => {
      leaveAdminRoom();
      off();
    };
  }, [qc]);
}
