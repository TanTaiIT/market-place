import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F } from '@/theme';

/**
 * Hỏi lý do trước khi từ chối một đơn xin gia nhập.
 *
 * Lý do KHÔNG bắt buộc theo hợp đồng BE, nhưng người gửi đọc được nó ở màn của họ — từ chối
 * trống nghĩa là họ thấy đơn hỏng mà không biết sửa gì, rồi gửi lại y hệt sau khi hết cooldown.
 *
 * Chip có sẵn cho ca thường gặp, ô nhập tự do cho phần còn lại: bắt gõ tay mọi lần thì người
 * duyệt sẽ bỏ trống, mà chỉ cho chọn chip thì ca lạ không diễn đạt được.
 */

const PRESETS = [
  'Không đúng tên thật',
  'Không thuộc tổ chức này',
  'Thiếu thông tin xác minh',
  'Sai nhóm/lớp',
];

export function RejectReasonSheet({
  name,
  onSubmit,
  onClose,
  pending,
}: {
  /** Tên người gửi đơn. `null` = đóng ngăn. */
  name: string | null;
  onSubmit: (reason: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal visible={name !== null} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} />

      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.heading}>Từ chối đơn của {name}</Text>

          <View style={styles.chips}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setReason(p)}
                style={({ pressed }) => [
                  styles.chip,
                  reason === p && styles.chipOn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.chipText, reason === p && { color: C.paper }]}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Hoặc viết lý do khác..."
            placeholderTextColor={C.deskTxtDim}
            maxLength={300}
            multiline
            style={styles.input}
          />

          <View style={styles.actions}>
            <Pressable onPress={close} hitSlop={6}>
              <Text style={styles.cancel}>Huỷ</Text>
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={() => onSubmit(reason.trim())}
              style={({ pressed }) => [
                styles.submit,
                pending && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.submitText}>{pending ? 'Đang gửi...' : 'Từ chối'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  heading: { fontFamily: F.uiBold, fontSize: 15, color: C.paper },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipOn: { borderColor: C.pin, backgroundColor: C.badTint },
  chipText: { fontFamily: F.ui, fontSize: 11.5, color: C.deskTxtSoft },
  input: {
    minHeight: 64,
    textAlignVertical: 'top',
    backgroundColor: C.deskRaise,
    borderRadius: 8,
    padding: 11,
    fontFamily: F.ui,
    fontSize: 12.5,
    color: C.deskTxt,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancel: { fontFamily: F.ui, fontSize: 13, color: C.deskTxtDim },
  submit: { backgroundColor: C.pin, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  submitText: { fontFamily: F.uiBold, fontSize: 13, color: C.paperWarm },
});
