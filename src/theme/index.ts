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
  /**
   * Chặng ĐẦU của nền hero — xanh rừng, đậm và ngả lam so với `brand`.
   *
   * Tồn tại vì hiệu ứng KÍNH cần một nền đủ sâu để đứng lên. `glassRaise` là trắng 30%:
   * đặt nó trên `brand` (#3ECD7F, đã rất sáng) thì kết quả đọc ra 'xanh nhạt hơn' chứ không
   * ra 'tấm kính' — chính điều mà chú thích của `glassRaise` mô tả, và bản trước đã cố chữa
   * bằng cách nâng 0.22 → 0.30. Nâng độ đục là chữa ngọn; gốc là nền quá sáng.
   *
   * Chỉ dùng cho `G.brand`. Đây KHÔNG phải màu thương hiệu để đi nút hay chữ — nó tối hơn
   * mức mà chữ trắng nhỏ cần, nhưng cũng chưa đủ tương phản cho chữ tối.
   */
  brandDeep: '#137A52',
  /** Nền nhạt của thương hiệu — viên chip, ô đang chọn. */
  brandLt: '#E9F9F0',
  /** Chữ/biểu tượng thương hiệu trên nền sáng: `brand` quá nhạt để đọc. */
  brandTx: '#16A05B',
  /** Sắc thương hiệu nhạt nhất còn phân biệt được với `paper` — chặng đỉnh của dải màn đăng nhập. */
  brandWash: '#F4FCF7',

  // ── Nhấn phụ ────────────────────────────────────────────────────
  orange: '#FF7A3D',
  orangeLt: '#FFF1E9',
  /** Sao đánh giá. */
  star: '#F5B921',
  /** Đỏ báo động — huy hiệu chưa đọc, hành động phá huỷ. */
  danger: '#FF4D4D',
  dangerLt: '#FFECEC',

  /** Nền của logo danh mục khi không tra được sắc riêng — xem `CATEGORY_TINTS`. */
  tintIdle: '#EDEEF0',
  tintIdleInk: '#6B7280',

  // ── Mặt kính ────────────────────────────────────────────────────
  /*
   * Trắng mờ đặt TRÊN nền thương hiệu hoặc trên ảnh. Cố tình là alpha, không phải một sắc của
   * `paper*`: nền bên dưới phải hắt qua được, đổi sang hex đục là mất luôn hiệu ứng kính.
   */
  /** Mảng sáng lớn — quầng đèn trên hero. */
  glass: 'rgba(255,255,255,0.16)',
  /**
   * Độ đục của TẤM kính — nút tròn, viên chip nổi trên nền màu.
   *
   * 0.30 chứ không phải 0.22 như bản đầu: một mảng trắng 22% trên nền màu đọc ra "màu nhạt hơn"
   * chứ không ra "vật liệu". Đây chỉ là lớp 1/3 — xem `glassFace` trong `GlassSurface.tsx`.
   */
  glassRaise: 'rgba(255,255,255,0.30)',
  /** Viền outline trên nền đậm — nét mảnh nên cần alpha cao hơn mới thấy. */
  glassLine: 'rgba(255,255,255,0.5)',
  /** Chữ phụ trên nền đậm: `paperWarm` đục quá gắt, hạ alpha cho nó lùi sau chữ chính. */
  glassTx: 'rgba(255,255,255,0.88)',
  /** Nút tròn nổi trên ẢNH (không phải trên nền thương hiệu) — gần đục để icon còn đọc được. */
  glassLift: 'rgba(255,255,255,0.92)',

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
 * Sắc NHẬN DẠNG của danh mục — nền cho logo, và mực cho chữ đặt trên nền đó.
 *
 * Bảng này thay việc dùng `NEW_PHOTOS` cho danh mục, và lý do không phải thẩm mỹ:
 *
 * 1. `NEW_PHOTOS` chỉ có BỐN màu, mà nó sinh ra để làm ảnh giả cho tin đăng — nơi trùng màu
 *    không nói sai điều gì. Một hàng 6 danh mục thì gần như chắc chắn có hai cái trùng, và ở
 *    đó màu đang được đọc là "danh mục nào", nên trùng là nói sai.
 * 2. Nó được tra bằng `gradOf(cat.id)`, tức băm ObjectId — thứ mà chính `Category.id` khai là
 *    "sinh lúc seed, đổi theo từng môi trường". Cùng một danh mục vì thế đổi màu giữa dev và
 *    prod, và đổi lần nữa sau mỗi lần seed lại. `CategoryLogo` tra bằng `slug` (khoá ổn định).
 *
 * MƯỜI sắc, không hơn: quá đó thì các sắc bắt đầu không phân biệt được bằng mắt ở cỡ 26px của
 * viên chip, mà 26px mới là nơi bảng này làm việc nhiều nhất.
 *
 * Bốn ô, ba nền khác nhau cho ba cỡ bề mặt:
 *
 * - `bg` nhạt có chủ ý — glyph là emoji và emoji tự nó đã đủ màu, nên nền phải lùi lại phía sau
 *   nó chứ không tranh. Đây là nền của logo cỡ nhỏ và vừa.
 * - `deep` ghép với `bg` thành gradient cho vòng tròn 74px ở bảng tin, để dải danh mục còn nói
 *   cùng thứ tiếng với dải "Nhóm quanh bạn" ngay dưới nó.
 * - `strong` là cặp ĐẬM cho mặt thẻ 132px của màn chọn danh mục, nơi chữ là màu trắng.
 * - `ink` là mực đọc được trên `bg`.
 *
 * `strong` nuốt luôn `CATEGORY_GRADS` — một bảng 8 màu từng nằm riêng trong `CategoryPicker` và
 * được tra bằng `CATEGORY_GRADS[i % length]`, tức theo VỊ TRÍ trong mảng. Nên đổi thứ tự hiển
 * thị của một danh mục là đổi luôn màu của nó, và màu thẻ ở màn đăng tin chưa bao giờ khớp màu
 * vòng tròn ở bảng tin. Gộp vào đây thì một danh mục có đúng một sắc, ở mọi cỡ, mọi màn.
 *
 * ponytail: cần danh mục CHỌN được màu của mình thì thêm cột `color` vào `Category` ở BE, đừng
 * nới bảng này — nới thêm chỉ làm các sắc gần nhau hơn mà vẫn không ai chọn được.
 */
