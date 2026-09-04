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
   * Nơi tin hiển thị, và qua đó là AI DUYỆT nó. Form sửa tin phải nạp lại đúng lựa chọn cũ:
   * để nó rơi về mặc định là lặng lẽ đẩy tin sang một hàng đợi khác chỉ vì người dùng sửa tiêu đề.
   */
  visibility: 'org_internal' | 'public';
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
   * chúng đều là "chưa lên bảng".
   */
  status: 'live' | 'pending' | 'expired' | 'sold';
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
  /** Cho hiện SĐT trên tin đăng MỚI. Tin đã đăng giữ nguyên vì `posterContact` là snapshot. */
  showPhone: boolean;
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
  f.categoryId !== null ||
  f.minPrice !== null ||
  f.maxPrice !== null ||
  Object.keys(f.attrs).length > 0;

/** Số bộ lọc đang bật, KHÔNG tính từ khoá — nó có ô riêng, không nằm trong ngăn lọc. */
export const activeFilterCount = (f: SearchFilter): number =>
  [f.province, f.categoryId, f.minPrice, f.maxPrice].filter((v) => v !== null).length +
  Object.keys(f.attrs).length;

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

  return {
    q: oneParam(p.q) ?? '',
    province: (oneParam(p.province) as ProvinceName | undefined) ?? null,
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
