import {
  authLogin,
  authRegister,
  listingGetById,
  listingList,
  listingRemove,
  notificationList,
  userGetMe,
  userUpdateMe,
} from './generated';
import type { Listing as ListingDto, MeProfile, Notification as NotifDto } from './generated';
import { CHAT_COLORS, db, NEW_PHOTOS } from './db';
import type { AuthSession, Conversation, Listing, Message, Notif, Profile } from './db';
import { getCurrentUserId } from './http';

/**
 * Lớp truy cập dữ liệu. Tin đăng / hồ sơ / thông báo đi qua SDK generated (BE `market` thật);
 * tin đã lưu và chat vẫn local vì BE chưa có endpoint (`/chats` trả 501, favorite chưa có route).
 *
 * Mọi hàm ném `Error` với thông điệp tiếng Việt khi thất bại — call-site hiện nó bằng một
 * `toast` duy nhất (query.convention §5), không hàm nào trả `null` im lặng.
 */

// ── SDK UNWRAP ──────────────────────────────────────────────────────

type SdkResult<T> = { data?: { data: T }; error?: unknown };

/** SDK không throw: nó trả `{ data, error }`. Dồn cả hai nhánh về Error tiếng Việt. */
function unwrap<T>(res: SdkResult<T>, fallback: string): T {
  if (res.error) {
    const message = (res.error as { message?: unknown }).message;
    throw new Error(typeof message === 'string' && message ? message : fallback);
  }
  if (!res.data) throw new Error(fallback);
  return res.data.data;
}

// ── MAPPER: DTO → domain ────────────────────────────────────────────

