import { notificationCreate, notificationList } from './generated';
import { relativeTime, unwrap } from './client';
import { withAuthRetry } from './http';

/** Bốn danh mục khởi điểm của fixture — trùng với seed bên BE. */
const MOD_CATEGORIES = ['Sách vở', 'Xe đạp', 'Điện tử', 'Đồ dùng'];

/**
 * Nhóm "Nội dung" + "Khác" của bàn quản trị: danh mục, thông báo đẩy, và luật của bảng tin.
 * Ba thứ này đều là **cấu hình** — quản trị đặt ra rồi cả trường chạy theo — khác hẳn hàng đợi
 * kiểm duyệt bên `admin.ts` vốn xử từng tin một.
 *
 * **Thông báo đã nối BE thật** (`/notifications`). Danh mục và luật vẫn là fixture in-memory:
 * `/categories` của BE đang trả 501 và chưa có route lưu cấu hình nào.
 */

// ── TYPES ───────────────────────────────────────────────────────────

export type Category = {
  name: string;
  /** Mở cho ai — `'Cả hệ thống'` hoặc tên một trường. */
  scope: string;
  /** Số tin đang có, đếm lúc đọc từ `admin.ts`. */
  count: number;
};

/**
 * Một thông báo đã gửi, đọc từ BE.
 *
 * Không còn `reach` (số người nhận): BE không đếm được và cũng không có khái niệm "gửi tới N
 * người" — thông báo là một bản ghi của tổ chức, ai thuộc phạm vi thì đọc được. Thay bằng
 * `readCount`, con số DUY NHẤT có thật về độ phủ.
 *
 * `NoticeSender` (org/chain/system) cũng bỏ: `chain` là khái niệm đã xoá khỏi hệ thống ở v2,
 * còn `system` chưa từng có endpoint nào gửi.
 */
export type SentNotice = {
  id: string;
  title: string;
  /** `null` = gửi cho cả tổ chức. */
  unitId: string | null;
  readCount: number;
  at: string;
};

export type AdminRule = { id: string; title: string; desc: string; on: boolean };

export type AdminLimits = {
  /** Số tin đang hiển thị tối đa mỗi người, không tính tin đã bán. */
  maxPerUser: number;
  /** Số ngày tin tự rơi khỏi bảng. */
  expiryDays: number;
};

/** Tuỳ chọn hợp lệ cho `expiryDays` — để màn không phải tự bịa ra danh sách. */
export const EXPIRY_CHOICES = [30, 45, 60];

/** Tối đa 8 danh mục: quá số đó thì hàng băng dính trên bảng tin của học sinh tràn dòng. */
export const MAX_CATEGORIES = 8;

// ── STATE ───────────────────────────────────────────────────────────

let categories: { name: string; scope: string }[] = MOD_CATEGORIES.map((name) => ({
  name,
  scope: 'Cả hệ thống',
}));

const rules: AdminRule[] = [
  {
    id: 'review-first',
    title: 'Duyệt trước khi lên bảng',
    desc: 'Tắt đi thì tin hiện ngay, quản trị chỉ gỡ khi có báo cáo. Tắt vào mùa cao điểm cuối kỳ nếu duyệt không xuể.',
    on: true,
  },
  {
    id: 'trust-seller',
    title: 'Tự duyệt cho người bán uy tín',
    desc: 'Người có từ 5 giao dịch thành công và chưa từng bị báo cáo sẽ được đăng thẳng.',
    on: true,
  },
  {
    id: 'block-keyword',
    title: 'Chặn tin có từ khoá cấm',
    desc: 'Tin chứa từ khoá trong danh sách sẽ bị giữ lại và đánh dấu đỏ ở hàng đợi.',
    on: true,
  },
];

const limits: AdminLimits = { maxPerUser: 10, expiryDays: 45 };

const delay = (ms = 180) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ── API ─────────────────────────────────────────────────────────────

