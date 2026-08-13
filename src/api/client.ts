import {
  authLogin,
  authRefresh,
  authRegister,
  listingGetById,
  listingList,
  listingRemove,
  userGetMe,
  userUpdateMe,
} from './generated';
import type { AuthResponse, Listing as ListingDto, MeProfile } from './generated';
import { CHAT_COLORS, db, NEW_PHOTOS } from './db';
import type { AuthSession, Conversation, Listing, Message, Notif, Profile } from './db';
import { getCurrentUserId, withAuthRetry } from './http';

/**
 * Lớp truy cập dữ liệu. Tin đăng / hồ sơ / thông báo đi qua SDK generated (BE `market` thật);
 * tin đã lưu và chat vẫn local vì BE chưa có endpoint (`/chats` trả 501, favorite chưa có route).
 *
 * Mọi hàm ném `Error` với thông điệp tiếng Việt khi thất bại — call-site hiện nó bằng một
 * `toast` duy nhất (query.convention §5), không hàm nào trả `null` im lặng.
 */

// ── SDK UNWRAP ──────────────────────────────────────────────────────

type ApiEnvelope<TPayload> = { success: true; message: string; data: TPayload };
type SdkResult<TPayload> = { data?: ApiEnvelope<TPayload>; error?: unknown };

/**
 * SDK không throw: nó trả `{ data, error }`. Dồn cả hai nhánh về Error tiếng Việt.
 *
 * `TPayload` là payload **trong cùng** và luôn để TS tự suy từ kiểu SDK — đừng truyền type
 * argument bằng tay. Truyền `GetXxxResponse` (vốn là cả envelope) lệch đúng một tầng: TS vẫn
 * pass vì `.data` tồn tại trên kiểu, còn runtime đọc `.data` của mảng nên nổ `undefined`.
 */
