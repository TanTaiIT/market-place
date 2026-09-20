import type { Grad } from '@/theme';
import type { ProvinceName } from './location';

/**
 * Domain type của app.
 *
 * Không còn state hay fixture nào ở đây: mọi dữ liệu — tin đăng, hồ sơ, thông báo, hội thoại
 * và tin đã lưu — đều đọc từ BE thật qua SDK generated (`client.ts`).
 */

export type Listing = {
  /** Mongo ObjectId 24 hex từ BE — không phải số, đừng `Number()` khi đọc route param. */
  id: string;
  /**
   * `_id` của người đăng, giữ riêng bên cạnh tên hiển thị `seller`: hồ sơ công khai
   * (`GET /users/{id}`) tra theo id, còn `posterName` chỉ là snapshot BE chốt lúc tạo tin.
   */
  sellerId: string;
  title: string;
  price: string;
  /**
   * Giá thô như BE lưu, đứng cạnh bản đã format cùng lý do với `categoryId`: form sửa tin phải
   * nạp lại con số, mà đọc ngược từ chuỗi hiển thị thì "Miễn phí" không còn đường về 0.
   */
  priceValue: number;
  cat: string;
  /**
   * Id danh mục + tỉnh giữ nguyên bên cạnh bản hiển thị (`cat`): đây là hai tiêu chí đi tìm
   * tin gợi ý, mà tìm theo TÊN danh mục thì hỏng ngay khi có hai danh mục trùng tên.
   */
  categoryId: string;
  /** Tên tỉnh như BE lưu trong `location.province` — cũng chính là giá trị `?province=` nhận. */
  province?: ProvinceName;
  /** Hai mảnh còn lại của địa chỉ. Chỉ form sửa tin đọc tới — thẻ tin chỉ hiện tới cấp tỉnh. */
  ward?: string;
  address?: string;
  /**
   * Bậc phủ sóng — ai đọc được tin, và qua đó là AI DUYỆT nó.
   *
   * Thang bao nhau: `members` ⊂ `group_open` ⊂ `marketplace`. Tin `marketplace` VẪN nằm trong
   * bảng tin nhóm của nó, nên đây không phải "chọn một trong hai bảng".
   *
   * Form sửa tin phải nạp lại đúng bậc cũ để hiển thị — BE KHÔNG cho sửa bậc sau khi đăng
   * (`updateListingSchema` không nhận `reach`), vì nâng bậc là đổi bàn duyệt.
   */
  reach: 'members' | 'group_open' | 'marketplace';
  meta: string;
  /** Cặp màu dựng ảnh giả — dùng khi tin chưa có ảnh thật */
  photo: Grad;
  /** URL Cloudinary theo thứ tự người đăng chọn; phần tử **đầu tiên là ảnh bìa** */
  photoUrls?: string[];
  seller: string;
  avatar: string;
  /** Ảnh đại diện người bán, snapshot lúc tạo tin. Rỗng = rơi về chữ viết tắt. */
  avatarUrl?: string;
  contact: string;
  desc: string;
  /**
   * Thuộc tính động theo danh mục. Vắng khi tin được đăng lúc danh mục chưa có template —
   * màn chi tiết phải chịu được tin không có thuộc tính nào.
   */
  attributes?: ListingAttributes;
  /**
   * Bản template lúc tạo tin. Form sửa tin đọc `version` này để dựng lại ĐÚNG bộ field cũ,
   * không phải bộ mới nhất — nếu không, tin cũ hiện field chưa từng có.
   */
  templateVersion?: number;
  /**
   * BỐN trạng thái, không phải hai: tin hết hạn và tin đã bán là hai câu trả lời KHÁC nhau mà
   * chủ tin phải phân biệt được ("gia hạn đi" vs "xong rồi"). 4 trạng thái BE còn lại
   * (`draft`/`rejected`/`hidden`/`pending_unverified`) vẫn gộp về `pending` — với người bán
   * chúng đều là "chưa lên bảng" và không có nút nào để bấm. Phân biệt chờ / bị từ chối / bị ẩn,
   * kèm LÝ DO, nằm ở `review` — `status` chỉ trả lời "có hành động gì".
   */
  status: 'live' | 'pending' | 'expired' | 'sold';
  /**
   * Vì sao tin chưa lên bảng. Chỉ có ở tin CỦA MÌNH đọc qua `/listings/mine*`, và chỉ khi có gì
   * cần nói (chờ duyệt / bị từ chối / bị ẩn) — tin đang hiện, đã bán, hết hạn thì vắng. BE đã
   * dịch mã máy thành câu, app hiện nguyên văn: câu chữ khớp với lời người duyệt ở bàn quản trị.
   */
  review?: ListingReview;
  /**
   * Mốc hết hạn hiển thị, ISO. Vắng ở tin đăng trước ngày có hạn — màn nào đọc nó phải chịu
   * được `undefined` chứ không hiện "Invalid Date".
   */
  expiresAt?: string;
  mine: boolean;
  /** Lượt xem BE đếm, hiện trên thẻ tin. */
  viewCount: number;
  /** Số người đã lưu tin — "N người quan tâm" trên thẻ. */
  favoriteCount: number;
  /**
   * Tổ chức tin thuộc về; `null` = tin ở trục công khai.
   *
   * Chỉ có ID vì BE không snapshot tên tổ chức vào tin. Thẻ tin tra tên từ `useMyOrgs()`:
   * tin nội bộ chỉ hiện cho thành viên của chính tổ chức đó, nên người đang xem luôn có
   * tên trong danh sách của mình. Tra không ra thì giấu dòng đó đi, không bịa.
   */
  organizationId: string | null;
};

