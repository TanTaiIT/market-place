import {
  socialFeedbackList,
  socialFeedbackReview,
  socialFeedbackReviewQueue,
  socialFeedbackSubmit,
} from './generated';
import type {
  CreateSocialFeedback,
  SocialFeedback,
  SocialFeedbackAdmin,
  ReviewSocialFeedback,
} from './generated';
import { unwrap, unwrapPage, type Page } from './client';
import { withAuthRetry } from './http';

/**
 * Ý kiến của tổ chức xã hội — phần GỌI MẠNG của cụm tạm thời (công thức gỡ ở `@/api/legal`).
 *
 * Hai đường đầu KHÔNG bọc `withAuthRetry`, và đó là chủ ý chứ không phải quên: chúng là cửa
 * công khai, khách chưa đăng nhập không có token nào để làm mới. Bọc vào thì một lượt 401 giả
 * (BE đổi cấu hình, token cũ còn trong máy) biến thành một vòng refresh rồi vẫn hỏng, và người
 * gửi nhận được câu báo lỗi nói về đăng nhập cho một form không đòi đăng nhập.
 */
export type { SocialFeedback, SocialFeedbackAdmin };

export const socialFeedbackApi = {
  async submit(input: CreateSocialFeedback): Promise<SocialFeedback> {
    const res = await socialFeedbackSubmit({ body: input });
    return unwrap(res, 'Không gửi được ý kiến');
  },

  async listPublished(page: number): Promise<Page<SocialFeedback>> {
    const res = await socialFeedbackList({ query: { page } });
    return unwrapPage(res, 'Không tải được danh sách đánh giá', (row) => row);
  },

  // ── Bàn duyệt của master ──────────────────────────────────────────

  async queue(status: ReviewStatus, page: number): Promise<Page<SocialFeedbackAdmin>> {
    const res = await withAuthRetry(() =>
      socialFeedbackReviewQueue({ query: { page, status } }),
    );
    return unwrapPage(res, 'Không tải được hàng đợi ý kiến', (row) => row);
  },

  async review(id: string, status: ReviewDecision): Promise<SocialFeedbackAdmin> {
    const res = await withAuthRetry(() =>
      socialFeedbackReview({ path: { id }, body: { status } }),
    );
    return unwrap(res, 'Không cập nhật được ý kiến');
  },
};

/** Ba trạng thái để LỌC hàng đợi — lấy thẳng từ SDK, không có bản chép tay lệch với BE. */
export type ReviewStatus = NonNullable<SocialFeedbackAdmin['status']>;

/**
 * Hai đích đến của một QUYẾT ĐỊNH duyệt — hẹp hơn `ReviewStatus` một giá trị.
 *
 * `pending` lọc được nhưng không đặt lại được: "trả về hàng đợi" không phải một quyết định, và
 * BE trả 400 cho nó. Dùng chung một kiểu cho cả lọc lẫn ghi là để lỗi đó chỉ lộ ra lúc chạy.
 */
export type ReviewDecision = ReviewSocialFeedback['status'];
