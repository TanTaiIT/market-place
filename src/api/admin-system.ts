import {
  bannedPhraseCreate,
  bannedPhraseList,
  bannedPhraseRemove,
  listingPostingStats,
  listingProductAdminList,
  listingProductCreate,
  listingProductRemove,
  listingProductUpdate,
} from './generated';
import type { ListingProduct, PostingStats } from './generated';
import { relativeTime, unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Nhóm "Hệ thống" của bàn quản trị — phần CHỈ master chạm được và KHÔNG đọc `X-Org-Slug`:
 * cụm từ cấm, catalog gói tin, số liệu định giá.
 *
 * Ba thứ này từng nằm cứng trong BE (`DEFAULT_BANNED_PHRASES`, `DEFAULT_LISTING_PRODUCTS`) và
 * chỉ đổi được bằng deploy; giờ hai mảng đó chỉ còn là SEED, luật thật sống trong DB. Không có
 * màn này thì cửa đã mở mà không ai đi qua được.
 */

// ── TYPES ───────────────────────────────────────────────────────────

/** Cụm cấm dưới dạng màn hình cần: `_id` của Mongo đổi tên cho khớp phần còn lại của app. */
export type BannedPhraseRow = {
  id: string;
  phrase: string;
  at: string;
};

/** Gói tin giữ nguyên hình BE trả về — form sửa cần đủ mọi field, không cắt bớt được. */
export type AdminProduct = ListingProduct;

export type ProductEffect = ListingProduct['effect'];

export const EFFECT_LABEL: Record<ProductEffect, string> = {
  rank_to_top: 'Đẩy lên đầu',
  featured: 'Tin nổi bật',
  extend_expiry: 'Gia hạn tin',
};

/**
 * Thứ master gõ ra ở form gói tin — số vẫn là **chuỗi thô** từ `TextInput`, đúng như
 * `CategoryDraft`: ép kiểu là việc của file này chứ không phải của màn hình (HARD#2).
 */
export type ProductDraft = {
  code: string;
  name: string;
  description: string;
  effect: ProductEffect;
  durationDays: string;
  cooldownHours: string;
  price: string;
  enabled: boolean;
  order: string;
};

export type { PostingStats };

// ── HELPERS ─────────────────────────────────────────────────────────

/**
 * Ô để trống = **không có**, không phải 0.
 *
 * `Number('')` ra 0, và với ô giá thì đó là "mở bán với giá 0 Xu" — một cái giá thật, phát cho
 * cả sàn. `null` mới mang đúng nghĩa "chưa chốt", và BE cũng đọc `null` theo nghĩa đó.
 */
function optionalNumber(raw: string, label: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${label} phải là số`);
  return value;
}

/**
 * `ProductDraft` → body BE nhận, dùng chung cho tạo và sửa.
 *
 * KHÔNG kiểm luật xuyên field ở đây ("đẩy tin không có thời hạn", "mở bán phải có giá"):
 * `productRuleErrors` bên BE là SoT và trả về câu đọc được. Chép sang đây là dựng bản sao thứ
 * hai, và bản sao sẽ lệch vào đúng ngày ai đó sửa một chỗ.
 */
function productBody(draft: ProductDraft) {
  const amount = optionalNumber(draft.price, 'Giá');
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    effect: draft.effect,
    durationDays: optionalNumber(draft.durationDays, 'Số ngày hiệu lực'),
    cooldownHours: optionalNumber(draft.cooldownHours, 'Giờ chờ'),
    price: amount === null ? null : { amount },
    enabled: draft.enabled,
    order: optionalNumber(draft.order, 'Thứ tự') ?? 0,
  };
}

// ── API ─────────────────────────────────────────────────────────────

export const adminSystemApi = {
  /**
   * Từ điển cụm cấm. Đây là **lớp 0 của cổng nội dung** — chạy trước mọi phép tính uy tín, tin
   * dính cụm thành `rejected` ngay tại cửa. Vì thế màn này không có "nháp" hay "tạm tắt": thêm
   * một cụm là luật áp ngay cho lượt đăng kế tiếp.
   */
  async getPhrases(): Promise<BannedPhraseRow[]> {
    const res = await withAuthRetry(() => bannedPhraseList());
    return unwrap(res, 'Không tải được danh sách cụm cấm').map((row) => ({
      id: row._id,
      phrase: row.phrase,
      at: relativeTime(row.createdAt),
    }));
  },

  async addPhrase(phrase: string): Promise<BannedPhraseRow> {
    // Hạ chữ thường ở đây KHÔNG phải để thay BE chuẩn hoá (nó tự làm, và unique index so bản
    // đã chuẩn hoá) mà để câu toast nói đúng thứ vừa được lưu — gõ "Pháo Nổ" mà báo đã cấm
    // "Pháo Nổ" thì lần sau người ta đi tìm đúng chữ đó trong danh sách và không thấy.
    const text = phrase.trim().toLowerCase();
    if (!text) throw new Error('Nhập cụm cần cấm trước đã');
    const res = await withAuthRetry(() => bannedPhraseCreate({ body: { phrase: text } }));
    const row = unwrap(res, 'Không thêm được cụm cấm');
    return { id: row._id, phrase: row.phrase, at: relativeTime(row.createdAt) };
  },

  async removePhrase(id: string): Promise<string> {
    const res = await withAuthRetry(() => bannedPhraseRemove({ path: { id } }));
    return unwrap(res, 'Không gỡ được cụm cấm').phrase;
  },

  /** Catalog đầy đủ, kể cả gói nháp — khác `GET /listings/products` vốn chỉ trả gói đang bán. */
  async getProducts(): Promise<AdminProduct[]> {
    const res = await withAuthRetry(() => listingProductAdminList());
    // Sắp theo `order` tại đây: nó là thứ tự gói hiện trên FE, mà BE không hứa trả về đã sắp.
    // `sort` chứ không `toSorted` — Hermes chưa có change-array-by-copy (xem `admin-content.ts`).
    return unwrap(res, 'Không tải được catalog gói tin').sort((a, b) => a.order - b.order);
  },

  async addProduct(draft: ProductDraft): Promise<AdminProduct> {
    const code = draft.code.trim();
    if (!code) throw new Error('Nhập mã gói trước đã');
    if (!draft.name.trim()) throw new Error('Nhập tên gói trước đã');
    const res = await withAuthRetry(() =>
      listingProductCreate({ body: { ...productBody(draft), code } }),
    );
    return unwrap(res, 'Không tạo được gói tin');
  },

  /**
   * Sửa gói. `code` KHÔNG nằm trong body: sổ cái tham chiếu gói bằng code, đổi nó là viết lại
   * lịch sử giao dịch — BE cũng không nhận field đó ở `PATCH`.
   */
  async editProduct({ id, draft }: { id: string; draft: ProductDraft }): Promise<AdminProduct> {
    const res = await withAuthRetry(() =>
      listingProductUpdate({ path: { id }, body: productBody(draft) }),
    );
    return unwrap(res, 'Không cập nhật được gói tin');
  },

  /**
   * Xoá cứng — chỉ dành cho gói tạo nhầm. Gói đã chạy thì **ngừng bán** (`enabled: false`) mới
   * đúng: code phải còn chỗ cho sổ cái trỏ về.
   */
  async removeProduct(id: string): Promise<AdminProduct> {
    const res = await withAuthRetry(() => listingProductRemove({ path: { id } }));
    return unwrap(res, 'Không xoá được gói tin');
  },

  /**
   * Số liệu định giá: bao nhiêu tin, bao nhiêu người đăng, phân bố theo danh mục và theo số tin
   * mỗi người. Đây là thứ thay cho việc đoán giá — `DEFAULT_LISTING_PRODUCTS` để `price: null`
   * đúng vì lý do đó.
   */
  async getPostingStats(days: number): Promise<PostingStats> {
    const res = await withAuthRetry(() => listingPostingStats({ query: { days } }));
    return unwrap(res, 'Không tải được số liệu đăng tin');
  },
};
