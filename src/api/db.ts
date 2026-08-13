import type { Grad } from '@/theme';

/**
 * Domain type của app + phần state còn nằm trong bộ nhớ.
 *
 * Tin đăng, hồ sơ và thông báo đã đọc từ BE thật (`client.ts` gọi SDK generated), nên fixture
 * của ba thứ đó đã bỏ. Chỉ còn **tin đã lưu** và **hội thoại** là local, vì BE chưa có endpoint
 * cho chúng: `/chats` trả 501 và favorite chưa có route nào (xem `client.ts`).
 */

export type Listing = {
  /** Mongo ObjectId 24 hex từ BE — không phải số, đừng `Number()` khi đọc route param. */
  id: string;
  title: string;
  price: string;
  cat: string;
  meta: string;
  /** Cặp màu dựng ảnh giả — dùng khi tin chưa có ảnh thật */
  photo: Grad;
  /** URL Cloudinary theo thứ tự người đăng chọn; phần tử **đầu tiên là ảnh bìa** */
  photoUrls?: string[];
  seller: string;
  avatar: string;
  contact: string;
  desc: string;
  status: 'live' | 'pending';
  mine: boolean;
};

/** `from` suy từ `senderId` so với người đang đăng nhập — UI chỉ cần biết bên nào. */
export type Message = { id: string; from: 'me' | 'them'; text: string; time: string };

export type Conversation = {
  /** ObjectId 24 hex của BE, không phải số. */
  id: string;
  listingId: string;
  /** Snapshot BE chốt lúc mở hội thoại — tin bị gỡ thì vẫn còn tiêu đề để hiện. */
  listingTitle: string;
  /** Người còn lại trong hội thoại. */
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: boolean;
};

export type Notif = {
  id: string;
  icon: string;
  kind: 'org' | 'chain' | 'system';
  badge?: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

/**
 * Danh tính trả về sau đăng nhập/đăng ký. `stores/auth.ts` khai lại type tương đương thay vì
 * import chỗ này — store là lá, không được import layer khác (folder.convention §6).
 */
export type AuthSession = {
  userId: string;
  email: string;
  orgSlug?: string;
  accessToken: string;
  refreshToken: string;
};

export type Profile = {
  name: string;
  org: string;
  phone: string;
  avatar: string;
  /** Vai trò BE trả ra — chuỗi tự do, xem `canOpenAdmin` bên `@/api/admin`. */
  role: string;
  /** Chuỗi chứ không phải số: BE chưa trả thống kê nào, nên `—` là giá trị hợp lệ. */
  posted: string;
  sold: string;
  rating: string;
};

/**
 * Danh mục lấy từ BE (`GET /categories`) chứ không còn là hằng số trong app: nó là từ điển
 * dùng chung toàn hệ thống, và `Listing.category` bên BE là ObjectId nên app phải giữ `id`
 * mới lọc và đăng tin được.
 */
export type Category = {
  id: string;
  name: string;
  icon: string;
};

/** State local — mất khi tắt app, đúng bản chất "chưa có BE" chứ không phải cache. */
export const db = {
  /** ObjectId của tin đã lưu. Chưa có endpoint favorite nên không đồng bộ giữa hai thiết bị. */
  savedIds: [] as string[],
};

export const CHAT_COLORS = ['#3F6B4A', '#D9A566', '#8C6539', '#6B7F8C', '#B98851'];

export const NEW_PHOTOS: Grad[] = [
  ['#EFCB9C', '#D9A566'],
  ['#C9D9C0', '#9FBF8E'],
  ['#C7C2D9', '#9E97BF'],
  ['#D9C2C2', '#BF9797'],
];
