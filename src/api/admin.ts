import type { Grad } from '@/theme';

/**
 * Bàn quản trị — domain type + fixture + lớp truy cập, gói trong một file.
 *
 * Tách khỏi `db.ts`/`client.ts` vì đây là domain khác hẳn: `db.ts` giữ thứ người dùng cuối
 * nhìn thấy, còn ở đây là hàng đợi kiểm duyệt, báo cáo và thống kê — không màn nào của người
 * dùng chạm tới. Gộp vào `client.ts` thì file đó vượt 600 dòng mà chẳng có gì chung.
 *
 * **Toàn bộ là fixture in-memory**: BE `market` chưa có endpoint quản trị nào (không có route
 * duyệt tin, không có `/reports`, `/categories` vẫn trả 501). Mất khi tắt app, đúng bản chất
 * "chưa có BE" — giống hệt phần chat trong `db.ts`, không phải cache.
 *
 * Mọi hàm ném `Error` tiếng Việt khi thất bại; call-site hiện đúng một `toast`.
 */

// ── TYPES ───────────────────────────────────────────────────────────

/** Nhiều trạng thái hơn `Listing.status` của app: app chỉ cần biết hiện hay chưa. */
export type ModStatus = 'pending' | 'live' | 'hidden' | 'rejected';

export type ModListing = {
  id: number;
  title: string;
  price: string;
  cat: string;
  photo: Grad;
  seller: string;
  avatar: string;
  school: string;
  /** Đã trôi bao lâu từ lúc gửi, dạng người đọc ("12 phút") — fixture nên chốt cứng. */
  at: string;
  views: number;
  status: ModStatus;
  /** Chỉ có khi `status === 'rejected'`. */
  reason?: string;
  desc: string;
};

type Report = {
  id: number;
  /** Báo cáo nặng (nghi lừa đảo) — viền đỏ, xếp trước. */
  urgent: boolean;
  target: string;
  kind: string;
  by: string;
  at: string;
  /** Số lượt cùng báo cáo một đối tượng. */
  count: number;
  quote: string;
};

export type AdminEvent = {
  tone: 'ok' | 'alert' | 'note' | 'info' | 'muted';
  text: string;
  time: string;
};

export type AdminKpi = {
  key: 'pending' | 'live' | 'users' | 'reports';
  label: string;
  value: number;
  delta: string;
  direction: 'up' | 'down';
  note: string;
  /** 7 mốc gần nhất cho sparkline. */
  trend: number[];
};

/** Một ngày trên biểu đồ 14 ngày: số tin đã duyệt và số tin còn chờ. */
export type TrendPoint = { approved: number; pending: number };

export type CatShare = { cat: string; count: number };

type Overview = {
  kpis: AdminKpi[];
  events: AdminEvent[];
  trend: TrendPoint[];
  cats: CatShare[];
};

/** `'all'` = mọi trường; còn lại là tên trường đúng như trong `ModListing.school`. */
export type SchoolFilter = string;

export const SCHOOLS = ['Hùng Vương', 'Cao Thắng'];
export const MOD_CATEGORIES = ['Sách vở', 'Xe đạp', 'Điện tử', 'Đồ dùng'];

/** Vai trò BE khai là `string` tự do, spec không liệt kê giá trị nào — đây là phần đã biết chắc. */
const MEMBER_ROLES = new Set(['member', 'user', 'customer', 'student', 'guest']);

/**
 * Có mở được bàn quản trị không. Chặn theo danh sách **người dùng thường** chứ không phải
 * whitelist admin: đoán sai tên vai admin thì không ai vào được và chẳng ai biết vì sao, còn
 * đoán sai theo chiều này thì cùng lắm là hiện thêm một mục menu.
 *
 * Đây chỉ là cửa của giao diện. Khi BE có endpoint quản trị thật, quyền phải do BE chốt.
 */
export const canOpenAdmin = (role: string) => !MEMBER_ROLES.has(role.trim().toLowerCase());

/** Cùng vai trò với `NEW_PHOTOS` bên `db.ts`: ảnh giả lập khi tin chưa có ảnh thật. */
const MOD_PHOTOS: Record<string, Grad> = {
  bike: ['#D9D2BC', '#C7BE9E'],
  book: ['#C9D9C0', '#9FBF8E'],
  tech: ['#C7C2D9', '#9E97BF'],
  wood: ['#E0C79E', '#C79E6B'],
  bag: ['#D9C2C2', '#BF9797'],
  comic: ['#F0D6A6', '#D9B26B'],
  lamp: ['#CFD9D2', '#A3B5AA'],
  shoe: ['#D2C9D9', '#A99EBF'],
};

// ── STATE (mất khi tắt app) ─────────────────────────────────────────

