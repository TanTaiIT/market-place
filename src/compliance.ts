/**
 * CHẾ ĐỘ KIỂM DUYỆT — công tắc TẠM THỜI cho vòng thẩm định của Bộ Công Thương.
 *
 * Bật thì app chạy ở hình dạng Bộ yêu cầu:
 * - Nút "Đăng ký" mở form ĐỊNH DANH hai tab (cá nhân / tổ chức) thay vì form tài khoản cũ;
 * - Toàn bộ bề mặt xác thực email bị ẩn (dải nhắc ở Cá nhân, mục ở Cài đặt, cổng
 *   `useRequireVerifiedEmail`, và lượt mời ngay sau khi đăng ký).
 *
 * ĐÂY LÀ ĐIỂM ĐÁNH DẤU ĐỂ GỠ. Grep `REVIEW_MODE` là ra đúng mọi chỗ bị ảnh hưởng — hiện có bốn:
 * `app/register.tsx`, `src/api/client.ts`, và hai file của chính lớp phủ KYC.
 *
 * Luồng đăng ký CŨ không bị xoá, chỉ bị bỏ qua: `app/register.tsx` giữ nguyên bên dưới một
 * `if (REVIEW_MODE) return ...`. Gỡ công tắc là nó sống lại y như cũ.
 *
 * PHÍA BE có cờ đi kèm, và thiếu nó thì app hỏng ngầm: `SKIP_EMAIL_VERIFICATION=true`. Không
 * bật thì `requireVerifiedEmail` chặn đăng tin/nhắn tin, và job `unverified-cleanup` XOÁ CỨNG
 * tài khoản chưa xác thực sau 7 ngày — kể cả tài khoản demo đưa cho Bộ.
 */
export const REVIEW_MODE = true;
