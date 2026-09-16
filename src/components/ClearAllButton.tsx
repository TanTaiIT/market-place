import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { C, F, R, S, T } from '@/theme';

/**
 * Nút "Xoá tất cả" ở góc phải thanh tiêu đề, kèm sẵn hộp xác nhận.
 *
 * Hộp xác nhận nằm TRONG component chứ không để mỗi màn tự gọi `Alert.alert`: đây là thao tác
 * không lùi lại được, và một nút xoá-hết mà chỗ dựng có thể quên bọc xác nhận là thứ sớm muộn
 * cũng có một chỗ quên. Ở đây thì không quên được — không có đường nào gọi `onConfirm` mà không
 * qua hộp thoại.
 *
 * `message` là prop bắt buộc vì nó phải nói HỆ QUẢ THẬT của từng màn, và hai màn đang dùng có
 * hệ quả khác nhau: hội thoại quay lại được khi người kia nhắn tiếp, thông báo thì không.
 */
export function ClearAllButton({
  label = 'Xoá tất cả',
  title,
  message,
  busy,
  onConfirm,
}: {
  label?: string;
  title: string;
  message: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const ask = () =>
    Alert.alert(title, message, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá tất cả', style: 'destructive', onPress: onConfirm },
    ]);

  return (
    <Pressable
      onPress={ask}
      disabled={busy}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={C.danger} />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: C.dangerLt,
    borderRadius: R.pill,
    paddingHorizontal: S.md,
    paddingVertical: 5,
    minWidth: 76,
    alignItems: 'center',
  },
  text: { fontFamily: F.uiBold, ...T.xs, color: C.danger },
});
