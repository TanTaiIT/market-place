import {
  authLogin,
  authLogout,
  authRefresh,
  authSendEmailCode,
  authVerifyEmail,
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
  listingMineById,
  listingList,
  listingMine,
  listingQuota,
  listingMarkSold,
  listingRemove,
  listingRenew,
  listingUpdate,
  locationProvinces,
  locationWards,
  moderationGetListing,
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
  CreateListing,
  OwnerListing as OwnerListingDto,
  PublicProfile as PublicProfileDto,
  UpdateListing,
} from './generated';
import type { Province, ProvinceName } from './location';
import { CHAT_COLORS, NEW_PHOTOS, locationApplies } from './db';
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
import { getCurrentUserId, withAuthRetry } from './http';
import { REVIEW_MODE } from '@/compliance';

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

/**
 * `GET /listings/{id}` trả 404 cho tin không xem được, và 404 đó CỐ Ý không phân biệt được hai
 * ca: tin đã gỡ / id sai, và tin NỘI BỘ của một nhóm mình không thuộc về. Phân biệt ở BE là
 * cho người ngoài dò id để lập danh sách tin nội bộ của nhóm khác (market §8).
 *
 * Nên việc nói ra các khả năng thuộc về FE, và màn hình cần biết đây là 404 chứ không phải mất
 * mạng — `unwrap` ném `Error` trần nên không đủ, và trước đó màn in thẳng "Listing not found"
 * của BE dưới icon 📡. Lỗi có TÊN để `instanceof` được; thông điệp là bản chung, màn hình nối
 * thêm gợi ý đăng nhập cho khách.
 */
export class ListingHiddenError extends Error {
  constructor() {
    super(
      'Không mở được tin này. Tin có thể đã được gỡ, hoặc là tin nội bộ của một nhóm mà bạn ' +
        'chưa tham gia.',
    );
    this.name = 'ListingHiddenError';
  }
}

/** Mỗi trang xin ĐÚNG trần của BE (`PAGINATION.MAX_LIMIT`) — xin hơn là 400, không phải bị kẹp. */
export const PAGE_SIZE = 10;

/**
 * Bậc của bảng tin CHUNG.
 *
 * Hằng riêng vì nó lặp ở ba dải tin đẩy thẳng vào mặt người dùng — bảng tin, "Có thể bạn thích",
 * "Gợi ý cho bạn". Ba chuỗi rời nhau là ba chỗ có thể sót đúng một, và chỗ sót đó không đỏ ở
 * đâu cả: nó chỉ lặng lẽ thả tin của nhóm lên bảng tin chung.
 */
const MARKETPLACE = 'marketplace' as const;

/** Một trang của danh sách cuộn-tới-đâu-tải-tới-đó — hình dạng duy nhất mọi API list trả về. */
export type Page<T> = { items: T[]; hasNext: boolean; total: number };

type PagedEnvelope<TItem> = ApiEnvelope<TItem[]> & {
  meta?: { hasNextPage: boolean; total: number };
};

/**
 * Như `unwrap`, nhưng GIỮ `meta`: `hasNext` là thứ duy nhất cho hook biết còn trang sau hay
 * không, `total` là con số cho badge — cả hai không suy được từ độ dài của trang vừa nhận.
 */
export function unwrapPage<TItem, TOut>(
  res: { data?: PagedEnvelope<TItem>; error?: unknown },
  fallback: string,
  map: (item: TItem) => TOut,
): Page<TOut> {
  const items = unwrap(res as SdkResult<TItem[]>, fallback).map(map);
  const meta = res.data?.meta;
  return { items, hasNext: meta?.hasNextPage ?? false, total: meta?.total ?? items.length };
}

// ── MAPPER: DTO → domain ────────────────────────────────────────────