/** Hermes không có Intl đầy đủ nên `toLocaleString` không tin được — chấm nghìn bằng tay. */
function formatPrice(price: number): string {
  if (price <= 0) return 'Free';
  return `${String(Math.round(price)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Gradient chọn theo id để một tin luôn có cùng màu giữa các lần render. */
function gradOf(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return NEW_PHOTOS[sum % NEW_PHOTOS.length];
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

function toListing(dto: ListingDto): Listing {
  return {
    id: dto._id,
    title: dto.title,
    price: formatPrice(dto.price),
    // BE trả `category` dạng ObjectId; đổi id -> tên hiển thị cần GET /categories (BE trả 501).
    cat: '',
    // BE không trả tên organization trong Listing, nên meta chỉ còn mốc thời gian.
    meta: relativeTime(dto.createdAt),
    photo: gradOf(dto._id),
    photoUrls: dto.images,
    seller: dto.posterName,
    avatar: initialsOf(dto.posterName),
    contact: dto.posterContact,
    desc: dto.description,
    // UI chỉ có hai trạng thái; 5 trạng thái còn lại của BE đều là "chưa hiển thị".
    status: dto.status === 'active' ? 'live' : 'pending',
    mine: dto.seller === getCurrentUserId(),
  };
}

function toProfile(dto: MeProfile): Profile {
  return {
    name: dto.name,
    // `org`, `posted`, `sold` chưa có trong MeProfile của BE — hiện chỗ trống thay vì số bịa.
    org: '',
    phone: dto.phone ?? '',
    avatar: dto.avatar || initialsOf(dto.name),
    posted: 0,
    sold: 0,
    rating: dto.ratingCount > 0 ? dto.ratingAvg.toFixed(1) : '—',
  };
}

const NOTIF_ICON: Record<string, string> = { organization: '🏫', chain: '🔗' };
const NOTIF_BADGE: Record<string, string> = { organization: 'Từ trường', chain: 'Từ hệ thống' };

function toNotif(dto: NotifDto): Notif {
  const me = getCurrentUserId();
  return {
    id: dto._id,
    icon: NOTIF_ICON[dto.sourceType] ?? '📌',
    kind: dto.sourceType === 'chain' ? 'chain' : 'org',
    badge: NOTIF_BADGE[dto.sourceType],
    title: dto.title,
    body: dto.body,
    time: `${relativeTime(dto.createdAt)} trước`,
    unread: me ? !dto.readBy.includes(me) : true,
  };
}

// ── LOCAL HELPERS (phần chưa có BE) ─────────────────────────────────

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const AUTO_REPLIES = [
  'Dạ bạn ơi, để mình xem lại rồi nhắn bạn nha 😊',
  'Vẫn còn bạn nhé, bạn qua lấy lúc nào cũng được!',
  'Cảm ơn bạn đã quan tâm nha!',
  'Ok bạn, mình rep liền á 👍',
];

export const api = {
  /* ---------------- auth ---------------- */
  async login(email: string, password: string, orgSlug?: string): Promise<AuthSession> {
    const res = await authLogin({ body: { email, password, orgSlug } });
    const auth = unwrap(res, 'Đăng nhập không thành công, kiểm tra lại email và mật khẩu');
    return {
      userId: auth.user.id,
      email: auth.user.email,
      orgSlug,
      accessToken: auth.tokens.accessToken,
      refreshToken: auth.tokens.refreshToken,
    };
  },

  /**
   * BE `POST /auth/register` tạo **Organization mới + owner đầu tiên**, không phải thêm người
   * vào tổ chức có sẵn. Muốn tham gia tổ chức đã tồn tại thì phải chờ endpoint invite của BE.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
    phone?: string;
  }): Promise<AuthSession> {
    const res = await authRegister({ body: input });
    const auth = unwrap(res, 'Tạo tài khoản không thành công');
    return {
      userId: auth.user.id,
      email: auth.user.email,
      accessToken: auth.tokens.accessToken,
      refreshToken: auth.tokens.refreshToken,
    };
  },

  /* ---------------- listings ---------------- */
  /**
   * `cat` chưa lọc được: BE nhận `category` là ObjectId còn app chỉ có tên hiển thị, và
   * `GET /categories` (chỗ đổi tên -> id) đang trả 501. Nhận tham số để giữ chữ ký cho hook.
   */
  async getListings(_cat = 'Tất cả'): Promise<Listing[]> {
    const res = await listingList({ query: { limit: 50 } });
    return unwrap(res, 'Không tải được bảng tin').map(toListing);
  },

  async getListing(id: string): Promise<Listing> {
    const res = await listingGetById({ path: { id } });
    return toListing(unwrap(res, 'Không tìm thấy tin này'));
  },

  async searchListings(q: string): Promise<Listing[]> {
    const term = q.trim();
    if (!term) return [];
    const res = await listingList({ query: { q: term, limit: 50 } });
    return unwrap(res, 'Không tìm được tin nào').map(toListing);
  },

  async getMyListings(): Promise<Listing[]> {
    const seller = getCurrentUserId();
    if (!seller) throw new Error('Phiên đăng nhập đã hết, đăng nhập lại nhé');
    const res = await listingList({ query: { seller, limit: 50 } });
    return unwrap(res, 'Không tải được tin của bạn').map(toListing);
  },

  /**
   * Chưa gọi được BE: `POST /listings` bắt buộc `categoryId` (24 hex) và `location.coordinates`.
   * Danh mục lấy từ `GET /categories` — đang 501, nên không có id hợp lệ nào để gửi.
   * Mở lại khi BE có `/categories` và app thu thập được toạ độ.
   */
  async createListing(_input: {
    title: string;
    price: string;
    desc: string;
    cat: string;
    photoUrls?: string[];
  }): Promise<Listing> {
    await delay(150);
    throw new Error('Đăng tin cần API danh mục của server, tính năng này chưa mở');
  },

  async deleteListing(id: string) {
    const res = await listingRemove({ path: { id } });
    unwrap(res, 'Không xoá được tin này');
    db.savedIds = db.savedIds.filter((s) => s !== id);
    return { id };
  },

  /* ---------------- saved (local, chưa có endpoint) ---------------- */
  async getSavedIds(): Promise<string[]> {
    await delay(120);
    return [...db.savedIds];
  },

  async getSavedListings(): Promise<Listing[]> {
    // Chưa có `GET /listings?ids=` nên phải lấy từng tin; danh sách lưu vốn ngắn.
    const found = await Promise.all(
      db.savedIds.map((id) => api.getListing(id).catch(() => null)),
    );
    return found.filter((l): l is Listing => l !== null);
  },

  async toggleSaved(id: string): Promise<string[]> {
    await delay(150);
    db.savedIds = db.savedIds.includes(id)
      ? db.savedIds.filter((s) => s !== id)
      : [...db.savedIds, id];
    return [...db.savedIds];
  },

  /* ---------------- chat (local, BE trả 501) ---------------- */
  async getConversations(): Promise<Conversation[]> {
    await delay(200);
    return clone(db.conversations);
  },

  async getConversation(id: number): Promise<Conversation> {
    await delay(150);
    const c = db.conversations.find((x) => x.id === id);
    if (!c) throw new Error('Cuộc trò chuyện không tồn tại');
    c.unread = false;
    return clone(c);
  },

  /** Mở (hoặc tạo mới) hội thoại cho một tin thật — thông tin người bán lấy từ BE. */
  async openConversationFor(listingId: string): Promise<Conversation> {
    const listing = await api.getListing(listingId);
    if (listing.mine) throw new Error('Đây là tin của bạn');

    let c = db.conversations.find((x) => x.listingId === listingId);
    if (!c) {
      c = {
        id: Math.max(0, ...db.conversations.map((x) => x.id)) + 1,
        listingId,
        name: listing.seller,
        avatar: listing.avatar,
        lastMsg: 'Bắt đầu cuộc trò chuyện',
        time: 'Vừa xong',
        unread: false,
        messages: [],
      };
      db.conversations.unshift(c);
    }
    c.unread = false;
    return clone(c);
  },

  async sendMessage(conversationId: number, text: string): Promise<Message> {
    await delay(220);
    const c = db.conversations.find((x) => x.id === conversationId);
    if (!c) throw new Error('Cuộc trò chuyện không tồn tại');
    const msg: Message = { id: `m${Date.now()}`, from: 'me', text, time: nowTime() };
    c.messages.push(msg);
    c.lastMsg = text;
    c.time = 'Vừa xong';
    c.unread = false;
    return clone(msg);
  },

  /** Đối phương "đang nhập..." rồi trả lời — chạy sau khi gửi tin */
  async fetchReply(conversationId: number): Promise<Message> {
    await delay(1400);
    const c = db.conversations.find((x) => x.id === conversationId);
    if (!c) throw new Error('Cuộc trò chuyện không tồn tại');
    const text = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    const msg: Message = { id: `m${Date.now()}`, from: 'them', text, time: nowTime() };
    c.messages.push(msg);
    c.lastMsg = text;
    c.time = 'Vừa xong';
    return clone(msg);
  },

  /* ---------------- misc ---------------- */
  async getNotifications(): Promise<Notif[]> {
    const res = await notificationList({ query: { limit: 50 } });
    return unwrap(res, 'Không tải được thông báo').map(toNotif);
  },

  async getProfile(): Promise<Profile> {
    const res = await userGetMe();
    return toProfile(unwrap(res, 'Không tải được hồ sơ'));
  },

  async updateProfile(input: Partial<Profile>): Promise<Profile> {
    const res = await userUpdateMe({
      // BE chỉ nhận ba field này; `org`/`posted`/`sold` không thuộc hồ sơ user.
      body: { name: input.name, phone: input.phone },
    });
    return toProfile(unwrap(res, 'Không lưu được hồ sơ'));
  },
};

export const chatColor = (index: number) => CHAT_COLORS[index % CHAT_COLORS.length];
