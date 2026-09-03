import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { templateApi } from '@/api/templates';
import type { CategoryTemplate, TemplateTarget } from '@/api/templates';
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

/* ------------------------- soạn template (admin) -------------------------- */

/** Hai mục tiêu, hai dãy version rời nhau — nên cũng là hai nhánh key. */
const keyOf = (target: TemplateTarget, version?: number) =>
  target.kind === 'default'
    ? qk.defaultTemplate(version)
    : qk.categoryTemplate(target.categoryId, version);

/**
 * Key cho lúc CHƯA chọn mục tiêu nào.
 *
 * Vẫn đi qua factory (HARD#3) và cố tình là `categoryTemplate` với id rỗng: nó không đụng key
 * thật nào. Trỏ vào `defaultTemplate()` thì query đang tắt sẽ dùng chung ô cache với mẫu mặc
 * định, và `published.data` có dữ liệu trong khi người soạn chưa chọn gì.
 */
const idleKey = (version?: number) => qk.categoryTemplate('', version);

/** Bản đang phục vụ của mục tiêu đang soạn. `null` = chưa chọn gì. */
export function useTemplatePublished(target: TemplateTarget | null) {
  return useQuery({
    queryKey: target ? keyOf(target) : idleKey(),
    queryFn: () => templateApi.get(target as TemplateTarget),
    enabled: target != null,
    staleTime: TEMPLATE_STALE_MS,
  });
}

/** Từ điển field. Đổi rất ít, mà mỗi lần mở bộ chọn field lại gọi thì phí. */
export function useFieldDefinitions() {
  return useQuery({
    queryKey: qk.fieldDefinitions(),
    queryFn: templateApi.definitions,
    staleTime: TEMPLATE_STALE_MS,
  });
}

/**
 * Dò xem danh mục có bản nháp đang mở không. `null` = chưa có.
 *
 * BE không có route liệt kê template, và response cũng KHÔNG mang `status` — nên "có nháp hay
 * không" phải suy ra từ hai luật khớp nhau: `GET` không kèm version luôn trả bản ĐÃ PHÁT HÀNH
 * mới nhất, còn `createDraft` luôn đánh version = mới nhất + 1. Nên bản ở version kế tiếp, nếu
 * có, chỉ có thể là nháp — đã phát hành thì chính nó mới là thứ lượt `GET` kia trả về.
 *
 * Phải so `version` của kết quả, KHÔNG bắt 404: `getForCategory` cố tình rơi về bản mới nhất
 * khi version ghim không tồn tại (để form sửa tin cũ vẫn dựng được), nên hỏi một version không
 * có vẫn trả 200 kèm bản đã phát hành.
 *
 * Danh mục đang xài bản chung (`isFallback`) thì chưa có template riêng nào, nháp đầu tiên sẽ
 * là version 1 — không phải "version của bản chung + 1", vì hai dãy version đó rời nhau.
 */
export function useTemplateDraft(
  published: CategoryTemplate | undefined,
  target: TemplateTarget | null,
) {
  /*
   * Mẫu mặc định thì `isFallback` LUÔN đúng, nên không suy ra được "chưa có bản riêng" từ nó
   * như đường của danh mục — dãy version của nó là dãy duy nhất, và nháp kế tiếp bao giờ cũng
   * là bản đang phục vụ + 1.
   */
  const probe =
    published == null
      ? undefined
      : target?.kind === 'default' || !published.isFallback
        ? published.version + 1
        : 1;
  return useQuery({
    queryKey: target ? keyOf(target, probe) : idleKey(probe),
    queryFn: async () => {
      const got = await templateApi.get(target as TemplateTarget, probe);
      const isDraft = target?.kind === 'default' ? true : !got.isFallback;
      return got.version === probe && isDraft ? got : null;
    },
    enabled: target != null && probe != null,
    staleTime: 0,
  });
}

/**
 * Refetch contract của cả ba mutation dưới đây: invalidate `qk.categories()` — prefix phủ cả
 * `categoryTemplate(id, version)` lẫn bản `latest`. Liệt kê từng version thì sẽ bỏ sót đúng cái
 * vừa sinh ra, vì version mới chỉ biết được SAU khi BE trả lời.
 */
function useTemplateMutation<TInput>(fn: (input: TInput) => Promise<CategoryTemplate>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: qk.categories() }),
  });
}

export const useCreateTemplateDraft = () => useTemplateMutation(templateApi.createDraft);
export const useUpdateTemplateDraft = () => useTemplateMutation(templateApi.updateDraft);
export const usePublishTemplate = () => useTemplateMutation(templateApi.publish);
