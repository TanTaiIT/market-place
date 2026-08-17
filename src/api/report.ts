import { reportCreate } from './generated';
import type { CreateReport, Report } from './generated';
import { unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Gửi báo cáo về một tin đăng hoặc một người dùng.
 *
 * File riêng vì cụm này bắc qua hai bên bàn cân: người dùng thường GỬI (ở đây), quản trị ĐỌC và
 * đóng (`admin.ts`). Nhãn loại báo cáo vì thế chỉ được có MỘT bản — hai bên hiện hai chữ khác
 * nhau cho cùng một mã là người báo cáo chọn "Sai mô tả" mà hàng đợi đọc ra thứ khác.
 */

export type ReportKind = Report['kind'];

/** Thứ tự khai CHÍNH LÀ thứ tự hiện ra cho người báo cáo: nặng nhất trước, "Khác" chốt cuối. */
export const REPORT_KINDS: { value: ReportKind; label: string }[] = [
  { value: 'scam', label: 'Nghi lừa đảo' },
  { value: 'wrong_info', label: 'Sai mô tả' },
  { value: 'harassment', label: 'Nhắn tin làm phiền' },
  { value: 'banned_item', label: 'Hàng không được bán' },
  { value: 'other', label: 'Khác' },
];

export const reportKindLabel = (kind: ReportKind): string =>
  REPORT_KINDS.find((k) => k.value === kind)?.label ?? kind;

/** BE trả 400 khi `quote` quá ngắn — chặn tại chỗ để người gửi biết ngay, không mất một vòng mạng. */
export const MIN_REPORT_QUOTE = 10;

export const reportApi = {
  /**
   * BE tự gộp báo cáo trùng đối tượng và trả 409 nếu chính người này đã báo cáo rồi — app không
   * giữ danh sách "đã báo cáo gì" để đoán trước, cứ gửi và để thông điệp 409 đi thẳng ra toast.
   */
  async create(input: CreateReport): Promise<Report> {
    const quote = input.quote.trim();
    if (quote.length < MIN_REPORT_QUOTE) {
      throw new Error(`Mô tả cần ít nhất ${MIN_REPORT_QUOTE} ký tự để người xử lý hiểu chuyện gì`);
    }
    const res = await withAuthRetry(() => reportCreate({ body: { ...input, quote } }));
    return unwrap(res, 'Không gửi được báo cáo');
  },
};
