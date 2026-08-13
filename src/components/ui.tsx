import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { C, F, shadow } from '@/theme';

/* ------------------------------- chips ------------------------------- */

const CHIP_TILTS = [-1.5, 1.2, -0.8, 1.6, -1.1];

/** Băng dính nghiêng ở hàng lọc danh mục của bảng tin */
export function TapeChip({
  label,
  active,
  index = 0,
  onPress,
}: {
  label: string;
  active?: boolean;
  index?: number;
  onPress: () => void;
}) {
  const tilt = active ? 0 : CHIP_TILTS[index % CHIP_TILTS.length];
  const alt = !active && index % 2 === 1;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        alt && { backgroundColor: C.chipIdle },
        active && { backgroundColor: C.pin },
        { transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? 0.94 : active ? 1.05 : 1 }] },
      ]}
    >
      <Text style={[styles.chipText, alt && { color: C.inkSoft }, active && { color: '#fff' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Nhãn băng dính vuông dùng ở màn Đăng tin */
export function CatTape({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.catTape,
        active && { backgroundColor: C.tape, transform: [{ scale: 1.06 }] },
      ]}
    >
      <Text style={[styles.catTapeText, active && { color: C.tapeInk }]}>{label}</Text>
    </Pressable>
  );
}

/* --------------------------- 3D press button --------------------------- */

/**
 * Tái tạo `box-shadow: 0 6px 0 var(--pin-dark)` của web:
 * lớp nền tối cố định + mặt nút trượt xuống khi nhấn.
 */
export function PinButton({
  label,
  onPress,
  loading,
  disabled,
  depth = 6,
  tone = 'pin',
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  depth?: number;
  /** `ok` = hành động thuận (duyệt tin) — cùng khối 3D, chỉ đổi bảng màu. */
  tone?: 'pin' | 'ok';
  style?: ViewStyle;
}) {
  const [pressed, setPressed] = React.useState(false);
  const off = pressed ? depth - 2 : 0;
  const isOff = disabled || loading;
  const ok = tone === 'ok';

  return (
    <View style={[{ paddingBottom: depth }, style]}>
      <View
        style={[
          styles.btnShadowLayer,
          { bottom: 0, opacity: isOff ? 0.5 : 1 },
          ok && { backgroundColor: C.mossDeep },
        ]}
      />
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={onPress}
        disabled={isOff}
        style={[
          styles.btnFace,
          ok && { backgroundColor: C.mossBright },
          { transform: [{ translateY: off }] },
          isOff && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={ok ? C.desk : '#fff'} />
        ) : (
          <Text style={[styles.btnText, ok && { color: C.desk }]}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.ghostBtn}>
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------ headers ------------------------------ */

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed')));
  return (
    <View style={styles.header}>
      <Pressable onPress={back} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** Tiêu đề không có nút quay lại (dùng cho tab) */
export function TabHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/* ---------------------------- empty & load ---------------------------- */

export function EmptyState({
  icon,
  text,
  onDark,
}: {
  icon: string;
  text: string;
  onDark?: boolean;
}) {
  return (
    <Animated.View entering={FadeIn} style={styles.empty}>
      <Text style={{ fontSize: 32, marginBottom: 8 }}>{icon}</Text>
      <Text style={[styles.emptyText, { color: onDark ? C.paperWarm : C.inkSoft }]}>{text}</Text>
    </Animated.View>
  );
}

export function Loading({ onDark }: { onDark?: boolean }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={onDark ? C.paperWarm : C.pin} />
    </View>
  );
}

/* ------------------------------- inputs ------------------------------- */

export function Field({
  label,
  hand,
  onDark,
  style,
  ...props
}: TextInputProps & {
  label: string;
  hand?: boolean;
  /** Đặt trên nền tối của bàn quản trị — `inkSoft` ở đó gần như không đọc được. */
  onDark?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, onDark && { color: C.deskTxtDim }]}>{label}</Text>
      <TextInput
        placeholderTextColor={onDark ? C.deskTxtDim : C.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          hand && { fontFamily: F.handLight, fontSize: 18 },
          onDark && { color: C.deskTxt, borderBottomColor: C.deskLineStrong },
          focused && { borderBottomColor: C.pin },
          style,
        ]}
      />
    </View>
  );
}

export function Avatar({
  text,
  size = 36,
  color = C.moss,
  textColor = '#fff',
  ring,
}: {
  text: string;
  size?: number;
  color?: string;
  textColor?: string;
  ring?: boolean;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ring && { borderWidth: 2, borderColor: C.paperWarm },
        shadow,
      ]}
    >
      <Text style={{ color: textColor, fontFamily: F.uiBold, fontSize: size * 0.36 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.tape,
    borderRadius: 3,
    marginRight: 8,
    ...shadow,
  },
  chipText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.tapeInk },

  catTape: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: C.chipIdle,
    borderRadius: 3,
    marginRight: 8,
    marginBottom: 8,
  },
  catTapeText: { fontFamily: F.uiBold, fontSize: 12, color: C.inkSoft },

  btnShadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    height: '100%',
    backgroundColor: C.pinDark,
    borderRadius: 10,
  },
  btnFace: {
    backgroundColor: C.pin,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontFamily: F.uiBlack, fontSize: 15 },

  ghostBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C9BE9F',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ghostText: { fontFamily: F.uiSemi, fontSize: 13.5, color: C.inkSoft },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  backArrow: { fontSize: 16, color: C.ink, lineHeight: 20 },
  headerTitle: { fontFamily: F.hand, fontSize: 24, color: C.ink },

  empty: { paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' },
  emptyText: { fontFamily: F.uiSemi, fontSize: 13, textAlign: 'center' },

  field: { marginBottom: 18 },
  fieldLabel: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.inkSoft,
    marginBottom: 6,
  },
  input: {
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    paddingVertical: 8,
    paddingHorizontal: 2,
    fontFamily: F.ui,
    fontSize: 15,
    color: C.ink,
  },
});
