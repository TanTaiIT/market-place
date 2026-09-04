import {
  authLogin,
  authRefresh,
  authRegister,
  categoryGetTemplate,
  categoryList,
  chatGetById,
  chatList,
  chatMarkRead,
  chatMessages,
  chatOpen,
  chatSend,
  favoriteAdd,
  favoriteIds,
  favoriteList,
  favoriteRemove,
  listingCreate,
  listingGetById,
  listingList,
  listingMine,
  listingQuota,
  listingMarkSold,
  listingRemove,
  listingRenew,
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
import { CHAT_COLORS, hasSearchCriteria, NEW_PHOTOS } from './db';
import type {
  AuthSession,
  Category,
  CategoryTemplate,
  Conversation,
  Listing,
  ListingAttributes,
  Message,
  Notif,
  PostingQuota,
  Profile,
  PublicProfile,
  SearchFilter,
} from './db';
import {
  ORG_HEADER, getCurrentUserId, withAuthRetry } from './http';

/**
 * Lớp truy cập dữ liệu — toàn bộ đi qua SDK generated (BE `market` thật), không còn stub local.
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
    const err = res.error as { message?: unknown; details?: { message?: string }[] };
    // Lỗi validation của BE mang câu trả lời THẬT trong `details`, còn `message` chỉ là
    // "Validation failed" — hiện mỗi câu đó thì người dùng không biết sửa gì. Lấy chi tiết
    // đầu tiên: một lỗi đọc được còn hơn ba lỗi in đè nhau trong một toast.
    const detail = err.details?.find((d) => d.message)?.message;
    const message = typeof err.message === 'string' && err.message ? err.message : fallback;
    throw new Error(detail ? `${message}: ${detail}` : message);
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

/** Chữ viết tắt vẽ trong vòng tròn khi người dùng chưa có ảnh thật — xem `Avatar`. */
export function initialsOf(name: string): string {
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
 * Nhãn hạn hiển thị, nói theo NGÀY.
 *
 * Ngày chứ không giờ: hạn tin là 30 ngày nên "còn 2 ngày" là thông tin, còn "còn 47 giờ" là
 * đố người đọc tự chia. Trả `undefined` khi tin còn dài hạn — call-site giấu dòng đó đi thay
 * vì hiện một con số không ai cần.
 */
export function expiryLabel(expiresAt: string | undefined, expired: boolean, within = 7) {
  if (!expiresAt) return expired ? 'Đã hết hạn' : undefined;

  const days = Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (expired) {
    if (days >= 0) return 'Đã hết hạn';
    return days === -1 ? 'Hết hạn hôm qua' : `Hết hạn ${-days} ngày trước`;
  }
  if (days > within) return undefined;
  if (days <= 0) return 'Hết hạn hôm nay';
  return days === 1 ? 'Còn 1 ngày' : `Còn ${days} ngày`;
}

/**
 * `seller` và `category` chỉ là ObjectId dạng chuỗi: BE cố tình **không** populate chúng —
 * populate `seller` sẽ đọc xuyên org và lách mất cách ly tenant, còn model `Category` thì chưa
 * tồn tại. Tên/liên hệ người đăng vì thế lấy từ snapshot `posterName`/`posterContact` mà BE chốt
 * lúc tạo tin, đúng như `listing.repository.ts` ghi.
 */
/**
 * 8 trạng thái BE → 4 trạng thái UI.
 *
 * `expired` và `sold` phải đi RIÊNG vì mỗi cái mở ra một hành động khác: hết hạn thì hiện nút
 * gia hạn, đã bán thì không hiện gì. Gộp chúng vào `pending` (như bản trước) là hứa với chủ
 * tin rằng tin đang chờ duyệt, và họ ngồi đợi một hàng đợi không tồn tại.
 */
function toStatus(status: ListingDto['status']): Listing['status'] {
  if (status === 'active') return 'live';
  if (status === 'expired') return 'expired';
  if (status === 'sold') return 'sold';
  return 'pending';
}

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
    meta: relativeTime(dto.createdAt),
    organizationId: dto.organizationId,
    photo: gradOf(dto._id),
    photoUrls: dto.images,
    seller: sellerName,
    avatar: initialsOf(sellerName),
    avatarUrl: dto.posterAvatar || undefined,
    contact: dto.posterContact,
    desc: dto.description,
    // BE đã ép kiểu qua template nên nhận nguyên, không `String()` lại — form sửa tin cần đúng
    // kiểu để switch và dropdown chọn lại được lựa chọn cũ.
    attributes: dto.attributes as ListingAttributes | undefined,
    templateVersion: dto.templateRef?.version,
    status: toStatus(dto.status),
    expiresAt: dto.expiresAt ?? undefined,
    mine: isMine,
    viewCount: dto.viewCount,
    favoriteCount: dto.favoriteCount,
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
    // Hai field tách nhau: `avatar` là chữ viết tắt để vẽ vòng tròn khi CHƯA có ảnh, `avatarUrl`
    // là ảnh thật. Nhồi cả hai vào một field thì call-site phải tự đoán mình đang giữ URL hay
    // hai chữ cái — và `Avatar` component thì chỉ nhận chữ.
    avatar: initialsOf(dto.name),
    avatarUrl: dto.avatar || undefined,
    gender: dto.gender,
    province: dto.location?.province,
    ward: dto.location?.ward,
    address: dto.location?.address,
    showPhone: dto.showPhone,
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
    avatar: initialsOf(dto.name),
    avatarUrl: dto.avatar || undefined,
    gender: dto.gender,
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
    avatarUrl: dto.partnerAvatar || undefined,
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

// ── HELPERS ─────────────────────────────────────────────────────────

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
  /**
   * Nhóm đích, khi người đăng đi từ TRANG HỒ SƠ NHÓM thay vì từ nút đăng chung.
   *
   * Không gửi thì BE lấy nhóm đang thao tác (`X-Org-Slug`) — đường cũ, và nó buộc người
   * thuộc nhiều nhóm phải chuyển nhóm đang thao tác trước khi đăng. Gửi slug thì tin vào
   * ĐÚNG nhóm đó, bất kể họ đang đứng ở đâu.
   *
   * BE tự tra tư cách thành viên với slug này (`resolveTargetOrg`), nên đây KHÔNG phải
   * đường vòng qua phân quyền: gửi slug của nhóm mình không thuộc thì tin rơi vào hàng đợi
   * người-ngoài của nhóm đó, và nhóm đóng cửa thì 400.
   */
  orgSlug?: string;
  /**
   * Thuộc tính động theo template của danh mục. Gửi thô — BE ép kiểu và loại key lạ ở
   * `validateAttributes`, app không đoán trước luật đó (nó nằm trong DB, không trong bundle).
   */
  attributes?: ListingAttributes;
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
    ...(input.orgSlug ? { orgSlug: input.orgSlug } : {}),
    // Bỏ hẳn key khi rỗng, cùng lý do với `location`: `attributes: {}` qua được `.strict()`
    // của BE nhưng ghi ra một tin không lọc được theo gì.
    ...(input.attributes && Object.keys(input.attributes).length
      ? { attributes: input.attributes }
      : {}),
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

  /**
   * Template thuộc tính của một danh mục.
   *
   * Trả về NGUYÊN DTO chứ không map lại: field đã ghép sẵn và đã sắp theo `order` ở BE, thu
   * hẹp thêm ở đây chỉ để mất `min`/`max`/`showIf` — đúng những thứ renderer cần.
   *
   * Danh mục chưa có template riêng vẫn trả 200 với bản chung; chưa seed gì thì `fields` rỗng.
   * Không có nhánh 404 nào để bắt — "không có thuộc tính" là trạng thái hợp lệ, không phải lỗi.
   *
   * `version` do form SỬA TIN truyền vào (`listing.templateVersion`) để dựng lại đúng bộ field
   * lúc tin được tạo. Bỏ trống ở form đăng tin mới: ở đó bản mới nhất mới là bản đúng.
   */
  async getCategoryTemplate(categoryId: string, version?: number): Promise<CategoryTemplate> {
    const res = await withAuthRetry(() =>
      // `!= null` chứ không truthiness: `version` là số, và `0` phải đi vào nhánh "có ghim"
      // chứ không lặng lẽ rơi về bản mới nhất.
      categoryGetTemplate({
        path: { id: categoryId },
        query: version != null ? { version } : undefined,
      }),
    );
    return unwrap(res, 'Không tải được mẫu thông tin của danh mục');
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
   * Tin của MỘT nhóm cụ thể — khối "Tin trong nhóm" trên hồ sơ nhóm.
   *
   * Gắn `X-Org-Slug` riêng cho lượt gọi này: mở hồ sơ một nhóm không có nghĩa là chuyển
   * cả app sang làm việc ở đó. BE vẫn đối chiếu membership với slug nhận được, nên gọi
   * cho nhóm mình không thuộc về sẽ 403 — chỉ gọi khi hồ sơ trả `joined: true`.
   */
  async getOrgListings(slug: string, take: number): Promise<Listing[]> {
    const [res, names] = await Promise.all([
      withAuthRetry(() =>
        listingList({ query: { limit: take }, headers: { [ORG_HEADER]: slug } }),
      ),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được tin của nhóm').map((l) => toListing(l, names));
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
            // JSON thô — SDK tự url-encode. Bỏ hẳn khi rỗng: `attrs={}` sẽ khiến BE đòi
            // `category` (nó chỉ nhìn sự có mặt của tham số) và cả lượt tìm ăn 400.
            ...(Object.keys(filter.attrs).length
              ? { attrs: JSON.stringify(filter.attrs) }
              : {}),
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
  async getQuota(): Promise<PostingQuota> {
    const res = await withAuthRetry(() => listingQuota());
    const dto = unwrap(res, 'Không đọc được hạn mức đăng tin');
    return {
      allowed: dto.allowed,
      limit: dto.limit,
      pending: dto.pending,
      remaining: dto.remaining,
      needsReconcile: dto.needsReconcile.map((l) => ({
        id: l._id,
        title: l.title,
        image: l.image || undefined,
        // BE chỉ đưa vào danh sách này tin `active` hoặc `expired` — mọi thứ khác là `live`.
        status: l.status === 'expired' ? 'expired' : 'live',
        expiresAt: l.expiresAt ?? undefined,
      })),
    };
  },

  /**
   * "Vẫn còn" — gia hạn thêm 30 ngày, và bật lại tin đã hết hạn.
   *
   * KHÔNG phải đẩy tin: BE cố tình không chạm `rankAt`, nên tin quay lại bảng ở đúng vị trí
   * cũ. Đừng hứa với người bán là tin "lên đầu bảng" sau khi gia hạn.
   */
  async renewListing(id: string) {
    const res = await withAuthRetry(() => listingRenew({ path: { id } }));
    unwrap(res, 'Không gia hạn được tin này');
    return { id };
  },

  /** "Đã bán" — idempotent ở BE, nên bấm lại không thành lỗi đỏ. */
  async markListingSold(id: string) {
    const res = await withAuthRetry(() => listingMarkSold({ path: { id } }));
    unwrap(res, 'Không đánh dấu được tin này');
    return { id };
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
    return { id };
  },

  /* ---------------- saved ---------------- */
  /**
   * Toàn bộ id đã lưu, không phân trang — mọi danh sách đang mở đều tô tim từ tập này, mà
   * thiếu một cái tim thì người dùng tưởng vừa mất tin đã lưu.
   */
  async getSavedIds(): Promise<string[]> {
    const res = await withAuthRetry(() => favoriteIds());
    return unwrap(res, 'Không tải được danh sách tin đã lưu');
  },

  /**
   * Tin đã lưu, mới lưu trước. BE trả nguyên tin nên không còn phải lấy từng cái như bản
   * local; tin đã bị gỡ BE tự loại khỏi `data`.
   */
  async getSavedListings(): Promise<Listing[]> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => favoriteList({ query: { limit: 50 } })),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được tin đã lưu').map((l) => toListing(l, names));
  },

  /**
   * Đặt trạng thái tim, KHÔNG lật nó: lưu và bỏ lưu là hai endpoint khác nhau, và nhận trạng
   * thái ĐÍCH khiến hàm idempotent — bấm nhanh hai lần hay retry sau lỗi mạng đều ra cùng một
   * kết quả, thay vì lật ngược đúng thứ người dùng vừa chọn.
   */
  async setSaved(id: string, saved: boolean): Promise<boolean> {
    const call = saved ? favoriteAdd : favoriteRemove;
    const res = await withAuthRetry(() => call({ path: { listingId: id } }));
    return unwrap(res, saved ? 'Không lưu được tin này' : 'Không bỏ lưu được tin này').favorited;
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

  /**
   * `org`/`posted`/`sold`/`rating` không gửi lên: chúng là thứ đọc được, không phải thứ sửa được.
   *
   * `location` gộp lại từ ba field phẳng của `Profile` và **bỏ hẳn key khi cả ba đều rỗng** —
   * gửi `location: {}` sẽ ghi một subdoc rỗng, mà "chưa điền khu vực" và "khu vực rỗng" phải là
   * cùng một thứ (đúng cách `createListing` xử lý).
   */
  async updateProfile(input: Partial<Profile>): Promise<Profile> {
    // `in` chứ không phải kiểm giá trị: người dùng xoá trắng cả ba ô khu vực thì mọi giá trị đều
    // rỗng, mà bỏ hẳn key `location` lại có nghĩa "đừng đụng tới" — BE giữ nguyên giá trị cũ và
    // khu vực không bao giờ xoá được. Gửi `location: {}` mới là "xoá".
    const touchedLocation = 'province' in input || 'ward' in input || 'address' in input;
    const location = {
      ...(input.province ? { province: input.province } : {}),
      ...(input.ward ? { ward: input.ward } : {}),
      ...(input.address?.trim() ? { address: input.address.trim() } : {}),
    };

    const res = await withAuthRetry(() =>
      userUpdateMe({
        body: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          // Chuỗi rỗng đi thẳng lên: BE nhận `''` nghĩa là xoá số. Chặn ở đây thì người dùng
          // không có đường bỏ số đã lưu.
          ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
          ...(input.avatarUrl !== undefined ? { avatar: input.avatarUrl } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.showPhone !== undefined ? { showPhone: input.showPhone } : {}),
          ...(touchedLocation ? { location } : {}),
        },
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
