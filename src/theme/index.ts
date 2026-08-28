import { Platform } from 'react-native';

/**
 * Bảng màu lấy từ `:root` của prototype "Ghim · Mioto style".
 *
 * GIỮ NGUYÊN tên token cũ dù giá trị đổi hết: 81 file đang đọc `C.paper`, `C.pin`, `C.cork`…
 * Đổi tên là sửa 81 file trong một lượt và không ai review nổi. Tên cũ vẫn mang đúng NGHĨA ở hệ
 * mới — `paper` = nền màn, `paperWarm` = mặt thẻ, `line` = đường kẻ — chỉ đổi sắc.
 *
 * `pin` CỐ TÌNH vẫn là đỏ, không phải màu thương hiệu: nó đang được dùng làm màu cảnh báo ở
 * nhiều màn chưa dựng lại (chấm chưa đọc, nút thu hồi, chữ "Xoá lọc"). Đổi nó sang xanh là biến
 * mọi cảnh báo đó thành màu thành công mà không ai để ý. Màu thương hiệu nằm ở nhóm `brand*`.
 */
export const C = {
  // ── Chữ ─────────────────────────────────────────────────────────
  ink: '#17181C',
  /** `--ink-2`: chữ phụ, mô tả, meta. */
  inkSoft: '#6B7280',
  /** `--ink-3`: chữ mờ nhất còn đọc được — nhãn, placeholder. */
  muted: '#A1A6AF',

  // ── Nền ─────────────────────────────────────────────────────────
  /** Nền màn hình. */
  paper: '#F1F2F4',
  /** Mặt thẻ / thanh nổi. */
  paperWarm: '#FFFFFF',
  /** Nền bảng tin — hệ mới PHẲNG, không còn vân bần (xem `Surface`). */
  cork: '#F1F2F4',
  corkDark: '#E4E6EA',
  sand: '#F5F6F7',
  chipIdle: '#F5F6F7',

  // ── Thương hiệu ─────────────────────────────────────────────────
  /** `--brand`: nút chính, FAB, trạng thái đang chọn. */
  brand: '#3ECD7F',
  brandDark: '#2FB56D',
  /** Nền nhạt của thương hiệu — viên chip, ô đang chọn. */
  brandLt: '#E9F9F0',
  /** Chữ/biểu tượng thương hiệu trên nền sáng: `brand` quá nhạt để đọc. */
  brandTx: '#16A05B',

  // ── Nhấn phụ ────────────────────────────────────────────────────
  orange: '#FF7A3D',
  orangeLt: '#FFF1E9',
  /** Sao đánh giá. */
  star: '#F5B921',
  /** Đỏ báo động — huy hiệu chưa đọc, hành động phá huỷ. */
  danger: '#FF4D4D',
  dangerLt: '#FFECEC',

  // ── Token cũ, giữ tên ───────────────────────────────────────────
  /** Màu cảnh báo/chú ý. KHÔNG phải màu thương hiệu — xem ghi chú đầu file. */
  pin: '#FF4D4D',
  pinDark: '#E03B3B',
  pinLight: '#FF8A8A',
  /** Vàng nhắc việc (cũ: băng dán). */
  tape: '#F5B921',
  tapeDark: '#E0A800',
  tapeInk: '#6B4E00',
  /** Xanh "thành công" của hệ cũ nay trỏ thẳng vào thương hiệu. */
  moss: '#16A05B',
  mossLight: '#E9F9F0',
  amber: '#FF7A3D',
  amberInk: '#7A4526',
  line: '#EDEEF0',
  lineInput: '#E4E6EA',
  /** Xanh dương cho avatar/ảnh giả lập — prototype dùng đúng sắc này. */
  sky: '#5B8DEF',

  /** Lớp phủ trên ảnh để nút tròn nổi lên đọc được (`rgba(23,24,28,.42)` của prototype). */
  scrim: 'rgba(23,24,28,0.42)',
  scrimError: 'rgba(255,77,77,0.72)',
  /** Nền màn xem ảnh phóng to — lúc này ảnh là nội dung, không phải nền. */
  scrimPhoto: 'rgba(9,10,12,0.97)',

  /*
   * Bàn quản trị vẫn nền tối và CHƯA đổi trong đợt này: prototype không vẽ màn admin nào, đổi
   * mò 20 màn theo cảm tính là cách nhanh nhất để có 20 màn nửa nạc nửa mỡ. Giữ nguyên tới khi
   * có thiết kế cho chúng.
   */
  desk: '#11170F',
  deskPanel: '#171F13',
  deskRaise: '#1F2A19',
  deskHi: '#27331F',
  deskLine: 'rgba(243,239,225,0.10)',
  deskLineStrong: 'rgba(243,239,225,0.18)',
  deskTxt: '#EDE9DA',
  deskTxtSoft: '#A3AC96',
  deskTxtDim: '#6C7862',
  mossBright: '#5FA36E',
  mossDeep: '#2C5238',
  okText: '#7FBE8C',
  badText: '#F2705E',
  okTint: 'rgba(95,163,110,0.14)',
  warnTint: 'rgba(255,224,102,0.14)',
  badTint: 'rgba(232,67,46,0.15)',
  mutedTint: 'rgba(243,239,225,0.07)',
} as const;

/** Bo góc của prototype — `--r-lg/md/sm`. Viên tròn dùng `pill`. */
export const R = { lg: 16, md: 12, sm: 8, pill: 999 } as const;

/**
 * Tên font sau khi load bằng @expo-google-fonts.
 *
 * Prototype dùng Be Vietnam Pro; gói đó CHƯA có trong `package.json` nên tạm trỏ về Manrope —
 * cùng nhóm sans hình học, khác biệt nhỏ hơn nhiều so với việc để nguyên chữ viết tay. Muốn
 * đúng bản mẫu thì cài `@expo-google-fonts/be-vietnam-pro` rồi sửa ĐÚNG file này.
 *
 * `hand` không còn là chữ viết tay: hệ mới không có nét tay ở đâu cả. Giữ tên để 12 call-site
 * cũ không phải sửa cùng lúc với đợt đổi màu.
 */
export const F = {
  hand: 'Manrope_800ExtraBold',
  handLight: 'Manrope_600SemiBold',
  ui: 'Manrope_500Medium',
  uiSemi: 'Manrope_600SemiBold',
  uiBold: 'Manrope_700Bold',
  uiBlack: 'Manrope_800ExtraBold',
  /** Số liệu/nhãn: prototype không dùng font code, nên `mono` giờ cũng là Manrope. */
  mono: 'Manrope_500Medium',
  monoBold: 'Manrope_700Bold',
} as const;

/** Tương đương `box-shadow: 0 1px 3px rgba(0,0,0,.05)` của prototype — rất nhẹ, chỉ tách lớp. */
export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  default: { elevation: 2 },
}) as object;

/** Bóng đậm hơn cho thanh nổi (nav pill): `0 6px 22px -6px rgba(0,0,0,.18)`. */
export const shadowLift = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 8 },
}) as object;

/** Cặp màu gradient cho ảnh giả lập của từng tin (thay linear-gradient của web) */
export type Grad = readonly [string, string];
