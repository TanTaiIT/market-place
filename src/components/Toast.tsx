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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const insets = useSafeAreaInsets();
  const y = useSharedValue(30);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      setMsg(message);
      y.value = withSpring(0, { damping: 14, stiffness: 160 });
      opacity.value = withTiming(1, { duration: 200 });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        y.value = withTiming(30, { duration: 250 });
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
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { bottom: insets.bottom + 96 }, aStyle]}
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