/** Lời BE soạn cho chính chủ về tin chưa lên bảng. `hint` = việc họ làm được ngay, nếu có. */
export type ListingReview = {
  state: 'pending' | 'rejected' | 'hidden';
  /** Nhãn huy hiệu — "Chờ duyệt" / "Bị từ chối" / "Đã ẩn". */
  title: string;
  message: string;
  hint?: string;
};

/**
 * Một tin cũ mà màn chặn-trước-khi-đăng đem ra hỏi. RÚT GỌN có chủ đích — chỉ đủ vẽ một dòng
 * kèm hai nút, không phải một `Listing` đầy đủ: BE cũng chỉ trả đúng bấy nhiêu field.
 */
export type StaleListing = {
  id: string;
  title: string;
  /** Ảnh bìa; rỗng = tin không có ảnh, dòng đó rơi về ô màu. */
  image?: string;
  /** `expired` = đã rơi khỏi bảng tin; `live` = còn hiển thị nhưng sắp hết hạn. */
  status: 'live' | 'expired';
  /** ISO. Vắng ở tin cũ chưa có hạn — hiện "chưa rõ hạn" chứ không "Invalid Date". */
  expiresAt?: string;
};

/** Hạn mức đăng tin + những tin cũ cần trả lời trước khi được đăng tiếp. */
export type PostingQuota = {
  allowed: boolean;
  limit: number;
  pending: number;
  remaining: number;
  needsReconcile: StaleListing[];
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
  /**
   * Ảnh tin, cũng là snapshot. `undefined` = tin không ảnh, hoặc hội thoại mở trước khi BE có
   * field này — cả hai đều rơi về `listingPhoto`.
   */
  listingImage?: string;
  /** Dải màu suy từ id TIN, dùng khi không có ảnh — cùng cặp màu với thẻ tin trên bảng. */
  listingPhoto: Grad;
  /** Người còn lại trong hội thoại. */
  name: string;
  avatar: string;
  /** Ảnh đại diện của người đó, snapshot lúc mở hội thoại. Rỗng = rơi về chữ viết tắt. */
  avatarUrl?: string;
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
  /**
   * Nhóm mà việc này xảy ra trong. `undefined` = ngoài mọi nhóm (tin trục danh mục được duyệt,
   * lời mời từ nhóm mình chưa tham gia). Dùng để gộp các dòng cùng nhóm và tra tên nhóm.
   */
  orgId?: string;
  /** Tên người gây ra — có thì dòng đọc thành "Tài vừa đăng…", vắng thì `title` tự đủ nghĩa. */
  actorName?: string;
  /** Tin để bấm vào mở. `undefined` = dòng này không dẫn tới tin nào. */
  listingId?: string;
  /** Mốc thật, để gộp theo NGÀY — `time` đã là chuỗi "3 giờ trước", không so được. */
  at: string;
};

/**
 * Danh tính trả về sau đăng nhập/đăng ký. `stores/auth.ts` khai lại type tương đương thay vì
 * import chỗ này — store là lá, không được import layer khác (folder.convention §6).
 */
export type AuthSession = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

/** Bốn giá trị BE nhận. `undisclosed` là lựa chọn thật ("không muốn nêu"), không phải bỏ trống. */
export type Gender = 'male' | 'female' | 'other' | 'undisclosed';

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  undisclosed: 'Không nêu',
};