export const adminContentApi = {
  async getCategories(_school: string): Promise<Category[]> {
    await delay(150);
    // Đếm tin theo danh mục thuộc về `OrganizationCategory` (bước 5 trong admin-console.md).
    // Chưa có thì trả 0 chứ không dựng số từ fixture đã bỏ — thà trống còn hơn sai.
    return categories.map((c) => ({ ...c, count: 0 }));
  },

  async addCategory(name: string, scope: string): Promise<Category> {
    await delay(200);
    const clean = name.trim();
    if (!clean) throw new Error('Nhập tên danh mục trước đã');
    if (categories.length >= MAX_CATEGORIES) {
      throw new Error(`Đã đủ ${MAX_CATEGORIES} danh mục, gỡ bớt một cái trước`);
    }
    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error(`Đã có danh mục "${clean}" rồi`);
    }
    categories = [...categories, { name: clean, scope }];
    return { name: clean, scope, count: 0 };
  },

  async renameCategory(from: string, to: string): Promise<Category> {
    await delay(200);
    const clean = to.trim();
    if (!clean) throw new Error('Nhập tên mới trước đã');
    const target = categories.find((c) => c.name === from);
    if (!target) throw new Error('Danh mục này không còn nữa');
    // Chốt chặn "còn tin trong danh mục này" cần đếm tin theo danh mục — thuộc về
    // `OrganizationCategory` (bước 5). Ở fixture này không kiểm được nên không giả vờ kiểm.
    target.name = clean;
    return { name: clean, scope: target.scope, count: 0 };
  },

  async removeCategory(name: string): Promise<{ name: string }> {
    await delay(200);
    categories = categories.filter((c) => c.name !== name);
    return { name };
  },

  /**
   * `scope: 'managed'` — thứ người gọi GỬI ĐƯỢC TỚI, không phải thứ họ nhận được.
   *
   * Mặc định `inbox` sẽ sai ở đúng ca thường gặp nhất: quản lý cấp org không đứng trong nhóm
   * nào, nên thông báo họ vừa gửi cho một nhóm không nằm trong hộp thư của họ — panel này sẽ
   * báo gửi xong rồi hiện một danh sách không có nó.
   */
  async getNotices(): Promise<SentNotice[]> {
    const res = await withAuthRetry(() =>
      notificationList({ query: { limit: 20, scope: 'managed' } }),
    );
    return unwrap(res, 'Không tải được thông báo đã gửi').map((n) => ({
      id: n.id,
      title: n.title,
      unitId: n.unitId,
      readCount: n.readCount,
      at: relativeTime(n.createdAt),
    }));
  },

  /**
   * Gửi thông báo. `unitId` rỗng = cả tổ chức — và BE chặn nếu người gửi chỉ phụ trách một nhóm.
   *
   * Không trả "số người nhận": BE không có con số đó, và bịa ra một con số cho một hành động
   * không rút lại được là kiểu nói dối tệ nhất.
   */
  async sendNotice(input: { title: string; body: string; unitId: string | null }) {
    if (!input.title.trim() || !input.body.trim()) {
      throw new Error('Điền tiêu đề và nội dung trước khi gửi');
    }
    const res = await withAuthRetry(() =>
      notificationCreate({
        body: { title: input.title.trim(), body: input.body.trim(), unitId: input.unitId },
      }),
    );
    return unwrap(res, 'Không gửi được thông báo');
  },

  async getRules(): Promise<AdminRule[]> {
    await delay(140);
    return clone(rules);
  },

  async toggleRule(id: string): Promise<AdminRule> {
    await delay(180);
    const rule = rules.find((r) => r.id === id);
    if (!rule) throw new Error('Quy tắc này không còn nữa');
    rule.on = !rule.on;
    return clone(rule);
  },

  async getLimits(): Promise<AdminLimits> {
    await delay(140);
    return { ...limits };
  },

  async setLimits(next: AdminLimits): Promise<AdminLimits> {
    await delay(200);
    if (!Number.isFinite(next.maxPerUser) || next.maxPerUser < 1) {
      throw new Error('Số tin tối đa phải là số từ 1 trở lên');
    }
    if (!EXPIRY_CHOICES.includes(next.expiryDays)) throw new Error('Chọn một mốc hết hạn hợp lệ');
    limits.maxPerUser = Math.round(next.maxPerUser);
    limits.expiryDays = next.expiryDays;
    return { ...limits };
  },
};