export const CATEGORY_TINTS = [
  { bg: '#E4F7EC', deep: '#C4EDD7', ink: '#12855A', strong: ['#2FB56D', '#177F4C'] },
  { bg: '#E4F1FD', deep: '#C6E2FA', ink: '#1668B8', strong: ['#4A7FE0', '#2A55B0'] },
  { bg: '#EDEAFB', deep: '#D9D3F6', ink: '#5647C4', strong: ['#7C5CE0', '#5533B5'] },
  { bg: '#FDE8EE', deep: '#F9CEDB', ink: '#C03562', strong: ['#E85D8A', '#B93463'] },
  // Chặng tối `#96610C` chứ không phải `#AF7511` như sắc vàng thường thấy: trắng trên `#AF7511`
  // chỉ đạt 3.96:1, dưới ngưỡng 4.5 mà cả bảng `strong` cam kết (xem `CategoryPicker.tile`).
  { bg: '#FEF2DC', deep: '#FBE2B0', ink: '#A5700B', strong: ['#E0A32E', '#96610C'] },
  { bg: '#FFEBE0', deep: '#FFD5C0', ink: '#C4551F', strong: ['#F2683C', '#C7461F'] },
  { bg: '#DFF5F4', deep: '#BCE9E7', ink: '#0E7C79', strong: ['#2BAFA8', '#127E79'] },
  { bg: '#EFF7DC', deep: '#DDEEB4', ink: '#5E8215', strong: ['#7FA92E', '#5A7C15'] },
  { bg: '#E6ECFB', deep: '#CBD8F5', ink: '#35529E', strong: ['#5568C4', '#35429B'] },
  { bg: '#F6E9F7', deep: '#EDD2EF', ink: '#8B3D91', strong: ['#B052B8', '#82357F'] },
] as const satisfies readonly { bg: string; deep: string; ink: string; strong: Grad }[];

export type CategoryTint = (typeof CATEGORY_TINTS)[number];

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