export type Profile = {
  name: string;
  /** Hộp thư đăng nhập — màn xác thực cần nó để nói rõ mã vừa gửi đi đâu. */
  email: string;
  org: string;
  phone: string;
  avatar: string;
  /** URL Cloudinary. `avatar` ở trên là chữ viết tắt dựng từ tên khi chưa có ảnh thật. */
  avatarUrl?: string;
  gender: Gender;
  /**
   * Khu vực của chính mình — RIÊNG TƯ, BE không trả nó ở hồ sơ công khai. Dùng để điền sẵn
   * form đăng tin, KHÔNG phải nguồn của `Listing.location`: bán đồ ở chỗ khác nơi mình ở là
   * chuyện thường, nên mỗi tin vẫn tự mang khu vực riêng.
   */
  province?: ProvinceName;
  ward?: string;
  address?: string;
  /**
   * Khu vực ĐÃ GIẢI, do BE quyết — dùng cho mọi khối "quanh bạn", KHÔNG dùng `province` ở trên.
   *
   * Khác nhau ở chỗ `province` là thứ người dùng tự khai và phần lớn để trống, còn cái này rơi
   * tiếp xuống bậc hai: tỉnh suy ra từ nơi họ đã đăng tin. `null` = chưa đủ căn cứ, và ở trạng
   * thái đó phải ẨN hẳn khối theo vị trí chứ không thay bằng một tỉnh mặc định.
   *
   * Thang ưu tiên nằm ở BE (`userService.resolveArea`) chứ không ở đây, cố ý: mỗi màn tự nối
   * `province ?? suyRa` là mỗi màn một bản sao của cùng luật, và sót một chỗ thì hai màn cạnh
   * nhau nói hai khu vực khác nhau về cùng một người.
   */
  area: { province: ProvinceName; source: 'profile' | 'listings' } | null;
  /** Cho hiện SĐT trên tin đăng MỚI. Tin đã đăng giữ nguyên vì `posterContact` là snapshot. */
  showPhone: boolean;
  /**
   * Hộp thư đã được chứng minh là của người này chưa.
   *
   * Tài khoản Google luôn `true` ngay từ lượt đăng nhập đầu — Google vừa chứng minh hộp thư.
   * Tài khoản mật khẩu thì `false` cho tới khi gõ đúng mã 6 số (`/verify-email`).
   */
  emailVerified: boolean;
  /** Chuỗi chứ không phải số: BE chưa trả thống kê nào, nên `—` là giá trị hợp lệ. */
  posted: string;
  sold: string;
  rating: string;
};

/**
 * Hồ sơ công khai của một người bán (`GET /users/{id}`).
 *
 * Không có email/phone và đừng đi tìm: BE cố tình không trả chúng ở route công khai này. Liên hệ
 * người bán đi qua `posterContact` của từng tin hoặc qua chat, không qua hồ sơ.
 *
 * Tách khỏi `Profile` (hồ sơ của chính mình) chứ không dùng chung: hai bên trả về hai tập field
 * khác nhau, gộp lại thì mọi field phải thành optional và không chỗ nào biết cái nào chắc có.
 */
export type PublicProfile = {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  gender: Gender;
  /** `—` khi chưa ai đánh giá: hiện `0.0` trông y hệt một điểm số thật đã bị chấm thấp. */
  rating: string;
  ratingCount: number;
  /** Mốc tham gia dạng "tháng 3/2026" — thước đo duy nhất BE trả về độ "cũ" của tài khoản. */
  joined: string;
};

/**
 * Danh mục lấy từ BE (`GET /categories`) chứ không còn là hằng số trong app: nó là từ điển
 * dùng chung toàn hệ thống, và `Listing.category` bên BE là ObjectId nên app phải giữ `id`
 * mới lọc và đăng tin được.
 */
export type Category = {
  id: string;
  name: string;
  /**
   * Khoá ỔN ĐỊNH của danh mục — dùng khi giao diện cần biết đang xem LOẠI gì, không phải chỉ
   * hiển thị nó. Hiện có một chỗ đọc: thang chip khoảng giá (`PriceField`), vì bậc giá của Bất
   * động sản và của Sách vở không có gì chung.
   *
   * `id` không thay được: nó là ObjectId sinh lúc seed, đổi theo từng môi trường.
   */
  slug: string;
  icon: string;
};

/**
 * Template thuộc tính của một danh mục — RE-EXPORT từ SDK generated, không phải bản chép.
 *
 * Khác `Category`/`Listing` (hai type được thu hẹp lại cho UI), BE đã trả về đúng hình mà form
 * cần dùng: field đã ghép sẵn `label`/`options`/`showIf`, đã sắp theo `order`. Chép lại ở đây
 * là dựng một bản thứ hai phải sửa tay mỗi lần `npm run api:sync` đổi hợp đồng.
 *
 * `templateId: null` = hệ thống chưa seed template nào; `fields` rỗng và form không hiện thêm gì.
 */
