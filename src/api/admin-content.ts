import { countListings, MOD_CATEGORIES } from './admin';

/**
 * Nhóm "Nội dung" + "Khác" của bàn quản trị: danh mục, thông báo đẩy, và luật của bảng tin.
 * Ba thứ này đều là **cấu hình** — quản trị đặt ra rồi cả trường chạy theo — khác hẳn hàng đợi
 * kiểm duyệt bên `admin.ts` vốn xử từng tin một.
 *
 * Vẫn là fixture in-memory: `/categories` của BE đang trả 501, chưa có route thông báo đẩy
 * lẫn route lưu cấu hình nào.
 */

// ── TYPES ───────────────────────────────────────────────────────────

export type Category = {
  name: string;
  /** Mở cho ai — `'Cả hệ thống'` hoặc tên một trường. */
  scope: string;
  /** Số tin đang có, đếm lúc đọc từ `admin.ts`. */
  count: number;
};

export type NoticeSender = 'org' | 'chain' | 'system';

export type SentNotice = {
  id: number;
  title: string;
  audience: string;
  reach: number;
  at: string;
};

export type NoticeAudience = { id: string; label: string; reach: number };

export type AdminRule = { id: string; title: string; desc: string; on: boolean };

export type AdminLimits = {
  /** Số tin đang hiển thị tối đa mỗi người, không tính tin đã bán. */
  maxPerUser: number;
  /** Số ngày tin tự rơi khỏi bảng. */
  expiryDays: number;
};

/** Tuỳ chọn hợp lệ cho `expiryDays` — để màn không phải tự bịa ra danh sách. */
export const EXPIRY_CHOICES = [30, 45, 60];

export const NOTICE_AUDIENCES: NoticeAudience[] = [
  { id: 'school', label: 'Toàn trường', reach: 1284 },
  { id: 'chain', label: 'Cả hệ thống', reach: 2610 },
  { id: 'sellers', label: 'Người đang bán', reach: 312 },
];

/** Tối đa 8 danh mục: quá số đó thì hàng băng dính trên bảng tin của học sinh tràn dòng. */
export const MAX_CATEGORIES = 8;

// ── STATE ───────────────────────────────────────────────────────────

let categories: { name: string; scope: string }[] = MOD_CATEGORIES.map((name) => ({
  name,
  scope: 'Cả hệ thống',
}));

let notices: SentNotice[] = [
  { id: 1, title: 'Hội chợ đồ cũ cuối kỳ', audience: 'toàn trường Hùng Vương', reach: 1284, at: '5 giờ trước' },
  { id: 2, title: 'Mở xem tin đăng chéo hai trường', audience: 'cả hệ thống', reach: 2610, at: '1 ngày trước' },
  { id: 3, title: 'Nhắc gia hạn tin sắp hết hạn', audience: 'người đang bán', reach: 312, at: '3 ngày trước' },
];

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
  async getCategories(school: string): Promise<Category[]> {
    await delay(150);
    return categories.map((c) => ({
      ...c,
      count: countListings((l) => l.cat === c.name && (school === 'all' || l.school === school)),
    }));
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
    // Không đổi `cat` của tin đang có: tin thuộc về danh mục theo tên, đổi tên mà không dời tin
    // thì chúng rơi ra khỏi mọi bộ lọc. Chặn ở đây thay vì sửa nửa vời hai chỗ.
    if (countListings((l) => l.cat === from) > 0) {
      throw new Error(`Còn tin trong "${from}", chuyển tin đi trước khi đổi tên`);
    }
    target.name = clean;
    return { name: clean, scope: target.scope, count: 0 };
  },

  async removeCategory(name: string): Promise<{ name: string }> {
    await delay(200);
    if (countListings((l) => l.cat === name) > 0) {
      throw new Error(`Còn tin trong "${name}", chuyển tin đi trước`);
    }
    categories = categories.filter((c) => c.name !== name);
    return { name };
  },

  async getNotices(): Promise<SentNotice[]> {
    await delay(140);
    return clone(notices);
  },

  /**
   * Gửi thông báo đẩy. Trả về số người nhận để call-site báo lại đúng con số — đây là hành động
   * không rút lại được, người gửi cần thấy mình vừa chạm tới bao nhiêu người.
   */
  async sendNotice(input: {
    sender: NoticeSender;
    title: string;
    body: string;
    audienceId: string;
  }): Promise<SentNotice> {
    await delay(260);
    if (!input.title.trim() || !input.body.trim()) {
      throw new Error('Điền tiêu đề và nội dung trước khi gửi');
    }
    const audience = NOTICE_AUDIENCES.find((a) => a.id === input.audienceId);
    if (!audience) throw new Error('Chọn người nhận trước khi gửi');

    const sent: SentNotice = {
      id: Math.max(0, ...notices.map((n) => n.id)) + 1,
      title: input.title.trim(),
      audience: audience.label.toLowerCase(),
      reach: audience.reach,
      at: 'vừa xong',
    };
    notices = [sent, ...notices];
    return clone(sent);
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
