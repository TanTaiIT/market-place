import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { C } from '@/theme';

/**
 * CSS gốc dùng 4 lớp radial-gradient lặp lại để tạo vân bần.
 * React Native không có repeating-gradient nên ta rải sẵn các chấm nhỏ
 * theo lưới cố định (deterministic, không random mỗi lần render).
 */
const CELL = 26;

function useDots(width: number, height: number) {
  return useMemo(() => {
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const dots: { x: number; y: number; s: number; c: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const seed = (r * 31 + col * 17) % 7;
        if (seed > 3) continue;
        const light = seed === 0;
        dots.push({
          x: col * CELL + ((r % 2) * CELL) / 2 + (seed * 3),
          y: r * CELL + seed * 2,
          s: 1.6 + (seed % 3) * 0.7,
          c: light ? 'rgba(255,255,255,0.07)' : `rgba(0,0,0,${0.06 + seed * 0.02})`,
        });
      }
    }
    return dots;
  }, [width, height]);
}

export function Corkboard({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { width, height } = useWindowDimensions();
  const dots = useDots(width, height);

  return (
    <View style={[styles.base, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {dots.map((d) => (
          <View
            key={`${d.x}-${d.y}`}
            style={{
              position: 'absolute',
              left: d.x,
              top: d.y,
              width: d.s,
              height: d.s,
              borderRadius: d.s,
              backgroundColor: d.c,
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: C.cork, overflow: 'hidden' },
});
