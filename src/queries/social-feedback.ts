import { useMutation, useQueryClient } from '@tanstack/react-query';
import { socialFeedbackApi, type ReviewDecision, type ReviewStatus } from '@/api/social-feedback';
import { usePagedList } from './paged';
import { qk } from './keys';

/**
 * Ý kiến của tổ chức xã hội — hook của cụm tạm thời (công thức gỡ ở `@/api/legal`).
 *
 * Không có optimistic ở đâu cả, và đó là câu trả lời cho HARD#4 chứ không phải một thiếu sót:
 * cả hai mutation đều đổi thứ người dùng KHÔNG đang nhìn. Gửi ý kiến xong nó vào hàng chờ nên
 * không có dòng nào để chèn trước vào danh sách công bố; duyệt xong thì dòng rời hàng đợi sang
 * một danh sách khác. Vẽ trước một dòng rồi rollback ở đây là dựng rủi ro cho một hiệu ứng
 * không ai thấy.
 */

/** Danh sách ĐÃ CÔNG BỐ — công khai, không cần đăng nhập. */
export function usePublishedFeedback() {
  return usePagedList(qk.socialFeedback(), (page) => socialFeedbackApi.listPublished(page));
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: socialFeedbackApi.submit,
    /*
     * Quét cả hai cụm dù bản vừa gửi CHƯA công bố: người gửi có thể chính là master đang mở
     * bàn duyệt ở tab khác, và với người thường thì `socialFeedbackQueueRoot()` không nằm
     * trong cache nên đây là lệnh rỗng — cùng lối `useCreateReport` đang dùng.
     */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.socialFeedbackQueueRoot() });
    },
  });
}

// ── Bàn duyệt của master ──────────────────────────────────────────────

export function useFeedbackQueue(status: ReviewStatus) {
  return usePagedList(
    qk.socialFeedbackQueue(status),
    (page) => socialFeedbackApi.queue(status, page),
    { keepPrevious: true },
  );
}

export function useReviewFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewDecision }) =>
      socialFeedbackApi.review(id, status),
    onSuccess: () => {
      // Hai lượt quét vì hai cụm KHÔNG lồng nhau: duyệt một ý kiến vừa rút nó khỏi hàng đợi
      // vừa đẩy nó lên trang công bố.
      void qc.invalidateQueries({ queryKey: qk.socialFeedbackQueueRoot() });
      void qc.invalidateQueries({ queryKey: qk.socialFeedback() });
    },
  });
}
