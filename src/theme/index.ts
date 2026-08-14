import { Platform } from 'react-native';

/** Bảng màu lấy nguyên từ :root của prototype */
export const C = {
  ink: '#182412',
  inkSoft: '#4A5540',
  paper: '#F3EFE1',
  paperWarm: '#FAF8F0',
  cork: '#B98851',
  corkDark: '#8C6539',
  pin: '#E8432E',
  pinDark: '#B92E1D',
  /** Vệt sáng trên đầu đinh ghim — luôn đi cùng `pin`, không dùng làm màu nền. */
  pinLight: '#ff9b8a',
  tape: '#FFE066',
  tapeDark: '#E0B93F',
  moss: '#3F6B4A',
  mossLight: '#E6EEE3',
  amber: '#D9A566',
  line: '#E5DEC8',
  lineInput: '#D8D0BC',
  muted: '#B7AE95',
  chipIdle: '#F0F0EA',
  sand: '#F0EAD8',
  tapeInk: '#5C4A0A',
  amberInk: '#4A2E0B',
  /** Lớp phủ mờ trên ảnh thật để chữ đè lên vẫn đọc được */
  scrim: 'rgba(24,36,18,0.32)',
  /** Lớp phủ báo lỗi trên ảnh — `pinDark` pha alpha */
  scrimError: 'rgba(185,46,29,0.72)',
  /** Nền màn xem ảnh phóng to. Đậm hơn hẳn `scrim` vì lúc này ảnh là nội dung, không phải nền */
  scrimPhoto: 'rgba(9,13,7,0.97)',

  /*
   * Bàn quản trị dùng nền tối — không phải đổi theme, mà là phân vai: màn người dùng là tờ
   * giấy ghim lên bảng bần, màn quản trị là mặt bàn làm việc phía sau. Tách tiền tố `desk*`
   * để không ai lỡ tay dùng nền tối cho màn người dùng.
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
  /** `moss` bản sáng, đủ tương phản trên nền tối — `C.moss` chìm mất ở đó. */
  mossBright: '#5FA36E',
  mossDeep: '#2C5238',
  sky: '#7FA8C9',
  /** Chữ trạng thái trên nền tối: `moss`/`pin` gốc quá tối để đọc. */
  okText: '#7FBE8C',
  badText: '#F2705E',
  /** Nền huy hiệu trạng thái — cùng màu chữ pha alpha, để token hoá thay vì rải rgba ở call-site. */
  okTint: 'rgba(95,163,110,0.14)',
  warnTint: 'rgba(255,224,102,0.14)',
  badTint: 'rgba(232,67,46,0.15)',
  mutedTint: 'rgba(243,239,225,0.07)',
} as const;

/** Tên font sau khi load bằng @expo-google-fonts */
export const F = {
  hand: 'Kalam_700Bold',
  handLight: 'Kalam_400Regular',
  ui: 'Manrope_500Medium',
  uiSemi: 'Manrope_600SemiBold',
  uiBold: 'Manrope_700Bold',
  uiBlack: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_600SemiBold',
} as const;

/** Tương đương --shadow: 0 8px 24px rgba(24,36,18,0.16) */
export const shadow = Platform.select({
  ios: {
    shadowColor: '#182412',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 4 },
}) as object;

/** Cặp màu gradient cho ảnh giả lập của từng tin (thay linear-gradient của web) */
export type Grad = readonly [string, string];
