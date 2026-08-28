import { formatPrice } from './client';

/**
 * SỐ TẠM CHO GIAO DIỆN MỚI — hardcode có chủ ý, chờ BE.
 *
 * Prototype vẽ nhiều khối mà hệ thống chưa có dữ liệu: sao đánh giá, số giao dịch, giá cũ/giảm
 * giá, khoảng cách, giao tận nơi, banner khuyến mãi. Chúng nằm HẾT ở file này, không rải vào
 * component — rải ra thì ba tháng sau không ai còn phân biệt được số thật với số tạm, và lúc BE
 * có thật thì phải đi dò từng màn.
 *
 * Gỡ thế nào: `grep -rn "placeholders" src app` ra đúng danh sách call-site cần đổi sang dữ liệu
 * thật. Mỗi nhóm dưới đây ghi rõ nó chờ cái gì ở BE.
 *
 * Vì sao mỗi tin một con số khác nhau: cả bảng tin hiện cùng "5.0 · 12 giao dịch" thì nhìn là
 * biết bịa. Suy từ id nên cùng một tin luôn ra cùng số, không nhảy mỗi lần render.
 */

/** Băm id thành số nguyên ổn định — cùng id, cùng kết quả, mọi phiên. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const pick = <T,>(id: string, table: readonly T[], salt = 0): T =>
  table[(hash(id) + salt) % table.length];

/** TODO(be): module `review` đang là stub (`NotImplementedError`) — chưa có `ratingAvg` thật. */
const RATINGS = ['5.0', '4.9', '4.8', '5.0', '4.7'] as const;
const DEALS = [12, 7, 31, 4, 19, 9] as const;

/** TODO(be): `Listing` không có giá cũ/khuyến mãi. `0` = không giảm, thẻ tự giấu nhãn. */
const OFFS = [0, 0, 16, 22, 0, 12] as const;

/** TODO(be): BE đã bỏ GeoJSON nên không tính được khoảng cách thật. */
const DISTANCES = ['cách 300m', 'cách 120m', 'cách 450m', 'cách 1,2km', 'cách 800m'] as const;

/** TODO(be): không có field vận chuyển trên `Listing`. */
const SHIP = [true, false, false, true, false] as const;

/** TODO(be): tình trạng món đồ chỉ có khi danh mục đã cấu hình `attributes` — đây là bản dự phòng. */
const CONDITIONS = ['Như mới', 'Đã dùng', 'Mới'] as const;

export interface ListingPlaceholder {
  rating: string;
  deals: number;
  /** Phần trăm giảm; `0` = không có khuyến mãi. */
  off: number;
  /** Giá gạch ngang, chỉ có khi `off > 0`. */
  oldPrice: string;
  distance: string;
  ship: boolean;
  condition: string;
}

/**
 * Bộ số tạm của MỘT tin. `priceValue` là giá THẬT — giá cũ suy ngược từ nó để hai con số không
 * chửi nhau (giảm 22% mà giá cũ thấp hơn giá mới thì lộ ngay).
 */
export function listingPlaceholder(id: string, priceValue: number): ListingPlaceholder {
  const off = pick(id, OFFS, 3);
  return {
    rating: pick(id, RATINGS),
    deals: pick(id, DEALS, 1),
    off,
    oldPrice: off > 0 && priceValue > 0 ? formatPrice(Math.round(priceValue / (1 - off / 100))) : '',
    distance: pick(id, DISTANCES, 2),
    ship: pick(id, SHIP, 4),
    condition: pick(id, CONDITIONS, 5),
  };
}

/** TODO(be): chưa có hệ khuyến mãi/chiến dịch. Banner "Đang diễn ra" ở màn Khám phá. */
export const PROMOS = [
  {
    id: 'p1',
    title: 'Đăng tin miễn phí cả tháng 9',
    note: 'Không giới hạn số tin',
    big: '0đ',
    grad: ['#3ECD7F', '#2AA463'] as const,
  },
  {
    id: 'p2',
    title: 'Tuần lễ sách cũ khoá 12',
    note: 'Nhường lại cho khoá dưới',
    big: '-30%',
    grad: ['#FF9A5B', '#F2683C'] as const,
  },
] as const;

/** Khối "Vì sao chọn Ghim" — chữ tĩnh, không phải dữ liệu; để đây cho cùng một chỗ gỡ. */
export const PERKS = [
  {
    id: 'k1',
    title: 'Chỉ người cùng trường',
    body: 'Mọi tài khoản đều xác thực bằng email trường. Giao dịch với bạn học, không phải người lạ trên mạng.',
  },
  {
    id: 'k2',
    title: 'Gặp nhau ở cổng trường',
    body: 'Không cần ship, không cần cọc. Hẹn giờ tan học, xem hàng rồi mới trả tiền.',
  },
] as const;