let listings: ModListing[] = [
  { id: 101, title: 'Đàn guitar acoustic size 3/4', price: '450.000đ', cat: 'Đồ dùng', photo: MOD_PHOTOS.wood, seller: 'Thu Hà', avatar: 'TH', school: 'Cao Thắng', at: '12 phút', views: 0, status: 'pending', desc: 'Đàn tập cho người mới, dây mới thay tháng trước, có bao đựng và capo tặng kèm.' },
  { id: 102, title: 'Máy tính Casio fx-580VN X', price: '380.000đ', cat: 'Điện tử', photo: MOD_PHOTOS.tech, seller: 'Đức Anh', avatar: 'ĐA', school: 'Hùng Vương', at: '25 phút', views: 0, status: 'pending', desc: 'Máy chính hãng còn tem, dùng một kỳ thi rồi thôi, phím còn nảy tốt.' },
  { id: 103, title: 'Bộ đề ôn thi tốt nghiệp 2026', price: '90.000đ', cat: 'Sách vở', photo: MOD_PHOTOS.book, seller: 'Gia Bảo', avatar: 'GB', school: 'Hùng Vương', at: '1 giờ', views: 0, status: 'pending', desc: 'Sách còn mới, có lời giải chi tiết, đã làm khoảng 20 trang bằng bút chì.' },
  { id: 104, title: 'Xe đạp mini Nhật bãi', price: '1.200.000đ', cat: 'Xe đạp', photo: MOD_PHOTOS.bike, seller: 'Khánh Linh', avatar: 'KL', school: 'Cao Thắng', at: '2 giờ', views: 0, status: 'pending', desc: 'Xe nhập bãi, khung nhôm nhẹ, vành còn căng, phanh vừa thay má mới.' },
  { id: 105, title: 'Đèn học chống cận có kẹp bàn', price: '120.000đ', cat: 'Đồ dùng', photo: MOD_PHOTOS.lamp, seller: 'Minh Vũ', avatar: 'MV', school: 'Hùng Vương', at: '3 giờ', views: 0, status: 'pending', desc: 'Đèn LED ba mức sáng, kẹp chắc, dùng nửa năm, còn nguyên hộp.' },
  { id: 106, title: 'Giày chạy bộ size 40', price: '250.000đ', cat: 'Đồ dùng', photo: MOD_PHOTOS.shoe, seller: 'Thu Hà', avatar: 'TH', school: 'Cao Thắng', at: '5 giờ', views: 0, status: 'pending', desc: 'Đi được vài buổi thấy chật nên nhượng lại, đế còn gần như mới.' },
  { id: 1, title: 'Xe đạp thể thao còn mới 90%', price: '250.000đ', cat: 'Xe đạp', photo: MOD_PHOTOS.bike, seller: 'Minh Vũ', avatar: 'MV', school: 'Hùng Vương', at: '2 giờ', views: 342, status: 'live', desc: 'Xe đạp thể thao ít sử dụng, còn bảo hành khung, sang tên nhanh gọn.' },
  { id: 2, title: 'Bộ sách Toán 12 đầy đủ', price: '120.000đ', cat: 'Sách vở', photo: MOD_PHOTOS.book, seller: 'Thu Hà', avatar: 'TH', school: 'Cao Thắng', at: '5 giờ', views: 198, status: 'live', desc: 'Bộ sách giáo khoa và sách bài tập Toán 12, còn giữ gìn cẩn thận.' },
  { id: 3, title: 'Laptop cũ, pin trâu, học tốt', price: '1.850.000đ', cat: 'Điện tử', photo: MOD_PHOTOS.tech, seller: 'Đức Anh', avatar: 'ĐA', school: 'Hùng Vương', at: '1 ngày', views: 876, status: 'live', desc: 'Laptop dùng học tập 1 năm, còn bảo hành hãng 6 tháng.' },
  { id: 4, title: 'Cho tặng bàn học gỗ', price: 'Miễn phí', cat: 'Đồ dùng', photo: MOD_PHOTOS.wood, seller: 'Gia Bảo', avatar: 'GB', school: 'Cao Thắng', at: '1 ngày', views: 521, status: 'live', desc: 'Bàn học gỗ còn chắc chắn, chuyển nhà nên cho tặng.' },
  { id: 5, title: 'Balo laptop chống nước', price: '180.000đ', cat: 'Đồ dùng', photo: MOD_PHOTOS.bag, seller: 'Minh Vũ', avatar: 'MV', school: 'Hùng Vương', at: '2 ngày', views: 264, status: 'live', desc: 'Balo chống nước, nhiều ngăn, còn mới 95%.' },
  { id: 6, title: 'Truyện tranh trọn bộ 20 tập', price: '150.000đ', cat: 'Sách vở', photo: MOD_PHOTOS.comic, seller: 'Thu Hà', avatar: 'TH', school: 'Cao Thắng', at: '3 ngày', views: 433, status: 'live', desc: 'Bộ truyện đầy đủ 20 tập, không rách, không mất trang.' },
  { id: 7, title: 'Tai nghe bluetooth pin 8 tiếng', price: '320.000đ', cat: 'Điện tử', photo: MOD_PHOTOS.tech, seller: 'Khánh Linh', avatar: 'KL', school: 'Cao Thắng', at: '4 ngày', views: 129, status: 'hidden', desc: 'Tai nghe dùng ổn, hộp sạc còn tốt, ẩn tạm vì đang thương lượng.' },
  { id: 8, title: 'Bán tài khoản game giá rẻ', price: '500.000đ', cat: 'Điện tử', photo: MOD_PHOTOS.tech, seller: 'Đức Anh', avatar: 'ĐA', school: 'Hùng Vương', at: '4 ngày', views: 12, status: 'rejected', reason: 'Món đồ không được phép bán', desc: 'Tài khoản nhiều skin hiếm, giao dịch qua chuyển khoản trước.' },
  { id: 9, title: 'Vợt cầu lông kèm 3 quả cầu', price: '210.000đ', cat: 'Đồ dùng', photo: MOD_PHOTOS.shoe, seller: 'Gia Bảo', avatar: 'GB', school: 'Hùng Vương', at: '5 ngày', views: 87, status: 'live', desc: 'Vợt còn căng dây, tặng kèm ba quả cầu chưa dùng.' },
  { id: 10, title: 'Máy ảnh film chụp thử', price: '890.000đ', cat: 'Điện tử', photo: MOD_PHOTOS.tech, seller: 'Khánh Linh', avatar: 'KL', school: 'Cao Thắng', at: '6 ngày', views: 604, status: 'live', desc: 'Máy film cơ, đã test hết chức năng, tặng một cuộn phim màu.' },
];

