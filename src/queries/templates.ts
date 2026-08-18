import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from './keys';

/**
 * Template thuộc tính của một danh mục — nguồn của mọi field động trong form đăng/sửa tin.
 *
 * File riêng thay vì nhét vào `listings.ts`: file đó đã 194/200 dòng, chạm trần LOC của một
 * query module (AGENTS §11).
 */

/** Danh mục gần như không đổi, template lại càng ít — mỗi lần đổi chip mà gọi lại là lãng phí. */
const TEMPLATE_STALE_MS = 30 * 60 * 1000;

/**
 * `categoryId` rỗng = người dùng chưa chọn danh mục → chưa có gì để hỏi.
 *
 * `enabled` là bắt buộc (AGENTS §5): thiếu nó thì form đăng tin bắn một request `/categories//template`
 * ngay lúc mount, nhận 400, và ô báo lỗi hiện lên trước khi người dùng kịp chạm vào màn hình.
 *
 * `version` chỉ dành cho form SỬA TIN (`listing.templateVersion`) — dựng lại đúng bộ field lúc
 * tin được tạo. Bỏ trống thì tin đăng từ template v1 sẽ hiện field của v2, và mất giá trị của
 * field mà v2 đã bỏ đi.
 */
export function useCategoryTemplate(categoryId: string, version?: number) {
  return useQuery({
    queryKey: qk.categoryTemplate(categoryId, version),
    queryFn: () => api.getCategoryTemplate(categoryId, version),
    enabled: categoryId.length > 0,
    staleTime: TEMPLATE_STALE_MS,
  });
}
