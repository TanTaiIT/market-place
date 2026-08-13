import {
  authLogin,
  authRefresh,
  authRegister,
  categoryList,
  chatGetById,
  chatList,
  chatMarkRead,
  chatMessages,
  chatOpen,
  chatSend,
  listingGetById,
  listingList,
  listingRemove,
  userGetMe,
  userUpdateMe,
} from './generated';
import type {
  AuthResponse,
  Conversation as ConversationDto,
  Listing as ListingDto,
  MeProfile,
  Message as MessageDto,
} from './generated';
import { CHAT_COLORS, db, NEW_PHOTOS } from './db';
import type { AuthSession, Category, Conversation, Listing, Message, Notif, Profile } from './db';
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
export function unwrap<TPayload>(res: SdkResult<TPayload>, fallback: string): TPayload {
  if (res.error) {
    const message = (res.error as { message?: unknown }).message;
    throw new Error(typeof message === 'string' && message ? message : fallback);
  }
  if (!res.data) throw new Error(fallback);
  return res.data.data;
}

// ── MAPPER: DTO → domain ────────────────────────────────────────────

/** Hermes không có Intl đầy đủ nên `toLocaleString` không tin được — chấm nghìn bằng tay. */
export function formatPrice(price: number): string {
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
export function gradOf(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return NEW_PHOTOS[sum % NEW_PHOTOS.length];
}

export function relativeTime(iso: string): string {
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
function toListing(dto: ListingDto, names: Map<string, string>): Listing {
  const isMine = dto.seller === getCurrentUserId();
  const sellerName = isMine ? 'Bạn' : dto.posterName || 'Người bán';

  return {
    id: dto._id,
    title: dto.title,
    price: formatPrice(dto.price),
    // BE trả `category` là ObjectId; tên hiển thị tra từ từ điển danh mục. Không tra được
    // thì để rỗng — `NoteCard` tự giấu pill, tin vẫn đọc được bình thường.
    cat: names.get(dto.category) ?? '',
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
    role: dto.role,
    posted: '—',
    sold: '—',
    rating: dto.ratingCount > 0 ? dto.ratingAvg.toFixed(1) : '—',
  };
}

function toConversation(dto: ConversationDto): Conversation {
  return {
    id: dto.id,
    listingId: dto.listingId,
    listingTitle: dto.listingTitle,
    name: dto.partnerName,
    avatar: initialsOf(dto.partnerName),
    lastMsg: dto.lastMessage || 'Bắt đầu cuộc trò chuyện',
    time: relativeTime(dto.lastMessageAt),
    unread: dto.unread,
  };
}

/** Giờ:phút của tin nhắn. Hermes không có Intl đầy đủ nên cắt tay, không `toLocaleTimeString`. */
function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toMessage(dto: MessageDto): Message {
  return {
    id: dto.id,
    from: dto.senderId === getCurrentUserId() ? 'me' : 'them',
    text: dto.text,
    time: clockTime(dto.createdAt),
    clientMsgId: dto.clientMsgId,
  };
}

/**
 * Payload từ socket không đi qua SDK nên không có gì bảo đảm hình dạng — kiểm tra tại chỗ
 * rồi mới dựng `Message`. Sai hình dạng trả `null` để call-site bỏ qua, đừng để một event
 * hỏng làm vỡ màn chat.
 */
export function messageFromSocket(payload: unknown): Message | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Partial<MessageDto>;
  if (
    typeof p.id !== 'string' ||
    typeof p.senderId !== 'string' ||
    typeof p.text !== 'string' ||
    typeof p.createdAt !== 'string'
  ) {
    return null;
  }
  // `clientMsgId` là khoá render nên không nhận bừa kiểu khác; hỏng field này thì bỏ riêng nó
  // và rơi về `id`, đừng vứt cả tin nhắn chỉ vì phần phụ trợ sai.
  const clientMsgId = typeof p.clientMsgId === 'string' ? p.clientMsgId : undefined;
  return toMessage({ ...p, clientMsgId } as MessageDto);
}

// ── LOCAL HELPERS (phần chưa có BE) ─────────────────────────────────

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Từ điển id → tên danh mục, đọc kèm mỗi lần lấy tin.
 *
 * Hỏng thì trả map rỗng chứ không ném: tên danh mục là phần trang trí của tin, còn bản thân
 * `/categories` hỏng đã được `useCategories()` bên hàng chip lọc báo rồi — ném thêm ở đây là
 * hai bề mặt lỗi cho cùng một sự cố.
 */
async function categoryNames(): Promise<Map<string, string>> {
  try {
    const res = await withAuthRetry(() => categoryList());
    return new Map(unwrap(res, 'Không tải được danh mục').map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}

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

  /* ---------------- categories ---------------- */
  /** Từ điển dùng chung toàn hệ thống — BE chỉ trả danh mục đang bật. */
  async getCategories(): Promise<Category[]> {
    const res = await withAuthRetry(() => categoryList());
    return unwrap(res, 'Không tải được danh mục').map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
    }));
  },

  /* ---------------- listings ---------------- */
  /** `categoryId` bỏ trống = tất cả. Lọc chạy ở BE, app không tự cắt mảng sau khi tải về. */
  async getListings(categoryId?: string): Promise<Listing[]> {
    // Không gửi `status`: `listingQuerySchema` của BE không khai field đó (chỉ caller nội bộ mới
    // được ép status), và `buildFilter` đã mặc định ACTIVE. Gửi thêm chỉ bị zod strip im lặng.
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingList({ query: { limit: 50, category: categoryId } })),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được bảng tin').map((l) => toListing(l, names));
  },

  async getListing(id: string): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingGetById({ path: { id } })),
      categoryNames(),
    ]);
    return toListing(unwrap(res, 'Không tìm thấy tin này'), names);
  },

  async searchListings(q: string): Promise<Listing[]> {
    const term = q.trim();
    if (!term) return [];
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingList({ query: { q: term, limit: 50 } })),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tìm được tin nào').map((l) => toListing(l, names));
  },

  async getMyListings(): Promise<Listing[]> {
    const seller = getCurrentUserId();
    if (!seller) throw new Error('Phiên đăng nhập đã hết, đăng nhập lại nhé');
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingList({ query: { seller, limit: 50 } })),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được tin của bạn').map((l) => toListing(l, names));
  },

  /**
   * Vẫn chưa gọi được BE, nhưng chỉ còn **một** thứ thiếu: `POST /listings` bắt buộc
   * `location.coordinates` mà app chưa xin quyền vị trí bao giờ. `categoryId` thì đã có thật
   * từ `GET /categories` rồi.
   *
   * Mở lại khi app thu thập được toạ độ (expo-location) — lúc đó bỏ hàm này và gọi thẳng
   * `listingCreate` của SDK.
   */
  async createListing(_input: {
    title: string;
    price: string;
    desc: string;
    categoryId: string;
    photoUrls?: string[];
  }): Promise<Listing> {
    await delay(150);
    throw new Error('Đăng tin cần vị trí của bạn, tính năng này chưa mở');
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

  /* ---------------- chat ---------------- */
  async getConversations(): Promise<Conversation[]> {
    const res = await withAuthRetry(() => chatList({ query: { limit: 50 } }));
    return unwrap(res, 'Không tải được tin nhắn').map(toConversation);
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await withAuthRetry(() => chatGetById({ path: { id } }));
    return toConversation(unwrap(res, 'Cuộc trò chuyện không tồn tại'));
  },

  /**
   * BE trả tin mới nhất trước (phân trang lấy từ cuối lên), còn màn chat render từ cũ tới mới.
   * Đọc ngược chỉ số thay vì `.reverse()`/`.sort()`: cả hai đều mutate mảng gốc và đều bị
   * oxlint chặn, mà ở đây chỉ cần đảo chiều đọc chứ không cần sắp xếp lại gì.
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await withAuthRetry(() =>
      chatMessages({ path: { id: conversationId }, query: { limit: 100 } }),
    );
    const rows = unwrap(res, 'Không tải được tin nhắn');
    return rows.map((_, i) => toMessage(rows[rows.length - 1 - i]));
  },

  /** Mở hội thoại cho một tin, hoặc lấy lại hội thoại đã có — BE chốt bằng unique index. */
  async openConversationFor(listingId: string): Promise<Conversation> {
    const res = await withAuthRetry(() => chatOpen({ body: { listingId } }));
    return toConversation(unwrap(res, 'Không mở được cuộc trò chuyện'));
  },

  /**
   * `clientMsgId` do call-site sinh trước khi vẽ bong bóng lạc quan và truyền xuống đây; BE lưu
   * rồi trả lại nguyên vẹn trong cả response lẫn sự kiện socket. Nhờ vậy bản thật ghép được với
   * bong bóng đang hiển thị mà không phải dò theo nội dung hay đổi khoá render giữa chừng.
   */
  async sendMessage(
    conversationId: string,
    text: string,
    clientMsgId?: string,
  ): Promise<Message> {
    const res = await withAuthRetry(() =>
      chatSend({ path: { id: conversationId }, body: { text, clientMsgId } }),
    );
    return toMessage(unwrap(res, 'Không gửi được tin nhắn'));
  },

  async markConversationRead(conversationId: string): Promise<Conversation> {
    const res = await withAuthRetry(() => chatMarkRead({ path: { id: conversationId } }));
    return toConversation(unwrap(res, 'Không cập nhật được trạng thái đã đọc'));
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

/**
 * Màu avatar hội thoại. Hash theo tên chứ không theo chỉ số hàng: cùng một người phải ra cùng
 * một màu ở mọi màn, mà chỉ số thì đổi mỗi lần danh sách sắp xếp lại theo tin mới nhất.
 */
export const chatColor = (name: string) =>
  CHAT_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % CHAT_COLORS.length];
