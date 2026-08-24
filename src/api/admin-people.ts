/** Bộ lọc trường của fixture. Biến mất cùng lúc với fixture — BE không trả `school` cho user. */
export const SCHOOLS = ['Hùng Vương', 'Cao Thắng'];

/**
 * Bảng người dùng của bàn quản trị. Tách khỏi `admin.ts` vì đó là hàng đợi kiểm duyệt — hai
 * thứ không dùng chung dữ liệu nào ngoài số đếm tin đăng.
 *
 * ⚠️ CÒN LÀ FIXTURE IN-MEMORY, và giờ là fixture **có thể bỏ được**: BE đã mở
 * `GET /users`, `PATCH /users/{id}/status`, `POST /users/{id}/clear-rejections`.
 *
 * Không đổi thẳng `queryFn` được vì hình dạng lệch nhau: BE trả
 * `{ id(string), name, email, avatar, isActive, isEmailVerified, trustLevel, lastLoginAt, createdAt }`
 * — KHÔNG có `school`/`phone`/`posts`/`sold`/`rating`, và `status` ba nhánh ở đây là hai cột
 * `isActive` + `isEmailVerified` bên kia. Riêng `verifyUser` KHÔNG có endpoint tương ứng: xác
 * thực email là việc của người dùng, thứ gần nhất BE cho phép là gỡ án phạt đăng tin.
 *
 * Phần "trường" (`getSchools`/`getSchoolLinks`) đã gỡ cùng màn `/admin/schools`: BE không có
 * route liệt kê tổ chức, và "liên kết hai trường" không phải khái niệm tồn tại ở BE.
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

// ── STATE ───────────────────────────────────────────────────────────

const users: AdminUser[] = [
  { id: 1, name: 'Minh Vũ', avatar: 'MV', school: 'Hùng Vương', phone: '090 123 4567', posts: 6, sold: 3, rating: 4.9, status: 'ok', joined: '12/03/2026' },
  { id: 2, name: 'Thu Hà', avatar: 'TH', school: 'Cao Thắng', phone: '091 222 3344', posts: 9, sold: 6, rating: 4.8, status: 'ok', joined: '02/02/2026' },
  { id: 3, name: 'Đức Anh', avatar: 'ĐA', school: 'Hùng Vương', phone: '098 555 6677', posts: 5, sold: 1, rating: 3.6, status: 'locked', joined: '19/04/2026' },
  { id: 4, name: 'Gia Bảo', avatar: 'GB', school: 'Cao Thắng', phone: '096 888 1122', posts: 4, sold: 4, rating: 5, status: 'ok', joined: '28/01/2026' },
  { id: 5, name: 'Khánh Linh', avatar: 'KL', school: 'Cao Thắng', phone: '097 444 8899', posts: 3, sold: 0, rating: 0, status: 'unverified', joined: '11/08/2026' },
  { id: 6, name: 'Hoàng Nam', avatar: 'HN', school: 'Hùng Vương', phone: '094 777 2211', posts: 0, sold: 0, rating: 0, status: 'unverified', joined: '12/08/2026' },
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
};
