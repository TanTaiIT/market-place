import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PinButton } from './ui';
import { C, F, R, shadow } from '@/theme';

/**
 * Thanh nút dính đáy của màn soạn template.
 *
 * Phải nằm NGOÀI vùng cuộn mới dính được — cùng lý do đã ghi ở `post.tsx`. Tách thành component
 * vì route đã chạm trần 250 dòng (HARD#11).
 *
 * "Lưu template" KHÔNG phát hành: người gọi lưu nháp trước rồi mới hỏi, vì phát hành là bước
 * không lùi lại được (bản đã phát hành bất biến, tin đăng ghim version của nó).
 */
export function TemplateSaveBar({
  busy,
  onPreview,
  onSave,
}: {
  busy: boolean;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onPreview}
        style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.ghostText}>Xem trước</Text>
      </Pressable>
      <PinButton label="📌 Lưu template" onPress={onSave} loading={busy} style={styles.save} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.paper,
  },
  ghost: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: R.md,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.lineInput,
    ...shadow,
  },
  ghostText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink },
  save: { flex: 1 },
});
