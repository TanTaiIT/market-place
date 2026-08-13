/**
 * Danh sách trường của fixture. Ở bản đã nối BE, quản trị chỉ thấy trường của chính mình
 * (BE scope theo organization trong JWT) — hằng số này chỉ còn nghĩa với màn chưa nối.
 */
export const SCHOOLS = ['Hùng Vương', 'Cao Thắng'];

/**
 * Nhóm "Cộng đồng" của bàn quản trị: người dùng và trường. Tách khỏi `admin.ts` vì đó là
 * hàng đợi kiểm duyệt — hai thứ không dùng chung dữ liệu nào ngoài số đếm tin đăng.
 *
 * Vẫn là fixture in-memory: BE chưa có route quản trị người dùng lẫn tổ chức nào.
 */

// ── TYPES ───────────────────────────────────────────────────────────

export type UserStatus = 'ok' | 'unverified' | 'locked';

export type AdminUser = {
  id: number;
  name: string;
  avatar: string;
  school: string;
  phone: string;
  posts: number;
  sold: number;
  /** `0` = chưa ai đánh giá; màn hiện `—` chứ không hiện 0 sao. */
  rating: number;
  status: UserStatus;
  joined: string;
};

export type School = {
  name: string;
  students: number;
  /** Số tin đang có, tính từ `admin.ts` lúc đọc — không giữ bản sao đếm sẵn. */
  listings: number;
  admin: string;
  since: string;
};

export type SchoolLink = {
  id: string;
  title: string;
  desc: string;
  on: boolean;
};

// ── STATE ───────────────────────────────────────────────────────────

const users: AdminUser[] = [
  { id: 1, name: 'Minh Vũ', avatar: 'MV', school: 'Hùng Vương', phone: '090 123 4567', posts: 6, sold: 3, rating: 4.9, status: 'ok', joined: '12/03/2026' },
  { id: 2, name: 'Thu Hà', avatar: 'TH', school: 'Cao Thắng', phone: '091 222 3344', posts: 9, sold: 6, rating: 4.8, status: 'ok', joined: '02/02/2026' },
  { id: 3, name: 'Đức Anh', avatar: 'ĐA', school: 'Hùng Vương', phone: '098 555 6677', posts: 5, sold: 1, rating: 3.6, status: 'locked', joined: '19/04/2026' },
  { id: 4, name: 'Gia Bảo', avatar: 'GB', school: 'Cao Thắng', phone: '096 888 1122', posts: 4, sold: 4, rating: 5, status: 'ok', joined: '28/01/2026' },
  { id: 5, name: 'Khánh Linh', avatar: 'KL', school: 'Cao Thắng', phone: '097 444 8899', posts: 3, sold: 0, rating: 0, status: 'unverified', joined: '11/08/2026' },
  { id: 6, name: 'Hoàng Nam', avatar: 'HN', school: 'Hùng Vương', phone: '094 777 2211', posts: 0, sold: 0, rating: 0, status: 'unverified', joined: '12/08/2026' },
];

const SCHOOL_INFO: Record<string, { students: number; admin: string; since: string }> = {
  'Hùng Vương': { students: 642, admin: 'Minh Vũ', since: '01/2026' },
  'Cao Thắng': { students: 642, admin: 'Thu Hà', since: '02/2026' },
};

const links: SchoolLink[] = [
  {
    id: 'cross-listing',
    title: 'Hùng Vương ⇄ Cao Thắng',
    desc: 'Học sinh hai trường thấy được tin đăng của nhau trên bảng tin chung. Tin vẫn do trường sở tại duyệt.',
    on: true,
  },
  {
    id: 'cross-chat',
    title: 'Nhắn tin giữa hai trường',
    desc: 'Cho phép học sinh khác trường nhắn tin trực tiếp với người bán.',
    on: false,
  },
];

const delay = (ms = 180) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ── API ─────────────────────────────────────────────────────────────

export const adminPeopleApi = {
  async getUsers(school: string): Promise<AdminUser[]> {
    await delay();
    return clone(users.filter((u) => school === 'all' || u.school === school));
  },

  /** Xác nhận người dùng đúng là học sinh của trường — chỉ có nghĩa với `unverified`. */
  async verifyUser(id: number): Promise<AdminUser> {
    await delay(200);
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error('Không tìm thấy người dùng này');
    if (user.status !== 'unverified') throw new Error(`${user.name} đã được xác thực rồi`);
    user.status = 'ok';
    return clone(user);
  },

  /** Khoá / mở khoá. Người đang chờ xác thực mà bị khoá thì vẫn phải xác thực lại sau. */
  async toggleLock(id: number): Promise<AdminUser> {
    await delay(200);
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error('Không tìm thấy người dùng này');
    user.status = user.status === 'locked' ? 'ok' : 'locked';
    return clone(user);
  },

  async getSchools(): Promise<School[]> {
    await delay(160);
    // Số tin thật nằm ở `moderationOverview` của BE; màn Trường chưa nối nên để 0 thay vì
    // dựng lại từ fixture đã bỏ.
    return SCHOOLS.map((name) => ({ name, ...SCHOOL_INFO[name], listings: 0 }));
  },

  async getSchoolLinks(): Promise<SchoolLink[]> {
    await delay(140);
    return clone(links);
  },

  async toggleSchoolLink(id: string): Promise<SchoolLink> {
    await delay(180);
    const link = links.find((l) => l.id === id);
    if (!link) throw new Error('Liên kết này không còn nữa');
    link.on = !link.on;
    return clone(link);
  },
};
