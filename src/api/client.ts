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
  listingCreate,
  listingGetById,
  listingList,
  listingMine,
  listingQuota,
  listingRemove,
  listingUpdate,
  locationProvinces,
  locationWards,
  notificationList,
  notificationMarkRead,
  userGetById,
  userGetMe,
  userUpdateMe,
} from './generated';
import type {
  AuthResponse,
  Conversation as ConversationDto,
  Listing as ListingDto,
  MeProfile,
  Message as MessageDto,
  PublicProfile as PublicProfileDto,
} from './generated';
import type { Province, ProvinceName } from './location';
import { CHAT_COLORS, db, hasSearchCriteria, NEW_PHOTOS } from './db';
import type {
  AuthSession,
  Category,
  Conversation,
  Listing,
  Message,
  Notif,
  Profile,
  PublicProfile,
  SearchFilter,
} from './db';
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

/**
 * Trả về **cụm hoàn chỉnh**, đã gồm chữ "trước".
 *
 * Trước đây hàm trả "5 phút" rồi mỗi call-site tự nối ` trước`, nhưng nhánh dưới 1 phút trả
 * "vừa xong" — nối vào thành "vừa xong trước". Hậu tố thuộc về chỗ biết mình đang ở nhánh nào.
 */
export function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
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
    sellerId: dto.seller,
    title: dto.title,
    price: formatPrice(dto.price),
    priceValue: dto.price,
    // BE trả `category` là ObjectId; tên hiển thị tra từ từ điển danh mục. Không tra được
    // thì để rỗng — `NoteCard` tự giấu pill, tin vẫn đọc được bình thường.
    cat: names.get(dto.category) ?? '',
    categoryId: dto.category,
    province: dto.location?.province,
    ward: dto.location?.ward,
    address: dto.location?.address,
    visibility: dto.visibility,
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
 * Phiên KHÔNG mang tổ chức nữa: v2 tách org khỏi danh tính. Org là lựa chọn theo từng request
 * (`X-Org-Slug`) và sống ở `stores/auth.activeOrgSlug`.
 */
