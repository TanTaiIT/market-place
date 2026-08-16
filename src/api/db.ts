import type { Grad } from '@/theme';
import type { ProvinceName } from './location';

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
  /**
   * Id danh mục + tỉnh giữ nguyên bên cạnh bản hiển thị (`cat`): đây là hai tiêu chí đi tìm
   * tin gợi ý, mà tìm theo TÊN danh mục thì hỏng ngay khi có hai danh mục trùng tên.
   */
  categoryId: string;
  /** Tên tỉnh như BE lưu trong `location.province` — cũng chính là giá trị `?province=` nhận. */
  province?: string;
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
export type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  /**
   * Mã client tự sinh trước khi gửi, BE trả lại nguyên vẹn. Là **khoá render** của tin nhắn:
   * `id` thật chỉ có sau khi server ghi xong, nên dùng nó làm key thì bong bóng vừa vẽ sẽ đổi
   * khoá giữa chừng và danh sách dựng lại đúng dòng đó. Tin cũ và tin của người dùng bản cũ
   * không có mã này — lúc đó `id` là khoá, và nó vốn đã ổn định.
   */
  clientMsgId?: string;
};

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

/**
 * Thông báo trong tổ chức.
 *
 * `kind` cũ có ba giá trị `org | chain | system`; `chain` là khái niệm đã bị xoá khỏi hệ thống
 * ở v2, còn `system` thì BE chưa từng có. Thay bằng thứ BE thật sự phân biệt: gửi cho cả tổ
 * chức hay gửi riêng cho nhóm con của mình.
 */
export type Notif = {
  id: string;
  scope: 'org' | 'unit';
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
  /** Không có `role`: vai trò là quan hệ, đọc qua `useMyGrants` / `useMyOrgs` chứ không ở hồ sơ. */
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

/**
 * Bộ lọc của màn tìm kiếm.
 *
 * Mọi field rỗng đều mang đúng một nghĩa: KHÔNG ràng buộc — ứng với việc không gửi param đó
 * lên BE. Nhờ vậy không cần cờ "đã bật lọc chưa" nằm song song, thứ luôn lệch với giá trị thật.
 *
 * Giá là `number | null` chứ không phải chuỗi: ô nhập giữ chuỗi thô (người dùng gõ dở "50"),
 * còn tới tầng này thì nó đã phải là số hoặc không có gì.
 */
export type SearchFilter = {
  q: string;
  province: ProvinceName | null;
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

export const EMPTY_SEARCH: SearchFilter = {
  q: '',
  province: null,
  categoryId: null,
  minPrice: null,
  maxPrice: null,
};

/**
 * Có ràng buộc nào không. Dùng chung cho hai việc: query quyết định có bay hay không, và màn
 * hình quyết định hiện lời mời "nhập từ khoá" hay "không tìm thấy" — hai câu trả lời phải
 * đến từ cùng một phép tính, nếu không sẽ có lúc màn báo rỗng trong khi query chưa hề chạy.
 */
export const hasSearchCriteria = (f: SearchFilter): boolean =>
  f.q.trim().length > 0 ||
  f.province !== null ||
  f.categoryId !== null ||
  f.minPrice !== null ||
  f.maxPrice !== null;

/** Số bộ lọc đang bật, KHÔNG tính từ khoá — nó có ô riêng, không nằm trong ngăn lọc. */
export const activeFilterCount = (f: SearchFilter): number =>
  [f.province, f.categoryId, f.minPrice, f.maxPrice].filter((v) => v !== null).length;

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