let reports: Report[] = [
  { id: 1, urgent: true, target: 'Bán tài khoản game giá rẻ', kind: 'Nghi lừa đảo', by: 'Thu Hà', at: '40 phút trước', count: 3, quote: 'Bạn này yêu cầu chuyển khoản trước rồi mới cho xem tài khoản. Mình thấy không ổn.' },
  { id: 2, urgent: false, target: 'Laptop cũ, pin trâu, học tốt', kind: 'Sai mô tả', by: 'Gia Bảo', at: '3 giờ trước', count: 1, quote: 'Tin ghi còn bảo hành 6 tháng nhưng lúc xem máy thì hết bảo hành từ tháng trước rồi.' },
  { id: 3, urgent: false, target: 'Khánh Linh', kind: 'Nhắn tin làm phiền', by: 'Minh Vũ', at: '1 ngày trước', count: 2, quote: 'Nhắn hỏi liên tục lúc nửa đêm dù mình đã nói tin bán xong rồi.' },
];

const EVENTS: AdminEvent[] = [
  { tone: 'ok', text: 'Thu Hà gửi tin mới · Đàn guitar acoustic', time: '12 phút trước' },
  { tone: 'alert', text: '3 người báo cáo tin "Bán tài khoản game giá rẻ"', time: '40 phút trước' },
  { tone: 'note', text: 'Bạn đã ghim 4 tin lên bảng Hùng Vương', time: '1 giờ trước' },
  { tone: 'info', text: 'Hoàng Nam đăng ký, đang chờ xác thực trường', time: '2 giờ trước' },
  { tone: 'ok', text: 'Thông báo "Hội chợ đồ cũ" đã gửi tới 1.284 người', time: '5 giờ trước' },
  { tone: 'muted', text: 'Tự động gỡ 2 tin hết hạn sau 45 ngày', time: '1 ngày trước' },
];

const TREND: TrendPoint[] = [
  { approved: 9, pending: 4 }, { approved: 12, pending: 3 }, { approved: 7, pending: 2 },
  { approved: 15, pending: 5 }, { approved: 11, pending: 4 }, { approved: 18, pending: 6 },
  { approved: 22, pending: 7 }, { approved: 14, pending: 3 }, { approved: 16, pending: 5 },
  { approved: 24, pending: 8 }, { approved: 19, pending: 6 }, { approved: 13, pending: 4 },
  { approved: 21, pending: 7 }, { approved: 26, pending: 6 },
];

/** Tổng số người dùng: chưa có endpoint đếm nên chốt cứng như prototype. */
const TOTAL_USERS = 1284;

// ── HELPERS ─────────────────────────────────────────────────────────

const delay = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const inSchool = (school: SchoolFilter, row: { school: string }) =>
  school === 'all' || row.school === school;

function find(id: number): ModListing {
  const row = listings.find((l) => l.id === id);
  if (!row) throw new Error('Tin này không còn trên bảng nữa');
  return row;
}