export type { CategoryTemplate, TemplateField } from './generated';

/**
 * Giá trị thuộc tính động của một tin. Kiểu là THẬT (BE đã ép qua template): số cho `odo`,
 * boolean cho `warranty`, mảng cho `amenities`. Đừng `String()` khi đọc — form sửa tin phải
 * nạp lại đúng kiểu để dropdown và switch chọn đúng.
 */
export type ListingAttributes = Record<string, string | number | boolean | string[]>;

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
  /**
   * Tầng dưới của `province`, tuỳ chọn. Không bao giờ có nghĩa khi `province` là `null`: BE trả
   * 400 cho xã trần (tên xã lặp giữa các tỉnh), nên đổi hay bỏ tỉnh phải kéo xã về `null` cùng lúc.
   */
  ward: string | null;
  /**
   * Thu hẹp về tin NỘI BỘ của một nhóm mình đã tham gia — `X-Org-Id` nhận đúng id này, nên
   * URL kết quả mở lại được ở máy khác mà không phải tra gì thêm.
   *
   * Cùng luật với `ward`: chỉ có nghĩa khi có `province`. Danh sách nhóm để chọn được bày theo
   * tỉnh đang lọc (nhóm có địa bàn), nên bỏ hay đổi tỉnh là nhóm về `null` cùng lúc — không có
   * bộ lọc nào đang bật mà ngăn lọc lại không bày ra được.
   */
  orgId: string | null;
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  /**
   * Lọc theo thuộc tính động, khoá là `key` của field trong template danh mục.
   *
   * Chỉ có nghĩa khi `categoryId` khác `null` — BE trả 400 nếu thiếu danh mục, vì không có
   * template thì không có tập key hợp lệ nào để đối chiếu. Hệ quả: đổi danh mục phải xoá sạch
   * nó, y như form đăng tin xoá `attributes` khi đổi danh mục.
   */
  attrs: ListingAttrFilter;
};

/** Ba dạng ràng buộc BE nhận: bằng đúng · thuộc tập · khoảng số. */
export type ListingAttrFilter = Record<
  string,
  string | number | boolean | string[] | { gte?: number; lte?: number }
>;

export const EMPTY_SEARCH: SearchFilter = {
  q: '',
  province: null,
  ward: null,
  orgId: null,
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  attrs: {},
};

/**
 * Có ràng buộc nào không. Dùng chung cho hai việc: query quyết định có bay hay không, và màn
 * hình quyết định hiện lời mời "nhập từ khoá" hay "không tìm thấy" — hai câu trả lời phải
 * đến từ cùng một phép tính, nếu không sẽ có lúc màn báo rỗng trong khi query chưa hề chạy.
 */
export const hasSearchCriteria = (f: SearchFilter): boolean =>
  f.q.trim().length > 0 ||
  f.province !== null ||
  f.ward !== null ||
  f.orgId !== null ||
  f.categoryId !== null ||
  f.minPrice !== null ||
  f.maxPrice !== null ||
  Object.keys(f.attrs).length > 0;

/**
 * Đã chọn nhóm thì tỉnh/xã KHÔNG lọc lên tin — chúng chỉ còn là ngữ cảnh để bày danh sách nhóm.
 *
 * Tin trong nhóm nằm ở tỉnh của NGƯỜI ĐĂNG, không phải tỉnh của nhóm: nhóm "kings" đặt ở Lâm
 * Đồng nhưng tin của nó đăng từ Hồ Chí Minh. Gửi cả `province` của nhóm lẫn `X-Org-Id` là
 * lấy giao của hai tập gần như rời nhau — đúng ca "chọn nhóm rồi tìm mà không ra tin nào".
 *
 * Ba nơi cùng hỏi hàm này — request, số bộ lọc đang bật, hàng chip ở trang kết quả — để thứ
 * hiện ra luôn đúng là thứ đã lọc, không có chip "📍 Lâm Đồng" đứng cạnh một kết quả toàn HCM.
 */
export const locationApplies = (f: SearchFilter): boolean => f.orgId === null;

/** Số bộ lọc đang bật, KHÔNG tính từ khoá — nó có ô riêng, không nằm trong ngăn lọc. */
export const activeFilterCount = (f: SearchFilter): number => {
  const location = locationApplies(f) ? [f.province, f.ward] : [];
  return (
    [...location, f.orgId, f.categoryId, f.minPrice, f.maxPrice].filter((v) => v !== null).length +
    Object.keys(f.attrs).length
  );
};

