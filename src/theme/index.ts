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

export const shadowSoft = Platform.select({
  ios: {
    shadowColor: '#182412',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  default: { elevation: 2 },
}) as object;

/** Cặp màu gradient cho ảnh giả lập của từng tin (thay linear-gradient của web) */
export type Grad = readonly [string, string];
