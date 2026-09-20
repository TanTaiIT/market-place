import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminContentApi } from '@/api/admin-content';
import { useAdminOrgId } from '@/components/AdminOrgScope';
import { NO_ORG, qk } from './keys';
import { usePagedList } from './paged';

/**
 * Nhóm "Nội dung": danh mục và thông báo đẩy.
 */

/* -------------------------------- danh mục -------------------------------- */

/** Từ điển toàn hệ thống, gồm cả danh mục đã tắt — không có tham số trường để lọc. */
export function useAdminCategories() {
  return useQuery({ queryKey: qk.adminCategories(), queryFn: adminContentApi.getCategories });
}

/**
 * Refetch contract của cả hai mutation danh mục: quét `adminCategories()` (bảng đang sửa) VÀ
 * `categories()` — hàng chip trên bảng tin của học sinh đọc từ điển đó, đổi tên hay tắt một
 * danh mục mà không quét là chip cũ còn nằm đấy tới hết `staleTime` 30 phút.
 *
 * `adminRoot()` thì không: phân bố danh mục ở màn tổng quan đếm theo TIN, mà thêm một danh mục
 * rỗng không làm lệch con số nào.
 */
function useCategoryMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminCategories() });
      qc.invalidateQueries({ queryKey: qk.categories() });
    },
  });
}

export function useAddCategory() {
  return useCategoryMutation(adminContentApi.addCategory);
}

export function useEditCategory() {
  return useCategoryMutation(adminContentApi.editCategory);
}

/* ------------------------------- thông báo ------------------------------- */

export function useSentNotices() {
  const orgId = useAdminOrgId();
  return usePagedList(
    qk.adminNotices(orgId ?? NO_ORG),
    // `orgId!`: `enabled` ngay dưới đã chặn ca rỗng.
    (page) => adminContentApi.getNotices(orgId!, page),
    {
      // `scope=managed` đọc theo MỘT nhóm — chưa chọn thì không có gì để hỏi.
      enabled: Boolean(orgId),
    },
  );
}

export function useSendNotice() {
  const qc = useQueryClient();
  const orgId = useAdminOrgId();
  return useMutation({
    mutationFn: (input: { title: string; body: string; unitId: string | null }) => {
      // `POST /notifications` là `requireOrg`; ném tại chỗ thay vì đi một vòng mạng lấy 403.
      if (!orgId) throw new Error('Chưa chọn nhóm nào');
      return adminContentApi.sendNotice(orgId, input);
    },
    // Quét cả `notifications()`: người gửi cũng là người nhận, thông báo vừa gửi phải xuất
    // hiện ở tab Thông báo của chính họ chứ không phải chờ tới lần mở app sau.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.adminNoticesRoot() });
      qc.invalidateQueries({ queryKey: qk.notifications() });
    },
  });
}

