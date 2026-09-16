import React, { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { C, F, R, S } from '@/theme';

/**
 * Bọc một dòng danh sách: vuốt sang trái lộ nút Xoá, bấm vào thì hỏi lại rồi mới gọi `onConfirm`.
 *
 * Hộp xác nhận nằm TRONG đây, cùng lý do với `ClearAllButton`: không có đường nào chạm tới hành
 * động xoá mà không đi qua nó.
 *
 * Phải là component riêng chứ không viết thẳng trong `renderItem`: mỗi dòng cần `ref` của riêng
 * nó để đóng ngăn nút lại, mà một `useRef` khai ở thân màn hình thì cả danh sách dùng CHUNG một
 * ô — dòng vuốt sau ghi đè dòng vuốt trước, và nút Xoá của dòng này đóng ngăn của dòng kia.
 */

/*
 * Ngăn đang mở, ở cấp MODULE.
 *
 * Chỉ một dòng được phơi nút Xoá tại một thời điểm: hai dòng cùng mở thì cú chạm tiếp theo rất
 * dễ trúng nhầm cái, và đây là nút không lùi lại được. Trạng thái này vốn thuộc về "cả danh
 * sách", không thuộc về dòng nào — nên nó nằm ngoài component. Không phải state React vì không
 * có gì cần vẽ lại: chính `ReanimatedSwipeable` chạy animation đóng.
 */
let openRow: SwipeableMethods | null = null;

/** Kéo qua bao nhiêu điểm thì nhả tay là mở hẳn ngăn nút, không đàn về. */
const THRESHOLD = 40;

export function SwipeToDelete({
  title,
  message,
  onConfirm,
  children,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const row = useRef<SwipeableMethods | null>(null);

  const close = () => row.current?.close();

  const ask = () =>
    Alert.alert(title, message, [
      // Huỷ phải đóng ngăn: để nút Xoá phơi ra sau khi người dùng vừa từ chối xoá là mời họ
      // bấm nhầm lần nữa.
      { text: 'Huỷ', style: 'cancel', onPress: close },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          close();
          onConfirm();
        },
      },
    ]);

  return (
    <ReanimatedSwipeable
      ref={row}
      friction={2}
      rightThreshold={THRESHOLD}
      // Không cho kéo lố qua mép: ngăn chỉ có một nút, kéo lố ra là một khoảng trống rỗng.
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (openRow && openRow !== row.current) openRow.close();
        openRow = row.current;
      }}
      onSwipeableWillClose={() => {
        if (openRow === row.current) openRow = null;
      }}
      renderRightActions={() => (
        <Pressable onPress={ask} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.text}>Xoá</Text>
        </Pressable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 76,
    marginLeft: S.sm,
    borderRadius: R.md,
    backgroundColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: F.uiBold, fontSize: 13, color: '#fff' },
});
