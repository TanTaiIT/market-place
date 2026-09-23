import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminSystemApi, type ReportQuery } from '@/api/admin-system';
import { useOrgId } from '@/stores/auth';
import { qk } from './keys';

/**
 * Nhóm "Hệ thống": cụm từ cấm, catalog gói tin, số liệu định giá. Không mục nào đọc
 * `X-Org-Id` — đổi tổ chức đang chọn không đổi một dòng nào ở đây.
 */

/* ------------------------------- cụm cấm -------------------------------- */

/**
 * `staleTime` dài: danh sách này đổi vài lần mỗi tháng và chỉ đổi bởi chính người đang mở màn.
 * Mọi thay đổi đều đi qua mutation bên dưới nên cache không bao giờ cũ một cách âm thầm.
 */
export function useBannedPhrases() {
  return useQuery({
    queryKey: qk.adminBannedPhrases(),
    queryFn: adminSystemApi.getPhrases,
    staleTime: 5 * 60_000,
  });
}

/**
 * Refetch contract của cả hai mutation cụm cấm: chỉ `adminBannedPhrases()`.
 *
 * Không quét `adminRoot()`: thêm một cụm cấm KHÔNG đổi số liệu nào đang hiện — nó chỉ đổi kết
 * quả của những lượt đăng SAU đó. Bên BE cũng có cache riêng (TTL 60s) và ghi qua service là
 * xoá cache ngay, nên không có gì cho FE phải chờ.
 */
function usePhraseMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminBannedPhrases() }),
  });
}

export function useAddBannedPhrase() {
  return usePhraseMutation(adminSystemApi.addPhrase);
}

export function useRemoveBannedPhrase() {
  return usePhraseMutation(adminSystemApi.removePhrase);
}

/* ------------------------------ gói tin --------------------------------- */

export function useAdminProducts() {
  return useQuery({ queryKey: qk.adminProducts(), queryFn: adminSystemApi.getProducts });
}

/**
 * Refetch contract của ba mutation gói tin: chỉ `adminProducts()`.
 *
 * Catalog CÔNG KHAI (`GET /listings/products`) chưa có query nào bên FE — đường mua Xu thuộc
 * giai đoạn sau. Ngày nó có, key đó phải được thêm vào đây: bật `enabled` một gói mà bảng tin
 * vẫn hiện catalog cũ là lỗi chỉ lộ ra sau khi người dùng bấm mua.
 */
function useProductMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminProducts() }),
  });
}

export function useAddProduct() {
  return useProductMutation(adminSystemApi.addProduct);
}

export function useEditProduct() {
  return useProductMutation(adminSystemApi.editProduct);
}

export function useRemoveProduct() {
  return useProductMutation(adminSystemApi.removeProduct);
}

/* ---------------------------- số liệu định giá --------------------------- */

/**
 * Thống kê nặng (quét tin theo cửa sổ ngày) và không ai cần nó tươi từng phút — đây là dữ liệu
 * để CHỐT một cái giá, việc làm vài lần mỗi quý.
 */
/**
 * Báo cáo đăng tin theo thời gian.
 *
 * `staleTime` 5 phút: dữ liệu chỉ đổi khi có người đăng tin mới, mà một báo cáo xu hướng
 * không cần tươi tới từng giây — đổi độ mịn qua lại sẽ đọc cache thay vì bắn lại một aggregate
 * quét cả bảng.
 */
export function useListingReport(query: ReportQuery, enabled = true) {
  // BE scope theo `X-Org-Id` mà `http.ts` gắn sẵn: có org là bản của nhóm, không có là toàn sàn.
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.adminListingReport(orgId ?? '-', query.granularity, query.from, query.to),
    queryFn: () => adminSystemApi.getListingReport(query),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/**
 * Báo cáo người dùng — báo cáo con thứ hai.
 *
 * `enabled` có mặt vì màn Thống kê gọi CẢ HAI hook (quy tắc hook: không gọi có điều kiện)
 * nhưng chỉ một tab đang mở. Thiếu cờ này thì mỗi lần đổi độ mịn là hai aggregate quét cả bảng
 * chạy song song, một trong hai không ai nhìn.
 */
export function useUserReport(query: ReportQuery, enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.adminUserReport(orgId ?? '-', query.granularity, query.from, query.to),
    queryFn: () => adminSystemApi.getUserReport(query),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function usePostingStats(days: number) {
  return useQuery({
    queryKey: qk.adminPostingStats(days),
    queryFn: () => adminSystemApi.getPostingStats(days),
    staleTime: 10 * 60_000,
  });
}