function unwrap<TPayload>(res: SdkResult<TPayload>, fallback: string): TPayload {
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
  if (price <= 0) return 'Miễn phí';
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

/**
 * `seller` và `category` chỉ là ObjectId dạng chuỗi: BE cố tình **không** populate chúng —
 * populate `seller` sẽ đọc xuyên org và lách mất cách ly tenant, còn model `Category` thì chưa
 * tồn tại. Tên/liên hệ người đăng vì thế lấy từ snapshot `posterName`/`posterContact` mà BE chốt
 * lúc tạo tin, đúng như `listing.repository.ts` ghi.
 */
function toListing(dto: ListingDto): Listing {
  const isMine = dto.seller === getCurrentUserId();
  const sellerName = isMine ? 'Bạn' : dto.posterName || 'Người bán';

  return {
    id: dto._id,
    title: dto.title,
    price: formatPrice(dto.price),
    // Chỉ có id danh mục, chưa có tên -> để rỗng cho tới khi BE mở `GET /categories`. Hệ quả:
    // lọc theo chip danh mục ở bảng tin vẫn ra rỗng, đó là việc còn treo của BE.
    cat: '',
    // BE không trả tên organization trong Listing, nên meta chỉ còn mốc thời gian.
    meta: relativeTime(dto.createdAt),
    photo: gradOf(dto._id),
    photoUrls: dto.images,
    seller: sellerName,
    avatar: initialsOf(sellerName),
    contact: dto.posterContact,
    desc: dto.description,
    // UI chỉ có hai trạng thái; 5 trạng thái còn lại của BE đều là "chưa hiển thị".
    status: dto.status === 'active' ? 'live' : 'pending',
    mine: isMine,
  };
}

/**
 * Cả ba endpoint auth (`login`/`register`/`refresh`) trả cùng `AuthResponse`, nên phiên chỉ được
 * dựng ở đây — ba bản copy là ba chỗ có thể quên `refreshToken` mới sau khi BE rotate.
 *
 * `orgSlug` không có trong response: BE không trả slug, chỉ trả `organizationId`. Nó là thứ người
 * dùng tự nhập ở màn đăng nhập nên caller truyền lại vào để phiên còn nhớ cho lần sau.
 */
function toSession(auth: AuthResponse, orgSlug?: string): AuthSession {
  return {
    userId: auth.user.id,
    email: auth.user.email,
    orgSlug,
    accessToken: auth.tokens.accessToken,
    refreshToken: auth.tokens.refreshToken,
  };
}

function toProfile(dto: MeProfile): Profile {
  return {
    name: dto.name,
    // `org`, `posted`, `sold` chưa có trong MeProfile của BE. Trả `—` chứ không phải 0: số 0
    // hiện lên UI trông y hệt một thống kê thật, tức là con số bịa.
    org: '',
    phone: dto.phone ?? '',
    avatar: dto.avatar || initialsOf(dto.name),
    posted: '—',
    sold: '—',
    rating: dto.ratingCount > 0 ? dto.ratingAvg.toFixed(1) : '—',
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
  /**
   * `orgSlug` **phải** đi trong body: BE chỉ unique email theo `(organizationId, email)` nên
   * `authService.login` gọi `requireOrganizationId()`. Org lấy từ subdomain (web) hoặc `orgSlug`
   * (app) — thiếu cả hai thì `resolveTenant` không mở scope và login chết ở tầng tenant, không
   * phải vì sai mật khẩu. Đây là lý do tham số này không được nuốt như trước.
   */
  async login(email: string, password: string, orgSlug?: string): Promise<AuthSession> {
    const res = await authLogin({ body: { email, password, orgSlug } });
    const auth = unwrap(res, 'Đăng nhập không thành công, kiểm tra lại email và mật khẩu');
    return toSession(auth, orgSlug);
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
    organizationSlug?: string;
    phone?: string;
  }): Promise<AuthSession> {
    const res = await authRegister({
      // `registerSchema` của BE là `.strict()` và **bắt buộc** `organizationName`; bỏ nó đi thì
      // nhận 400 "Validation failed" chứ không phải lỗi nghiệp vụ nào.
      body: {
        organizationName: input.organizationName,
        organizationSlug: input.organizationSlug,
        name: input.name,
        email: input.email,
        password: input.password,
        phone: input.phone,
      },
    });
    const auth = unwrap(res, 'Tạo tài khoản không thành công');
    // Slug do BE sinh khi không truyền, và phiên sau đăng ký chưa biết nó là gì. Giữ slug người
    // dùng tự nhập (nếu có) để lần đăng nhập lại trên thiết bị khác còn điền đúng org.
    return toSession(auth, input.organizationSlug);
  },

  /**
   * Đổi refresh token lấy cặp token mới. BE **rotate cả hai** và trả kèm user, nên phải ghi lại
   * trọn phiên chứ không chỉ `accessToken` — giữ refresh token cũ là lần refresh sau sẽ 401.
   *
   * Không đi qua `getCurrentUserId()`/session ở module scope: hàm này chạy đúng lúc access token
   * đã hết hạn, nên refresh token phải do caller truyền vào.
   */
  async refreshSession(refreshToken: string, orgSlug?: string): Promise<AuthSession> {
    const res = await authRefresh({ body: { refreshToken } });
    const auth = unwrap(res, 'Phiên đăng nhập đã hết, đăng nhập lại nhé');
    return toSession(auth, orgSlug);
  },

  /* ---------------- listings ---------------- */
  /**
   * Chưa lọc theo danh mục: BE nhận `category` là ObjectId còn app chỉ có tên hiển thị, và
   * `GET /categories` (chỗ đổi tên -> id) đang trả 501. Mở lại tham số lọc khi BE có endpoint đó.
   */
  async getListings(): Promise<Listing[]> {
    // Không gửi `status`: `listingQuerySchema` của BE không khai field đó (chỉ caller nội bộ mới
    // được ép status), và `buildFilter` đã mặc định ACTIVE. Gửi thêm chỉ bị zod strip im lặng.
    const res = await withAuthRetry(() => listingList({ query: { limit: 50 } }));
    return unwrap(res, 'Không tải được bảng tin').map(toListing);
  },

  async getListing(id: string): Promise<Listing> {
    const res = await withAuthRetry(() => listingGetById({ path: { id } }));
    return toListing(unwrap(res, 'Không tìm thấy tin này'));
  },

  async searchListings(q: string): Promise<Listing[]> {
    const term = q.trim();
    if (!term) return [];
    const res = await withAuthRetry(() => listingList({ query: { q: term, limit: 50 } }));
    return unwrap(res, 'Không tìm được tin nào').map(toListing);
  },

  async getMyListings(): Promise<Listing[]> {
    const seller = getCurrentUserId();
    if (!seller) throw new Error('Phiên đăng nhập đã hết, đăng nhập lại nhé');
    const res = await withAuthRetry(() => listingList({ query: { seller, limit: 50 } }));
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
    const res = await withAuthRetry(() => listingRemove({ path: { id } }));
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
        // Chốt tiêu đề ngay tại đây: đây là chỗ duy nhất đã có sẵn listing, nên màn danh sách
        // chat không phải kéo cả bảng tin về chỉ để tra một cái tên.
        listingTitle: listing.title,
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
    await delay(120);
    return [];
  },

  async getProfile(): Promise<Profile> {
    const res = await withAuthRetry(() => userGetMe());
    return toProfile(unwrap(res, 'Không tải được hồ sơ'));
  },

  async updateProfile(input: Partial<Profile>): Promise<Profile> {
    const res = await withAuthRetry(() =>
      userUpdateMe({
        // BE chỉ nhận ba field này; `org`/`posted`/`sold` không thuộc hồ sơ user.
        body: { name: input.name, phone: input.phone },
      }),
    );
    return toProfile(unwrap(res, 'Không lưu được hồ sơ'));
  },
};

export const chatColor = (index: number) => CHAT_COLORS[index % CHAT_COLORS.length];