/**
 * Chấm nghìn kiểu Việt: `"3500000"` → `"3.500.000"`. Hermes không có Intl đầy đủ nên
 * `toLocaleString` không tin được — cắt bằng tay.
 *
 * Tách khỏi `formatPrice` cho Ô NHẬP giá: ô nhập cần đúng phần chấm nghìn, không cần đuôi "đ"
 * lẫn nhánh "Miễn phí" — hai thứ đó lọt vào `value` là người dùng phải xoá chúng trước khi gõ.
 */
export const groupDigits = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function formatPrice(price: number): string {
  if (price <= 0) return 'Miễn phí';
  return `${groupDigits(String(Math.round(price)))}đ`;
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

/**
 * Nhận `OwnerListing` (= `Listing` + `review?`) để MỘT mapper phục vụ cả hai: DTO công khai là
 * `Listing` thuần nên gán vào được và `review` đơn giản là vắng. Tách `toOwnerListing` riêng là
 * hai bản copy của 30 dòng chỉ khác nhau một field.
 */
function toListing(dto: OwnerListingDto, names: Map<string, string>): Listing {
  const isMine = dto.seller === getCurrentUserId();
  const sellerName = isMine ? 'Bạn' : dto.posterName || 'Người bán';

  return {
    id: dto._id,
    sellerId: dto.seller,
    title: dto.title,
    price: formatPrice(dto.price),
    priceValue: dto.price,
    canDeliver: dto.canDeliver,
    // BE trả `category` là ObjectId; tên hiển thị tra từ từ điển danh mục. Không tra được
    // thì để rỗng — `NoteCard` tự giấu pill, tin vẫn đọc được bình thường.
    cat: names.get(dto.category) ?? '',
    categoryId: dto.category,
    province: dto.location?.province,
    ward: dto.location?.ward,
    address: dto.location?.address,
    reach: dto.reach,
    meta: relativeTime(dto.createdAt),
    organizationId: dto.organizationId,
    org: dto.org ?? null,
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
    review: dto.review,
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
 * Phiên KHÔNG mang tổ chức nữa: v2 tách org khỏi danh tính, và org là lựa chọn của TỪNG LƯỢT
 * GỌI (`X-Org-Id`, do chính hàm api đặt) chứ không phải một trạng thái toàn cục nào.
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
    area: dto.area,
    showPhone: dto.showPhone,
    posted: '—',
    sold: '—',
    email: dto.email,
    /*
     * MỘT dòng tắt cả bốn bề mặt xác thực email — xem `REVIEW_MODE`.
     *
     * Tắt ở đây thay vì gác từng màn: dải nhắc ở Cá nhân, mục ở Cài đặt và cổng
     * `useRequireVerifiedEmail` đều đọc đúng cờ này, nên một chỗ là đủ và gỡ cũng chỉ một chỗ.
     * BE đã đặt `emailVerifiedAt` ngay lúc tạo (`SKIP_EMAIL_VERIFICATION`), nên đây không phải
     * nói dối giao diện — nó chỉ khớp lại với sự thật phía server.
     */
    emailVerified: REVIEW_MODE ? true : dto.isEmailVerified,
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
    listingImage: dto.listingImage || undefined,
    // Dải màu suy từ id TIN, không từ id hội thoại: cùng một tin phải ra cùng một cặp màu ở
    // thẻ trên bảng và ở dòng tin nhắn, nếu không thì hai chỗ nói về một món đồ mà nhìn như hai.
    listingPhoto: gradOf(dto.listingId),
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
 * thẳng từ `TextInput`; chuẩn hoá thành số là việc của `toEditableBody`, không phải của màn hình.
 */
type ListingInput = {
  title: string;
  price: string;
  desc: string;
  categoryId: string;
  /** Người bán nhận giao tận nơi. Sửa được sau khi đăng — nó là thuộc tính món hàng, không
   *  phải khoá định tuyến như `reach`/`provinceCode`. */
  canDeliver?: boolean;
  photoUrls?: string[];
  address?: string | null;
  province?: ProvinceName | null;
  ward?: string | null;
  /**
   * Bậc phủ sóng — ai đọc được tin, và cũng là thứ quyết định AI DUYỆT nó: `marketplace` về
   * hàng đợi manager danh mục theo (danh mục × tỉnh), `members`/`group_open` về hàng đợi của
   * chính nhóm.
   *
   * Bỏ trống thì BE tự chọn theo nhóm đích (`defaultReachFor`): nhóm công khai → `group_open`,
   * nhóm kín → `members`, không nhóm → `marketplace`. Để BE quyết là đúng — chỉ nó biết
   * `isPublic` của nhóm đích tại thời điểm đăng.
   */
  reach?: 'members' | 'group_open' | 'marketplace';
  /**
   * Nhóm đích, khi người đăng đi từ TRANG HỒ SƠ NHÓM thay vì từ nút đăng chung.
   *
   * Không gửi thì BE lấy nhóm đang thao tác (`X-Org-Id`) — đường cũ, và nó buộc người
   * thuộc nhiều nhóm phải chuyển nhóm đang thao tác trước khi đăng. Gửi id thì tin vào
   * ĐÚNG nhóm đó, bất kể họ đang đứng ở đâu.
   *
   * BE tự tra tư cách thành viên với id này (`resolveTargetOrg`), nên đây KHÔNG phải
   * đường vòng qua phân quyền: gửi id của nhóm mình không thuộc thì tin rơi vào hàng đợi
   * người-ngoài của nhóm đó, và nhóm đóng cửa thì 400.
   */
  orgId?: string | null;
  /**
   * Thuộc tính động theo template của danh mục. Gửi thô — BE ép kiểu và loại key lạ ở
   * `validateAttributes`, app không đoán trước luật đó (nó nằm trong DB, không trong bundle).
   */
  attributes?: ListingAttributes;
};

/**
 * Phần thân GIỐNG NHAU của lượt đăng và lượt sửa — mọi thứ trừ khu vực.
 *
 * Khu vực tách ra vì hai đường nhận hai hình khác nhau: đăng gửi đủ tỉnh/phường/số nhà, sửa
 * chỉ gửi được số nhà. Gộp lại như bản trước thì một trong hai luôn sai.
 *
 * `address` là số nhà / tên đường tự gõ, nằm dưới xã trong mô hình 2 cấp — không phải cấp
 * quận/huyện đã bỏ từ 01/07/2025.
 */
function commonBody(input: ListingInput) {
  return {
    title: input.title.trim(),
    description: input.desc.trim(),
    // Ô giá là `number-pad` nhưng vẫn lọt dấu phân cách người dùng tự gõ; BE nhận `number`.
    price: Number(input.price.replace(/\D/g, '')),
    canDeliver: input.canDeliver ?? false,
    categoryId: input.categoryId,
    images: input.photoUrls ?? [],
    // Bỏ hẳn key khi rỗng: `attributes: {}` qua được `.strict()` của BE nhưng ghi ra một tin
    // không lọc được theo gì.
    ...(input.attributes && Object.keys(input.attributes).length
      ? { attributes: input.attributes }
      : {}),
  };
}

/**
 * Thân của lượt SỬA — khu vực chỉ còn `address`.
 *
 * Tỉnh và phường là KHOÁ ĐỊNH TUYẾN: `provinceCode`/`wardCode` bên BE sinh từ chúng đúng một
 * lần lúc tạo, và quyết định ô (danh mục × tỉnh × phường) nào duyệt tin. Cho sửa sau là mở
 * đường cho một tin đã duyệt lặng lẽ đổi địa bàn — hiện ra ở tỉnh mới trong khi quyền duyệt
 * vẫn nằm ở tỉnh cũ. `updateListingSchema` là `.strict()` nên gửi kèm là 400, không phải bị
 * bỏ qua lặng lẽ.
 *
 * Kiểu trả về khai TƯỜNG MINH là chốt duy nhất bắt được việc này: giá trị đi vào `body:` là
 * kết quả một hàm, không phải object literal tại chỗ gọi, nên phép kiểm dư-thừa-thuộc-tính
 * không chạy ở đó. Nhờ dòng `: UpdateListing` mà thêm lại `province` vào đây sẽ đỏ ngay.
 */
function toEditableBody(input: ListingInput): UpdateListing {
  const address = input.address?.trim();
  return {
    ...commonBody(input),
    // `location: {}` qua được `.strict()` nhưng là một lượt ghi không nói gì — và với bản vá
    // chỉ-có-address thì nó còn dễ bị đọc nhầm thành "xoá địa chỉ".
    ...(address ? { location: { address } } : {}),
  };
}

/**
 * Thân của lượt ĐĂNG — phần sửa được, cộng ba khoá định tuyến.
 *
 * Ba khoá đó chỉ tồn tại ở đây chứ không ở `toEditableBody`, vì `updateListingSchema` bên BE
 * không nhận chúng: `routeListing` đọc chúng đúng một lần lúc tạo để chọn hàng đợi duyệt, và
 * cho sửa sau là đường để một tin nội bộ đã được nhóm duyệt tự nhảy lên bảng tin chung.
 * Gộp chung một hàm như bản trước thì lượt sửa gửi thừa ba field và ăn 400 từ `.strict()`.
 */
function toCreateBody(input: ListingInput): CreateListing {
  // Gom từng mảnh có thật rồi mới quyết định gửi hay không: gắn `address` vào nhánh
  // `if (province)` sẽ nuốt mất địa chỉ của người chỉ gõ đường mà chưa chọn tỉnh.
  const address = input.address?.trim();
  const location = {
    ...(address ? { address } : {}),
    ...(input.province ? { province: input.province } : {}),
    ...(input.ward ? { ward: input.ward } : {}),
  };

  return {
    ...commonBody(input),
    // `location: {}` rỗng qua được `.strict()` nhưng tạo ra một tin không lọc được theo gì.
    ...(Object.keys(location).length ? { location } : {}),
    ...(input.reach ? { reach: input.reach } : {}),
    ...(input.orgId ? { orgId: input.orgId } : {}),
    // CHỈ `marketplace` mới bắt buộc tỉnh: tỉnh là thứ chọn ra manager duyệt tin. `group_open`
    // tuy ai cũng đọc được nhưng không lên bàn danh mục, ép nó mang tỉnh là đòi thừa.
    ...(input.reach === 'marketplace' && input.province ? { provinceCode: input.province } : {}),
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
  /**
   * Báo server cắt phiên — KHÔNG chỉ xoá token khỏi máy.
   *
   * Refresh token là bearer sống 30 ngày: xoá khỏi máy mà không báo server thì bản sao nào
   * đã bị đọc trộm (AsyncStorage không mã hoá) vẫn dùng được tới hết hạn. Gọi đường này là
   * tăng `tokenVersion`, giết mọi refresh token đã phát — trên mọi thiết bị.
   *
   * KHÔNG `withAuthRetry`: đang đăng xuất thì một vòng refresh để "cứu" phiên là đi ngược
   * ý định, và token vừa bị giết cũng không refresh được.
   */
  async signOut(): Promise<void> {
    await authLogout();
  },

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    const res = await authRefresh({ body: { refreshToken } });
    return toSession(unwrap(res, 'Phiên đăng nhập đã hết, đăng nhập lại nhé'));
  },

  /* ---------------- xác thực email ---------------- */

  /**
   * Xin một mã 6 số gửi về hộp thư.
   *
   * Không truyền email: BE lấy địa chỉ từ token. Đó là chốt chống dò tài khoản ở phía BE, và
   * hệ quả ở đây là app không có cách nào gửi mã tới một hộp thư không phải của mình.
   *
   * `withAuthRetry` vì cả hai đường đều đòi đăng nhập — màn nhập mã có thể mở lâu (người dùng
   * đi mở hộp thư rồi quay lại), đủ để access token 15 phút hết hạn giữa chừng.
   */
  async sendEmailCode(): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
    const res = await withAuthRetry(() => authSendEmailCode());
    return unwrap(res, 'Không gửi được mã xác thực');
  },

  async verifyEmail(code: string): Promise<void> {
    const res = await withAuthRetry(() => authVerifyEmail({ body: { code } }));
    unwrap(res, 'Mã không đúng hoặc đã hết hạn');
  },

  /* ---------------- categories ---------------- */
  /** Từ điển dùng chung toàn hệ thống — BE chỉ trả danh mục đang bật. */
  async getCategories(): Promise<Category[]> {
    const res = await withAuthRetry(() => categoryList());
    return unwrap(res, 'Không tải được danh mục').map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
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
  /**
   * Bảng tin chung. `categoryId` bỏ trống = tất cả. Lọc chạy ở BE, app không tự cắt mảng.
   *
   * Ghim `reach=marketplace`, và đây là chốt giữ cho bậc `marketplace` CÓ NGHĨA: thiếu nó thì
   * tin `group_open` của mọi nhóm công khai tràn lên bảng tin chung mà chưa từng qua manager
   * danh mục, và người đăng chẳng còn lý do gì để chọn bậc trên nữa. `group_open` ra mặt ở tìm
   * kiếm và hồ sơ nhóm — hai chỗ người xem đã chủ động hỏi tới nhóm đó.
   */
  async getListings(categoryId?: string): Promise<Listing[]> {
    // Không gửi `status`: `listingQuerySchema` của BE không khai field đó (chỉ caller nội bộ mới
    // được ép status), và `buildFilter` đã mặc định ACTIVE. Gửi thêm chỉ bị zod strip im lặng.
    const [res, names] = await Promise.all([
      withAuthRetry(() =>
        listingList({
          query: { limit: PAGE_SIZE, category: categoryId, reach: [MARKETPLACE] },
        }),
      ),
      categoryNames(),
    ]);
    return unwrap(res, 'Không tải được bảng tin').map((l) => toListing(l, names));
  },

  /**
   * Tin của MỘT nhóm cụ thể — khối "Tin trong nhóm" trên hồ sơ nhóm.
   *
   * Gắn `X-Org-Id` riêng cho lượt gọi này: mở hồ sơ một nhóm không có nghĩa là chuyển
   * cả app sang làm việc ở đó. BE vẫn đối chiếu membership với id nhận được, nên gọi
   * cho nhóm mình không thuộc về sẽ 403 — chỉ gọi khi hồ sơ trả `joined: true`.
   */
  async getOrgListings(orgId: string, take: number, q?: string): Promise<Listing[]> {
    const [res, names] = await Promise.all([
      withAuthRetry(() =>
        listingList({
          /*
           * `?orgId=` là thứ thu hẹp về đúng nhóm này, thay cho mẹo cũ "ghim
           * `visibility: org_internal`".
           *
           * Dưới thang phủ sóng không còn giá trị nào nghĩa là "mọi thứ của nhóm này": tin ở
           * bậc `marketplace` VẪN thuộc bảng tin nhóm. Lọc theo bậc là giấu mất đúng những tin
           * nổi nhất của nhóm.
           *
           * Và `?orgId=` phục vụ được cả người NGOÀI — họ ăn nhánh công khai `AND organizationId`
           * nên thấy đúng phần nhóm đã mở (`group_open`). Header thì không làm nổi vế đó, vì
           * người ngoài không có chỗ đứng nào trên trục org để mà thu hẹp.
           */
          /*
           * `q` do BE khớp (tiêu đề + tên người đăng), KHÔNG lọc lại ở client: khối này chỉ
           * tải `take` tin đầu, nên lọc trên mảng đó là tìm trong ba tin thay vì trong nhóm —
           * đúng thứ vô dụng nhất ở một nhóm nhiều tin.
           */
          query: { limit: take, orgId, ...(q ? { q } : {}) },
        }),
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
      withAuthRetry(() => // Trần trang của BE là 10 — dải gợi ý vẽ 3–4 tin nên 10 vẫn đủ để lọc và xếp.
        listingList({
          query: {
            limit: Math.min(take * 3, PAGE_SIZE),
            category: current.categoryId,
            reach: [MARKETPLACE],
          },
        })),
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

  /**
   * Nguồn của dải "Gợi ý cho bạn" — gom vài lượt tìm hẹp rồi trộn lại.
   *
   * Khác `getSuggestions` ở câu hỏi nó trả lời: đường kia hỏi "tin nào giống TIN NÀY", đường
   * này hỏi "tin nào hợp GU người này". Tín hiệu do `queries/suggested` tính ở máy và truyền
   * vào đây dưới dạng đã chốt — tầng này không biết gì về lịch sử xem hay lịch sử tìm.
   *
   * TỐI ĐA 2 lượt gọi, và đó là trần cố ý: đây là màn đầu tiên người dùng thấy khi mở app,
   * nên mỗi request thêm vào là thời gian họ nhìn màn trống. Hai lượt × 10 dòng cho ra tối đa
   * 20 ứng viên, thừa cho một dải 6 thẻ kể cả sau khi trừ trùng và trừ tin đã xem.
   *
   * `province` XẾP chứ không LỌC — cùng luật với `getSuggestions`, và BE cũng chốt thế cho
   * `ward` ở `/listings/nearby`: lọc cứng ở tỉnh thưa tin thì người xem nhận về khoảng trống.
   */
  async getSuggestedFeed(input: {
    /** Tối đa 2 lượt gọi: mỗi phần tử là query của một lượt. */
    probes: { q?: string; category?: string; province?: ProvinceName }[];
    province: ProvinceName | null;
    /** Tin người dùng vừa xem — gợi lại chúng thì dải này chỉ là "Xem gần đây" đội tên khác. */
    excludeIds: string[];
    take: number;
  }): Promise<Listing[]> {
    const [pages, names] = await Promise.all([
      Promise.all(
        input.probes
          .slice(0, 2)
          .map((p) =>
            withAuthRetry(() =>
              listingList({ query: { ...p, limit: PAGE_SIZE, reach: [MARKETPLACE] } }),
            ),
          ),
      ),
      categoryNames(),
    ]);

    const skip = new Set(input.excludeIds);
    const seen = new Set<string>();
    const rows: Listing[] = [];
    // Duyệt theo thứ tự `probes` để lượt gọi đầu (tín hiệu mạnh nhất) chiếm chỗ trước khi
    // lượt sau chen vào — `Promise.all` giữ nguyên thứ tự đầu vào nên chỗ này tin được.
    for (const page of pages) {
      for (const dto of unwrap(page, 'Không tải được tin gợi ý')) {
        if (skip.has(dto._id) || seen.has(dto._id)) continue;
        seen.add(dto._id);
        rows.push(toListing(dto, names));
      }
    }

    const here = rows.filter((l) => l.province === input.province);
    const elsewhere = rows.filter((l) => l.province !== input.province);
    return [...here, ...elsewhere].slice(0, input.take);
  },

  /**
   * MỘT tin của chính mình, mọi trạng thái — dùng để dựng form sửa.
   *
   * Không dùng `getListing` cho form sửa: `GET /listings/{id}` lọc `status ∈ {active, sold,
   * expired}` ở BE, nên tin 'Chờ duyệt' (thứ hay cần sửa nhất) trả 404 'Listing not found' —
   * đúng lỗi mà nút sửa ở 'Tin đã đăng' gặp. Đường này chốt bằng `seller` từ token và không
   * tăng `viewCount`: mở form sửa không phải một lượt xem.
   */
  async getMyListing(id: string): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingMineById({ path: { id } })),
      categoryNames(),
    ]);
    return toListing(unwrap(res, 'Không tìm thấy tin này'), names);
  },

  /**
   * Một tin qua cửa BÀN DUYỆT — cho người xử báo cáo mở tin bị tố. Khác `getListing` ở hai ca
   * mà đường công khai trả 404: tin đã bị ẩn / đang chờ duyệt, và tin nội bộ của org mà master
   * không đứng trong. BE chốt thẩm quyền theo trục của tin, người thường ăn 403.
   */
  async getListingForModeration(id: string): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => moderationGetListing({ path: { id } })),
      categoryNames(),
    ]);
    return toListing(unwrap(res, 'Không mở được tin này'), names);
  },

  async getListing(id: string): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingGetById({ path: { id } })),
      categoryNames(),
    ]);
    // Bắt 404 TRƯỚC `unwrap`: nó là câu trả lời có nghĩa riêng (xem `ListingHiddenError`), không
    // phải một lỗi chung để dồn về thông điệp của BE.
    if (res.response?.status === 404) throw new ListingHiddenError();
    return toListing(unwrap(res, 'Không tìm thấy tin này'), names);
  },

  /**
   * `province` phải là đúng chuỗi trong danh sách của `/locations/provinces` — BE so khớp chính
   * xác, gửi "TP. Hồ Chí Minh" thay vì "Hồ Chí Minh" giờ là 400 chứ không còn im lặng trả rỗng.
   */
  async searchListings(filter: SearchFilter, page: number): Promise<Page<Listing>> {
    /*
     * KHÔNG chặn lượt tìm rỗng.
     *
     * Bản trước trả `[]` ngay khi chưa có tiêu chí nào, với lý do "đừng đổ nguyên bảng tin vào ô
     * kết quả tìm kiếm". Nhưng bảng tin đã thôi bày danh sách tin (nó là màn khám phá), nên
     * "tất cả tin" giờ KHÔNG còn trùng với màn nào — và nó chính là điểm khởi đầu đúng: mở danh
     * sách đầy đủ trước, thu hẹp bằng `SearchCrumbBar` sau, thay vì buộc người dùng khai tiêu
     * chí trước khi được thấy bất cứ thứ gì.
     */
    const term = filter.q.trim();
    /*
     * Lọc theo nhóm = `?orgId=`, đúng cách `getOrgListings` đang làm — không phải `X-Org-Id`.
     *
     * Header nói "tôi đang đứng trong nhóm nào", không phải "chỉ tìm trong nhóm này"; và người
     * NGOÀI nhóm thì không có chỗ đứng nào để mà đặt header. `?orgId=` thu hẹp được cho cả hai
     * loại người xem vì plugin vẫn `$and` scope lên trên: thành viên thấy cả `members`, người
     * ngoài chỉ thấy phần nhóm đã mở. Danh mục, giá, `q`, `attrs` vẫn `AND` tiếp trong
     * `buildFilter`. Riêng tỉnh/xã thì KHÔNG đi cùng nhóm — xem `locationApplies`.
     */
    const org = filter.orgId;
    const province = locationApplies(filter) ? filter.province : null;
    const [res, names] = await Promise.all([
      withAuthRetry(() =>
        listingList({
          // Bỏ hẳn field khi rỗng chứ không gửi `undefined`/`null`: `listingQuerySchema` của BE
          // coi `minPrice: null` là có mặt và ép kiểu, còn vắng mặt mới là "không lọc".
          query: {
            page,
            limit: PAGE_SIZE,
            ...(term ? { q: term } : {}),
            ...(province ? { province } : {}),
            ...(province && filter.ward ? { ward: filter.ward } : {}),
            ...(org ? { orgId: org } : {}),
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
    return unwrapPage(res, 'Không tìm được tin nào', (l) => toListing(l, names));
  },

  /**
   * Dùng `/listings/mine` chứ KHÔNG phải `/listings?seller=<id>`: cái sau lọc cứng về `active`
   * nên tin vừa ghim (luôn ở `pending`) sẽ không xuất hiện, và người đăng tưởng là đăng hụt.
   */
  async getMyListings(page: number): Promise<Page<Listing>> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingMine({ query: { page, limit: PAGE_SIZE } })),
      categoryNames(),
    ]);
    return unwrapPage(res, 'Không tải được tin của bạn', (l) => toListing(l, names));
  },

  /**
   * Tin mới vào BE ở trạng thái `pending` chờ duyệt, nên nó KHÔNG hiện ngay ngoài feed —
   * `/listings` chỉ trả tin `active`. Người đăng thấy nó ở "Tin của tôi".
   */
  async createListing(input: ListingInput): Promise<Listing> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingCreate({ body: toCreateBody(input) })),
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
      withAuthRetry(() => listingUpdate({ path: { id }, body: toEditableBody(input) })),
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
  async getSavedListings(page: number): Promise<Page<Listing>> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => favoriteList({ query: { page, limit: PAGE_SIZE } })),
      categoryNames(),
    ]);
    return unwrapPage(res, 'Không tải được tin đã lưu', (l) => toListing(l, names));
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
  async getConversations(page: number): Promise<Page<Conversation>> {
    const res = await withAuthRetry(() => chatList({ query: { page, limit: PAGE_SIZE } }));
    return unwrapPage(res, 'Không tải được tin nhắn', toConversation);
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await withAuthRetry(() => chatGetById({ path: { id } }));
    return toConversation(unwrap(res, 'Cuộc trò chuyện không tồn tại'));
  },

  /**
   * BE trả tin mới nhất trước (trang 1 = 10 tin mới nhất, trang 2 = 10 tin cũ hơn…), còn màn
   * chat render từ cũ tới mới. Đảo chiều TRONG trang ở đây; thứ tự GIỮA các trang do
   * `useMessages` lo (`olderPagesFirst`). Đọc ngược chỉ số thay vì `.reverse()`: nó mutate mảng
   * gốc và bị oxlint chặn, mà ở đây chỉ cần đảo chiều đọc.
   */
  async getMessages(conversationId: string, page: number): Promise<Page<Message>> {
    const res = await withAuthRetry(() =>
      chatMessages({ path: { id: conversationId }, query: { page, limit: PAGE_SIZE } }),
    );
    const newestFirst = unwrapPage(res, 'Không tải được tin nhắn', toMessage);
    const n = newestFirst.items.length;
    return { ...newestFirst, items: newestFirst.items.map((_, i) => newestFirst.items[n - 1 - i]) };
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
  async getNotifications(page: number): Promise<Page<Notif>> {
    const res = await withAuthRetry(() => notificationList({ query: { page, limit: PAGE_SIZE } }));
    return unwrapPage(res, 'Không tải được thông báo', (n) => ({
      id: n.id,
      scope: n.unitId ? ('unit' as const) : ('org' as const),
      title: n.title,
      body: n.body,
      time: relativeTime(n.createdAt),
      unread: !n.isRead,
      orgId: n.organizationId ?? undefined,
      actorName: n.actorName,
      listingId: n.listingId ?? undefined,
      at: n.createdAt,
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
  async getSellerListings(id: string, page: number): Promise<Page<Listing>> {
    const [res, names] = await Promise.all([
      withAuthRetry(() => listingList({ query: { page, limit: PAGE_SIZE, seller: id } })),
      categoryNames(),
    ]);
    return unwrapPage(res, 'Không tải được tin của người bán này', (l) => toListing(l, names));
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