function toSession(auth: AuthResponse): AuthSession {
  return {
    userId: auth.user.id,
    email: auth.user.email,
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

/**
 * Hồ sơ công khai. Không map email/phone vì BE không trả — xem `PublicProfile` trong `db.ts`.
 */
function toPublicProfile(dto: PublicProfileDto): PublicProfile {
  const joined = new Date(dto.createdAt);
  return {
    id: dto.id,
    name: dto.name,
    avatar: dto.avatar || initialsOf(dto.name),
    rating: dto.ratingCount > 0 ? dto.ratingAvg.toFixed(1) : '—',
    ratingCount: dto.ratingCount,
    // Ghép tay, không `toLocaleDateString`: Hermes không có Intl đầy đủ (cùng lý do `clockTime`).
    joined: `tháng ${joined.getMonth() + 1}/${joined.getFullYear()}`,
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

/**
 * Thứ người đăng gõ ra ở form tin — chung cho cả tạo mới lẫn sửa. `price` là chuỗi vì nó tới
 * thẳng từ `TextInput`; chuẩn hoá thành số là việc của `toListingBody`, không phải của màn hình.
 */
type ListingInput = {
  title: string;
  price: string;
  desc: string;
  categoryId: string;
  photoUrls?: string[];
  address?: string | null;
  province?: ProvinceName | null;
  ward?: string | null;
  /**
   * Nơi tin sẽ hiển thị — và cũng là thứ quyết định AI DUYỆT nó (BE §0.1): `org_internal`
   * về hàng đợi của tổ chức, `public` về hàng đợi manager danh mục theo (danh mục × tỉnh).
   * Bỏ trống thì BE mặc định `org_internal`.
   */
  visibility?: 'org_internal' | 'public';
};

/**
 * Payload gửi lên BE, dùng chung cho `POST /listings` và `PATCH /listings/{id}`.
 *
 * Một chỗ duy nhất chuẩn hoá giá và gom `location`: hai đường đi tới cùng một schema, tách đôi
 * thì lần sau chỉ sửa một nhánh là tin sửa xong lại rơi mất `provinceCode` mà tin mới vẫn đúng.
 *
 * `location` chỉ gửi khi người đăng đã chọn khu vực, và KHÔNG có toạ độ — BE đã bỏ hẳn geo,
 * gửi kèm `coordinates` giờ là 400. "Tin gần đây" chạy theo xã/tỉnh chứ không theo bán kính.
 *
 * `address` là số nhà / tên đường tự gõ, nằm dưới xã trong mô hình 2 cấp — không phải cấp
 * quận/huyện đã bỏ từ 01/07/2025.
 */
function toListingBody(input: ListingInput) {
  // Ô giá là `number-pad` nhưng vẫn lọt dấu phân cách người dùng tự gõ; BE nhận `number`.
  const price = Number(input.price.replace(/\D/g, ''));

  // Gom từng mảnh có thật rồi mới quyết định gửi hay không: gắn `address` vào nhánh
  // `if (province)` cũ sẽ nuốt mất địa chỉ của người chỉ gõ đường mà chưa chọn tỉnh.
  const address = input.address?.trim();
  const location = {
    ...(address ? { address } : {}),
    ...(input.province ? { province: input.province } : {}),
    ...(input.ward ? { ward: input.ward } : {}),
  };

  return {
    title: input.title.trim(),
    description: input.desc.trim(),
    price,
    categoryId: input.categoryId,
    images: input.photoUrls ?? [],
    // `location: {}` rỗng qua được `.strict()` của BE nhưng tạo ra bản ghi không lọc
    // được theo gì — thà vắng hẳn field.
    ...(Object.keys(location).length ? { location } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    // Tin công khai BẮT BUỘC có tỉnh: nó là thứ chọn ra người duyệt. Gửi kèm tường minh
    // thay vì để BE suy từ tổ chức — người đăng tin công khai có thể không thuộc org nào.
    ...(input.visibility === 'public' && input.province ? { provinceCode: input.province } : {}),
  };
}

export const api = {
  /* ---------------- auth ---------------- */
  /** Email unique TOÀN CỤC ở v2, nên email + mật khẩu là đủ — không cần biết tổ chức nào. */
  async login(email: string, password: string): Promise<AuthSession> {
    const res = await authLogin({ body: { email, password } });
    return toSession(unwrap(res, 'Đăng nhập không thành công, kiểm tra lại email và mật khẩu'));
  },

  /**
   * Đăng ký chỉ tạo TÀI KHOẢN, không tạo tổ chức.
   *
   * Ở v2 chỉ master tạo được org; người dùng vào tổ chức bằng đơn xin tham gia
   * (`POST /join-requests`). `registerSchema` của BE là `.strict()`, nên app còn gửi kèm
   * `organizationName` như bản cũ sẽ ăn 400 "Validation failed" chứ không phải lỗi nghiệp vụ.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthSession> {
    const res = await authRegister({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        phone: input.phone,
      },
    });
    return toSession(unwrap(res, 'Tạo tài khoản không thành công'));
  },

  /**
   * Đổi refresh token lấy cặp token mới. BE **rotate cả hai** và trả kèm user, nên phải ghi lại
   * trọn phiên chứ không chỉ `accessToken` — giữ refresh token cũ là lần refresh sau sẽ 401.
   *
   * Không đi qua `getCurrentUserId()`/session ở module scope: hàm này chạy đúng lúc access token
   * đã hết hạn, nên refresh token phải do caller truyền vào.
   */
  async refreshSession(refreshToken: string): Promise<AuthSession> {
    const res = await authRefresh({ body: { refreshToken } });
    return toSession(unwrap(res, 'Phiên đăng nhập đã hết, đăng nhập lại nhé'));
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

  /**
   * Tin gợi ý cho một tin đang xem.
   *
   * Lọc CỨNG theo danh mục, còn tỉnh chỉ dùng để XẾP TRƯỚC. Lọc cứng cả hai thì ở tỉnh thưa
   * tin người xem nhận về khoảng trống, trong khi một món cùng loại ở tỉnh khác vẫn là thứ họ
   * muốn thấy — cùng lập luận BE đã chốt cho `ward` ở `/listings/nearby`.
   *
   * Tải rộng hơn số hiển thị rồi mới cắt: `/listings` không có tham số `exclude` nên chính tin
   * đang xem luôn nằm trong kết quả, và xếp theo tỉnh chỉ có ý nghĩa khi có đủ tin để xếp —
   * lấy đúng `take` phần tử thì thứ tự trả về gần như y nguyên của BE.
   */
  async getSuggestions(current: Pick<Listing, 'id' | 'categoryId' | 'province'>, take: number) {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingList({ query: { limit: take * 3, category: current.categoryId } })),
      categoryNames(),
    ]);

    const rows = unwrap(res, 'Không tải được tin gợi ý')
      .map((l) => toListing(l, names))
      .filter((l) => l.id !== current.id);

    // Tách hai nhóm rồi nối, thay vì `sort` với comparator hoà nhau: cách này giữ nguyên thứ
    // tự mới-nhất-trước của BE trong từng nhóm mà không phải tin vào tính ổn định của `sort`.
    const sameProvince = rows.filter((l) => l.province === current.province);
    const elsewhere = rows.filter((l) => l.province !== current.province);
    return [...sameProvince, ...elsewhere].slice(0, take);
  },

  async getListing(id: string): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingGetById({ path: { id } })),
      categoryNames(),
    ]);
    return toListing(unwrap(res, 'Không tìm thấy tin này'), names);
  },

  /**
   * `province` phải là đúng chuỗi trong danh sách của `/locations/provinces` — BE so khớp chính
   * xác, gửi "TP. Hồ Chí Minh" thay vì "Hồ Chí Minh" giờ là 400 chứ không còn im lặng trả rỗng.
   */
  async searchListings(filter: SearchFilter): Promise<Listing[]> {
    // Không ràng buộc nào thì đây là "tất cả tin", không phải một lượt tìm — trả rỗng để màn
    // hình hiện lời mời nhập, thay vì đổ nguyên bảng tin vào ô kết quả tìm kiếm.
    if (!hasSearchCriteria(filter)) return [];

    const term = filter.q.trim();
    const [res, names] = await Promise.all([
      withAuthRetry(() =>
        listingList({
          // Bỏ hẳn field khi rỗng chứ không gửi `undefined`/`null`: `listingQuerySchema` của BE
          // coi `minPrice: null` là có mặt và ép kiểu, còn vắng mặt mới là "không lọc".
          query: {
            limit: 50,
            ...(term ? { q: term } : {}),
            ...(filter.province ? { province: filter.province } : {}),
            ...(filter.categoryId ? { category: filter.categoryId } : {}),
            ...(filter.minPrice !== null ? { minPrice: filter.minPrice } : {}),
            ...(filter.maxPrice !== null ? { maxPrice: filter.maxPrice } : {}),
          },
        }),
      ),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tìm được tin nào').map((l) => toListing(l, names));
  },

  /**
   * Dùng `/listings/mine` chứ KHÔNG phải `/listings?seller=<id>`: cái sau lọc cứng về `active`
   * nên tin vừa ghim (luôn ở `pending`) sẽ không xuất hiện, và người đăng tưởng là đăng hụt.
   */
  async getMyListings(): Promise<Listing[]> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingMine({ query: { limit: 50 } })),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được tin của bạn').map((l) => toListing(l, names));
  },

  /**
   * Tin mới vào BE ở trạng thái `pending` chờ duyệt, nên nó KHÔNG hiện ngay ngoài feed —
   * `/listings` chỉ trả tin `active`. Người đăng thấy nó ở "Tin của tôi".
   */
  async createListing(input: ListingInput): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingCreate({ body: toListingBody(input) })),
      categoryNames(),
    ]);
    return toListing(unwrap(res, 'Không ghim được tin lên bảng'), names);
  },

  /**
   * Sửa tin của chính mình. BE trả 403 cho tin của người khác — không cần tự kiểm ở đây, và
   * cũng không nên: chủ tin là thứ server biết chắc, app chỉ đang cầm một bản chụp.
   *
   * Gửi TRỌN payload chứ không chỉ field đã đổi. `UpdateListing` khai mọi field optional theo
   * nghĩa "bỏ qua field này", nên gửi thiếu `images` sau khi người dùng vừa gỡ một ảnh sẽ giữ
   * nguyên bộ ảnh cũ — thao tác xoá ảnh im lặng không có tác dụng, kiểu hỏng khó thấy nhất.
   */
  async updateListing({ id, ...input }: ListingInput & { id: string }): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingUpdate({ path: { id }, body: toListingBody(input) })),
      categoryNames(),
    ]);
    return toListing(unwrap(res, 'Không lưu được thay đổi'), names);
  },

  /**
   * Còn bao nhiêu slot đăng tin.
   *
   * BE chặn theo số tin ĐANG CHỜ DUYỆT, không theo tổng số tin: người dùng chỉ tạo thêm việc
   * cho người duyệt khi việc cũ đã được xử lý. Không hiện con số này ra thì lúc bị chặn họ chỉ
   * thấy một lỗi 409 và đổ cho app hỏng.
   */
  async getQuota(): Promise<{ limit: number; pending: number; remaining: number; allowed: boolean }> {
    const res = await withAuthRetry(() => listingQuota());
    return unwrap(res, 'Không đọc được hạn mức đăng tin');
  },

  /* ---------------- địa giới hành chính ---------------- */

  /**
   * `withAuthRetry` như mọi call khác, dù BE khai hai route này là công khai: `createClientConfig`
   * gắn Bearer cho MỌI request, nên token hết hạn vẫn làm chúng 401 — mà `post.tsx` bắt buộc chọn
   * tỉnh/xã, nên picker rỗng là người dùng kẹt hẳn, phải khởi động lại app.
   *
   * Không sợ lỗi mạng thường bị kéo vào vòng refresh: `withAuthRetry` trả thẳng kết quả khi chưa
   * có phiên, còn `isDeadSession` đọc `response?.status` — lỗi transport không có status nên
   * không bao giờ khớp.
   */
  async getProvinces(): Promise<Province[]> {
    const res = await withAuthRetry(() => locationProvinces());
    return unwrap(res, 'Không tải được danh sách tỉnh/thành');
  },

  async getWards(province: ProvinceName): Promise<string[]> {
    const res = await withAuthRetry(() => locationWards({ query: { province } }));
    return unwrap(res, 'Không tải được danh sách phường/xã').wards;
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
  /**
   * BE đã lọc sẵn theo người gọi: thông báo cả tổ chức + thông báo của đúng nhóm con họ thuộc.
   * Tài khoản chưa thuộc tổ chức nào nhận mảng rỗng chứ không phải lỗi, nên không cần guard.
   */
  async getNotifications(): Promise<Notif[]> {
    const res = await withAuthRetry(() => notificationList({ query: { limit: 50 } }));
    return unwrap(res, 'Không tải được thông báo').map((n) => ({
      id: n.id,
      scope: n.unitId ? ('unit' as const) : ('org' as const),
      title: n.title,
      body: n.body,
      time: relativeTime(n.createdAt),
      unread: !n.isRead,
    }));
  },

  async markNotificationRead(id: string): Promise<void> {
    const res = await withAuthRetry(() => notificationMarkRead({ path: { id } }));
    unwrap(res, 'Không đánh dấu được đã đọc');
  },

  async getProfile(): Promise<Profile> {
    const res = await withAuthRetry(() => userGetMe());
    return toProfile(unwrap(res, 'Không tải được hồ sơ'));
  },

  /**
   * Hồ sơ công khai của một người bán.
   *
   * `withAuthRetry` như mọi call khác dù BE khai route này công khai: `createClientConfig` gắn
   * Bearer cho MỌI request, nên token hết hạn vẫn làm nó 401 (cùng lý do với `/locations/*`).
   */
  async getSellerProfile(id: string): Promise<PublicProfile> {
    const res = await withAuthRetry(() => userGetById({ path: { id } }));
    return toPublicProfile(unwrap(res, 'Không tìm thấy người bán này'));
  },

  /**
   * Tin đang bán của một người. Đi qua `/listings?seller=` chứ không phải `/listings/mine`:
   * bộ lọc cứng về `active` của nó đúng ở đây — khách xem hồ sơ không được thấy tin chờ duyệt
   * hay tin bị từ chối của người khác.
   */
  async getSellerListings(id: string): Promise<Listing[]> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingList({ query: { limit: 50, seller: id } })),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được tin của người bán này').map((l) => toListing(l, names));
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
