import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, isMaster } from '@/api/admin';
import type { AdminEvent, ModStatus } from '@/api/admin';
import type { RerouteListing } from '@/api/generated';
import { joinAdminRoom, leaveAdminRoom, onSocketEvent } from '@/api/socket';
import { useIsAuthenticated, useOrgSlug } from '@/stores/auth';
import { qk } from './keys';
import { useCategories } from './listings';

/**
 * Bàn quản trị của MỘT tổ chức — tổ chức đang thao tác, không phải tổ chức trong token.
 *
 * BE v2 lấy org từ header `X-Org-Slug` (`api/http.ts`), nên không hook nào ở đây nhận tham số
 * tổ chức. Hai hệ quả bắt buộc phải xử lý, và cả hai đều nằm ngay dưới:
 *
 * 1. `orgSlug` phải nằm TRONG KEY — nếu không, đổi tổ chức xong vẫn đọc trúng cache của tổ
 *    chức cũ. Master là người duy nhất đổi tổ chức, và cũng là người ít có khả năng nhận ra
 *    con số đang thuộc về nơi khác.
 * 2. `enabled` phải chặn khi chưa chọn tổ chức. Master cố ý không thuộc tổ chức nào nên
 *    `activeOrgSlug` khởi đầu là `null`; không chặn thì mọi màn quản trị bắn request rồi ăn
 *    403 "Chưa xác định được tổ chức" từ `requireOrg`.
 */

/* -------------------------------- queries -------------------------------- */

export function useAdminOverview() {
  const orgSlug = useOrgSlug();
  return useQuery({
    queryKey: qk.adminOverview(orgSlug ?? '-'),
    queryFn: adminApi.getOverview,
    enabled: Boolean(orgSlug),
  });
}

/**
 * Tổng quan trục danh mục. KHÔNG mang `orgSlug` trong key và không `enabled` theo slug: phạm vi
 * tới từ `role_grants` của chính người gọi, đổi tổ chức đang chọn không đổi một dòng số liệu nào.
 */
export function usePublicOverview() {
  return useQuery({
    queryKey: qk.adminPublicOverview(),
    queryFn: adminApi.getPublicOverview,
  });
}
export function useAdminActivity() {
  const orgSlug = useOrgSlug();
  return useQuery({
    queryKey: qk.adminActivity(orgSlug ?? '-'),
    queryFn: adminApi.getEvents,
    enabled: Boolean(orgSlug),
  });
}

/**
 * Quyền hệ thống của chính mình. Cache dài vì nó chỉ đổi khi có người cấp/thu hồi quyền —
 * hiếm, và lúc đó phiên đăng nhập cũng đã cần tải lại.
 */
export function useMyGrants() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: qk.myGrants(),
    queryFn: adminApi.getMyGrants,
    // Khách không có quyền nào, mà nav/`AdminScreen` gọi hook này ở nhiều màn.
    enabled: isAuthenticated,
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
  const orgSlug = useOrgSlug();
  const master = isMaster(useMyGrants().data);
  const { data: categories } = useCategories();

  return useQuery({
    queryKey: qk.adminListings(orgSlug ?? '-', status ?? 'all'),
    queryFn: () =>
      adminApi.getListings(status, new Map((categories ?? []).map((c) => [c.id, c.name]))),
    // `|| master`: BE mở các route ĐỌC này cho master chưa chọn org (`requireOrgReadOrMaster`),
    // nên chặn ở client là tự khoá lại đúng thứ vừa mở.
    enabled: (Boolean(orgSlug) || master) && categories !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useAdminReports() {
  const orgSlug = useOrgSlug();
  const master = isMaster(useMyGrants().data);
  return useQuery({
    queryKey: qk.adminReports(orgSlug ?? '-'),
    queryFn: adminApi.getReports,
    // Cùng lý do với `useAdminListings`: BE đã mở route đọc này cho master chưa chọn org.
    enabled: Boolean(orgSlug) || master,
  });
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
  const orgSlug = useOrgSlug();

  useEffect(() => {
    // Không có tổ chức nào đang chọn thì không có dòng "Vừa diễn ra" nào để đẩy vào.
    if (!orgSlug) return;

    const onActivity = (payload: unknown) => {
      const log = payload as { id?: string; actorName?: string; summary?: string };
      /*
       * `id` nằm trong điều kiện chặn, không phải tuỳ chọn: nó là KHOÁ RENDER của dòng sự
       * kiện. Bản cũ bỏ qua id và ghép khoá từ `time`+`text`, mà mọi dòng realtime đều mang
       * `time: 'vừa xong'` — nên hai lượt duyệt giống nhau là hai khoá trùng khít, và React
       * bỏ bớt dòng mà không báo gì ngoài một cảnh báo trong console.
       */
      if (!log?.id || !log.summary || !log.actorName) return;

      qc.setQueryData<AdminEvent[]>(qk.adminActivity(orgSlug), (old = []) => [
        { id: log.id!, tone: 'info', text: `${log.actorName} · ${log.summary}`, time: 'vừa xong' },
        // Chốt trùng: cùng một sự kiện có thể tới hai lần (nối lại socket, hoặc một lượt
        // refetch chạy xen giữa). Lọc theo id rẻ hơn nhiều so với đi tìm một dòng lặp.
        ...old.filter((e) => e.id !== log.id).slice(0, 19),
      ]);
      // Thẻ số đổi theo mỗi thao tác duyệt — để BE tính lại thay vì đoán ở client.
      qc.invalidateQueries({ queryKey: qk.adminOverview(orgSlug) });
    };

    joinAdminRoom();
    const off = onSocketEvent('admin:activity', onActivity);

    return () => {
      leaveAdminRoom();
      off();
    };
  }, [qc, orgSlug]);
}