/**
 * Thang KHOẢNG CÁCH. Trước đây theme không có token nào cho việc này, nên mỗi component tự
 * chọn số: đo ra `gap` rải rác 4, 6, 7, 8, 10, 11, 16 trên đúng năm file của bảng tin. Mắt
 * đọc ra sự tuỳ tiện đó thành 'rối' kể cả khi không chỉ ra được vì sao.
 *
 * Bậc 4 (`lg`) là khoảng cách GIỮA HAI KHỐI, và nó là đòn quyết định của cảm giác thoáng —
 * đừng hạ nó xuống để nhồi thêm nội dung vào một màn.
 */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Thang CỠ CHỮ — năm bậc, không hơn.
 *
 * Đo trước khi sửa: `FeedHighlights` dùng 9 cỡ khác nhau (11, 12, 12.5, 13, 14, 19, 21, 22,
 * 30), `FeedCard` 8 cỡ. Mỗi cỡ lẻ là một tầng phân cấp mà mắt phải xếp hạng, và quá bốn tầng
 * thì không còn tầng nào nổi lên — đó là lý do một màn 'nhiều cỡ chữ' trông chật hơn hẳn một
 * màn cùng lượng nội dung mà ít cỡ.
 *
 * `lineHeight` đi KÈM chứ không để mỗi chỗ tự đoán: chữ tiếng Việt có dấu cần khoảng 1.45×,
 * thấp hơn là dấu của dòng dưới chạm chân dòng trên.
 */
export const T = {
  /** Nhãn nhỏ, meta, viên chip. */
  xs: { fontSize: 11, lineHeight: 16 },
  /** Chữ phụ: mô tả, dòng thứ hai của thẻ. */
  sm: { fontSize: 13, lineHeight: 19 },
  /** Chữ thân — mặc định của app. */
  md: { fontSize: 15, lineHeight: 22 },
  /** Tiêu đề thẻ, tiêu đề mục. */
  lg: { fontSize: 18, lineHeight: 26 },
  /** Chỉ dùng cho MỘT dòng mỗi màn — lời chào, số liệu lớn. */
  xl: { fontSize: 24, lineHeight: 32 },
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

/**
 * Dải màu cố định của app — chặng đầu/chặng cuối cho `<LinearGradient>`.
 *
 * Ghép tay tại call-site là cách sinh ra dải PHẲNG mà không ai thấy: `profile` từng viết
 * `[C.cork, C.paper]`, hai token đó cùng về `#F1F2F4` sau đợt đổi màu nên hero mất hẳn gradient.
 * Gom về đây thì đợt đổi màu sau chỉ phải soi một chỗ.
 *
 * Chặng tắt dần phải là alpha-0 CỦA CHÍNH màu đó, không phải `'transparent'`: Android nội suy
 * `transparent` (= đen alpha 0) nên dải bị bẩn sắc đen ở quãng giữa.
 */
export const G = {
  /**
   * Hero bảng tin — dải thương hiệu duy nhất của app.
   *
   * Chiều ĐẢO so với bản trước (`[brand, brandDark]`, sáng → hơi tối). Đậm ở đỉnh rồi nhạt
   * dần xuống làm hai việc cùng lúc: cho mặt kính một nền đủ sâu ở nửa trên, và để mép dưới
   * của khối xanh gần với nền màn nên chỗ tiếp giáp tan ra thay vì thành một đường cắt.
   */
  brand: [C.brandDeep, C.brand],
  /** Đỉnh màn hồ sơ: mặt thẻ trắng chìm dần về nền màn. */
  hero: [C.paperWarm, C.paper],
  /** Nền màn đăng nhập/đăng ký — ngả thương hiệu ở đỉnh để hai màn này không chỉ là một mảng xám. */
  auth: [C.brandWash, C.corkDark],
  /** Quầng đèn hắt xuống của splash (đặt trên nền `desk` tối). */
  glow: [C.paper, 'rgba(241,242,244,0)'],
  /**
   * Vệt sáng chéo của mặt kính — lớp làm mắt đọc ra "bề mặt bóng" thay vì "màu nhạt hơn".
   *
   * Chặng cuối là 0.03 chứ không phải 0: alpha về 0 tuyệt đối làm cạnh dưới của vệt sáng thành
   * một đường cắt thấy được trên nền tối.
   */
  sheen: ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.03)'],
} as const satisfies Record<string, Grad>;