/**
 * Đếm tin theo điều kiện — màn Danh mục và Trường đều hiện con số của tin đăng, mà tin đăng
 * thì thuộc file này. Mở đúng một cửa sổ đọc thay vì để hai file kia giữ bản sao riêng.
 */
export const countListings = (match: (l: ModListing) => boolean) => listings.filter(match).length;

// ── API ─────────────────────────────────────────────────────────────

export const adminApi = {
  /** Một lượt gọi cho cả màn tổng quan — bốn thẻ số, dòng thời gian, hai biểu đồ. */
  async getOverview(school: SchoolFilter): Promise<Overview> {
    await delay(180);
    const rows = listings.filter((l) => inSchool(school, l));
    const pending = rows.filter((l) => l.status === 'pending').length;
    const live = rows.filter((l) => l.status === 'live').length;

    return {
      kpis: [
        { key: 'pending', label: 'Chờ duyệt', value: pending, delta: '+4', direction: 'up', note: 'so với hôm qua', trend: [3, 5, 2, 6, 4, 7, pending] },
        { key: 'live', label: 'Đang hiển thị', value: live, delta: '+12%', direction: 'up', note: '7 ngày', trend: [14, 17, 15, 19, 21, 20, live + 18] },
        { key: 'users', label: 'Người dùng', value: TOTAL_USERS, delta: '+38', direction: 'up', note: 'tuần này', trend: [1180, 1204, 1219, 1240, 1252, 1270, TOTAL_USERS] },
        { key: 'reports', label: 'Báo cáo mở', value: reports.length, delta: '-2', direction: 'down', note: 'đã xử 5 hôm qua', trend: [8, 7, 9, 6, 5, 4, reports.length] },
      ],
      events: clone(EVENTS),
      trend: clone(TREND),
      // Nhân 7 cộng 11: fixture chỉ có chục tin nên số thật trông trống trải, prototype cũng
      // giãn y hệt. Thay bằng số thật ngay khi BE có endpoint thống kê.
      cats: MOD_CATEGORIES.map((cat) => ({
        cat,
        count: rows.filter((l) => l.cat === cat).length * 7 + 11,
      })),
    };
  },

  /**
   * Lọc danh mục cố tình **không** nằm ở đây: màn Tin đăng cần đếm số tin của từng danh mục để
   * hiện lên viên lọc, mà đếm thì phải có cả tập. Trả nguyên tập theo trường + trạng thái, màn
   * tự cắt — cũng nhờ vậy hai màn dùng chung đúng một entry cache.
   */
  async getListings(filter: {
    school: SchoolFilter;
    /** `'all'` = mọi trạng thái. */
    status: ModStatus | 'all';
  }): Promise<ModListing[]> {
    await delay(160);
    return clone(
      listings.filter(
        (l) => inSchool(filter.school, l) && (filter.status === 'all' || l.status === filter.status),
      ),
    );
  },

  async getReports(): Promise<Report[]> {
    await delay(140);
    // Báo cáo nặng lên trước: quản trị mở màn này để xử việc gấp, không phải để đọc theo thứ tự
    // gửi. Chia hai rổ chứ không `sort`: giữ nguyên thứ tự gửi trong từng rổ, không đụng mảng gốc.
    return clone([...reports.filter((r) => r.urgent), ...reports.filter((r) => !r.urgent)]);
  },

  /** Duyệt / từ chối / ẩn / hiện lại. `reason` bắt buộc khi từ chối. */
  async setStatus(id: number, status: ModStatus, reason?: string): Promise<ModListing> {
    await delay(200);
    if (status === 'rejected' && !reason) throw new Error('Chọn lý do trước khi từ chối');
    const row = find(id);
    row.status = status;
    // Xoá lý do cũ khi tin được duyệt lại, nếu không bảng vẫn hiện lý do của lượt từ chối trước.
    row.reason = status === 'rejected' ? reason : undefined;
    return clone(row);
  },

  async remove(id: number): Promise<{ id: number }> {
    await delay(200);
    find(id);
    listings = listings.filter((l) => l.id !== id);
    return { id };
  },

  /**
   * Đóng một báo cáo. `hideTarget` = gỡ luôn tin bị báo cáo.
   * Đối chiếu theo tiêu đề vì báo cáo có thể nhắm vào người dùng chứ không riêng tin đăng.
   */
  async resolveReport(id: number, hideTarget: boolean): Promise<{ id: number }> {
    await delay(180);
    const report = reports.find((r) => r.id === id);
    if (!report) throw new Error('Báo cáo này đã được xử lý rồi');
    if (hideTarget) {
      const target = listings.find((l) => l.title === report.target);
      if (target) target.status = 'hidden';
    }
    reports = reports.filter((r) => r.id !== id);
    return { id };
  },
};