const trimTenth = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/**
 * "500k" · "2,5tr" · "1,2 tỷ" — Hermes không có `Intl` đủ dùng nên cắt tay.
 *
 * Nằm ở đây chứ không trong component: thanh kéo giá và hàng chip tiêu chí phải đọc ra CÙNG một
 * chuỗi cho cùng một số. Hai bản sao là hai lần lệch cách viết mà không ai thấy cho tới lúc
 * chúng nằm cạnh nhau trên một màn.
 */
export function shortDong(dong: number): string {
  if (dong >= 1_000_000_000) return `${trimTenth(dong / 1_000_000_000)} tỷ`;
  if (dong >= 1_000_000) return `${trimTenth(dong / 1_000_000)}tr`;
  if (dong >= 1_000) return `${trimTenth(dong / 1_000)}k`;
  return `${dong}đ`;
}

/**
 * Nhãn khoảng giá, `null` khi không ràng buộc giá.
 *
 * Một đầu để trống thì viết "từ …"/"đến …" chứ không bơm số thay vào: "0 — 2tr" nói rằng có chặn
 * dưới ở 0, còn "đến 2tr" mới đúng là không có chặn dưới.
 */
export function priceRangeLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `${shortDong(min)} — ${shortDong(max)}`;
  if (min !== null) return `từ ${shortDong(min)}`;
  if (max !== null) return `đến ${shortDong(max)}`;
  return null;
}

export const CHAT_COLORS = ['#3F6B4A', '#D9A566', '#8C6539', '#6B7F8C', '#B98851'];

/**
 * `SearchFilter` ↔ params của route.
 *
 * Tiêu chí đi bằng URL chứ không bằng store: trang kết quả mở được bằng deep link, nút back trả
 * đúng bộ lọc cũ, và hai màn không phải chia nhau một cục state toàn cục chỉ để nói với nhau một
 * lần. `attrs` là object nên gói JSON vào MỘT param — expo-router chỉ chuyển chuỗi.
 */
export function searchToParams(f: SearchFilter): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.q.trim()) p.q = f.q.trim();
  if (f.province) p.province = f.province;
  if (f.province && f.ward) p.ward = f.ward;
  if (f.province && f.orgId) p.org = f.orgId;
  if (f.categoryId) p.categoryId = f.categoryId;
  if (f.minPrice !== null) p.minPrice = String(f.minPrice);
  if (f.maxPrice !== null) p.maxPrice = String(f.maxPrice);
  if (Object.keys(f.attrs).length > 0) p.attrs = JSON.stringify(f.attrs);
  return p;
}

/**
 * Ngược lại. Param thiếu/hỏng rơi về giá trị rỗng chứ KHÔNG ném: params tới từ URL nên có thể do
 * người dùng dán tay, và một trang kết quả trắng vì `JSON.parse` vỡ thì không ai đoán được vì sao.
 */
/** Param của expo-router có thể là mảng khi URL lặp khoá — lấy giá trị đầu. */
const oneParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export function paramsToSearch(p: Record<string, string | string[] | undefined>): SearchFilter {
  const num = (v: string | string[] | undefined): number | null => {
    const n = Number(oneParam(v));
    return oneParam(v) !== undefined && Number.isFinite(n) ? n : null;
  };

  let attrs: ListingAttrFilter = {};
  const rawAttrs = oneParam(p.attrs);
  if (rawAttrs) {
    try {
      const parsed: unknown = JSON.parse(rawAttrs);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        attrs = parsed as ListingAttrFilter;
      }
    } catch {
      // Params hỏng → coi như không lọc thuộc tính, phần còn lại của bộ lọc vẫn dùng được.
    }
  }

  const province = (oneParam(p.province) as ProvinceName | undefined) ?? null;
  return {
    q: oneParam(p.q) ?? '',
    province,
    // Xã trần (URL dán tay, thiếu tỉnh) bị bỏ: BE trả 400 cho nó, mà trang kết quả trắng vì một
    // param lẻ thì không ai đoán được vì sao — phần còn lại của bộ lọc vẫn dùng được.
    ward: province ? (oneParam(p.ward) ?? null) : null,
    orgId: province ? (oneParam(p.org) ?? null) : null,
    categoryId: oneParam(p.categoryId) ?? null,
    minPrice: num(p.minPrice),
    maxPrice: num(p.maxPrice),
    attrs,
  };
}

export const NEW_PHOTOS: Grad[] = [
  ['#EFCB9C', '#D9A566'],
  ['#C9D9C0', '#9FBF8E'],
  ['#C7C2D9', '#9E97BF'],
  ['#D9C2C2', '#BF9797'],
];
