import { approveKyc, kycDetail, listKyc, myKyc, rejectKyc, submitKyc } from './generated';
import { unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * ĐỊNH DANH NGƯỜI BÁN — lớp phủ TẠM THỜI cho vòng kiểm duyệt của Bộ Công Thương.
 *
 * Cả tính năng phía app gói trong ba file: `api/kyc.ts`, `queries/kyc.ts`, `app/kyc.tsx`, cộng
 * đúng MỘT dòng cắm ở `app/(tabs)/_layout.tsx`. Gỡ về sau = xoá ba file và dòng đó.
 *
 * KHÔNG đụng `http.ts`, không đụng `stores/auth`, không đụng luồng đăng nhập. Tài khoản đã
 * duyệt dùng app y hệt mọi tài khoản khác — khác biệt duy nhất là cái cổng ở BE.
 */

/** Hai đối tượng Bộ yêu cầu, và chúng đòi hai bộ field khác nhau. */
export type KycSubject = 'individual' | 'company';
export type KycStatus = 'pending' | 'approved' | 'rejected';

export type KycProfile = {
  id: string;
  subjectType: KycSubject;
  status: KycStatus;
  fullName: string;
  birthDate: string;
  companyName?: string;
  companyAddress?: string;
  companyTaxCode?: string;
  /** Lý do master từ chối — hiện lại cho người nộp để họ sửa đúng chỗ. */
  rejectReason: string | null;
};

export type KycInput = {
  subjectType: KycSubject;
  fullName: string;
  /** `YYYY-MM-DD`. BE nhận ISO, và ô nhập của app cũng gõ đúng dạng này. */
  birthDate: string;
  idNumber: string;
  companyName?: string;
  companyAddress?: string;
  companyTaxCode?: string;
};

export const kycApi = {
  /** `null` = chưa nộp hồ sơ. Đó là câu trả lời hợp lệ, không phải lỗi. */
  async mine(): Promise<KycProfile | null> {
    const res = await withAuthRetry(() => myKyc());
    return unwrap(res, 'Không đọc được hồ sơ định danh') as KycProfile | null;
  },

  async submit(input: KycInput): Promise<KycProfile> {
    /*
     * Gửi ĐÚNG bộ field của đối tượng đang chọn.
     *
     * BE dùng `discriminatedUnion`, nên gửi kèm field của nhánh kia không phải "thừa mà vô
     * hại" — nó là một hồ sơ cá nhân mang tên công ty, thứ người đi duyệt không giải thích
     * được. Cắt ở đây thay vì tin form luôn dọn sạch sau mỗi lần đổi tab.
     */
    const body =
      input.subjectType === 'company'
        ? {
            subjectType: 'company' as const,
            companyName: input.companyName ?? '',
            companyAddress: input.companyAddress ?? '',
            companyTaxCode: input.companyTaxCode ?? '',
            fullName: input.fullName,
            birthDate: input.birthDate,
            idNumber: input.idNumber,
          }
        : {
            subjectType: 'individual' as const,
            fullName: input.fullName,
            birthDate: input.birthDate,
            idNumber: input.idNumber,
          };

    const res = await withAuthRetry(() => submitKyc({ body }));
    return unwrap(res, 'Nộp hồ sơ không thành công') as KycProfile;
  },
};

/** Bản master đọc lúc duyệt — thêm số định danh và danh tính tài khoản. */
export type KycDetail = KycProfile & {
  idNumber: string;
  accountName: string;
  accountEmail: string;
};

export const kycAdminApi = {
  /** Hàng chờ duyệt. Mặc định `pending` — đó là việc duy nhất cần làm ngay. */
  async list(status: KycStatus = 'pending'): Promise<KycProfile[]> {
    const res = await withAuthRetry(() => listKyc({ query: { status, limit: 50 } }));
    return unwrap(res, 'Không tải được hàng chờ định danh') as KycProfile[];
  },

  /**
   * MỘT hồ sơ kèm số định danh — đường DUY NHẤT trả về `idNumber`.
   *
   * Gọi riêng lúc mở chi tiết, không nhét vào danh sách: số định danh của N người không nên
   * nằm sẵn trong bộ nhớ app chỉ vì có người mở bàn duyệt.
   */
  async detail(id: string): Promise<KycDetail> {
    const res = await withAuthRetry(() => kycDetail({ path: { id } }));
    return unwrap(res, 'Không đọc được hồ sơ') as KycDetail;
  },

  async approve(id: string) {
    unwrap(await withAuthRetry(() => approveKyc({ path: { id } })), 'Không duyệt được hồ sơ');
    return { id };
  },

  async reject({ id, reason }: { id: string; reason: string }) {
    unwrap(
      await withAuthRetry(() => rejectKyc({ path: { id }, body: { reason } })),
      'Không từ chối được hồ sơ',
    );
    return { id };
  },
};
