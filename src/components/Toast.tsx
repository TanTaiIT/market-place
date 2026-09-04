import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, shadow } from '@/theme';

type ToastCtx = (message: string) => void;
const Ctx = createContext<ToastCtx>(() => {});

export const useToast = () => useContext(Ctx);

/** Khoảng hở dưới thanh trạng thái. Nhỏ hơn nữa thì toast dính vào giờ/pin của hệ điều hành. */
const TOP_GAP = 12;

/**
 * Chỗ nghỉ của toast khi ẩn: NGOÀI màn, phía TRÊN.
 *
 * Dấu âm đi cùng việc toast nằm ở đỉnh — nó phải rơi xuống rồi thụt lên đúng hướng nó biến mất.
 * Để dương như hồi toast còn ở đáy thì toast trên đỉnh lại bay vào từ dưới lên, tức là đi xuyên
 * qua chính chỗ nó sắp đứng.
 */
const HIDDEN_Y = -30;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const insets = useSafeAreaInsets();
  const y = useSharedValue(HIDDEN_Y);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      setMsg(message);
      y.value = withSpring(0, { damping: 14, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 200 });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        y.value = withTiming(HIDDEN_Y, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 });
      }, 1800);
    },
    [opacity, y],
  );

  const aStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Ctx.Provider value={show}>
      {children}
      {/* Neo theo `insets.top` chứ không phải một số cố định: tai thỏ và thanh trạng thái mỗi
          máy một chiều cao, đặt số chết là máy này vừa khít thì máy kia toast chui vào giờ/pin. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { top: insets.top + TOP_GAP }, aStyle]}
      >
        <Text style={styles.text}>{msg}</Text>
      </Animated.View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: C.moss,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 100,
    ...shadow,
  },
  text: { color: '#fff', fontFamily: F.uiBold, fontSize: 13.5 },
});
