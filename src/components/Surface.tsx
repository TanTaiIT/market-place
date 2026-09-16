import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { C } from '@/theme';

/**
 * Nền màn hình của giao diện mới — PHẲNG.
 *
 * Thay `Corkboard`: bản cũ rải ~400 chấm nhỏ để giả vân bần (React Native không có
 * `repeating-gradient`). Hệ mới nền là một mảng xám `--bg` duy nhất, nên chỗ này không còn gì
 * để vẽ — giữ component lại vì ba màn đang dùng nó làm khung, và để lần sau đổi nền chỉ sửa
 * một chỗ.
 */
export function Surface({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.base, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: C.paper },
});
