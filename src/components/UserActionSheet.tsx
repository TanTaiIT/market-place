import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AdminUser } from '@/api/admin-people';
import { C, F } from '@/theme';

/**
 * Một ngăn cho cả ba thao tác nặng trên một tài khoản: khoá, gỡ án phạt đăng tin, điều chỉnh Xu.
 *
 * Gộp làm một vì cả ba có cùng hình dạng — đều đòi một câu lý do bắt buộc, đều không rút lại
 * được, và đều là quyền chỉ master có. Dựng ba modal gần giống nhau là ba chỗ để quên mất ô lý
 * do ở đúng cái thứ ba.
 *
 * `Alert.alert` không dùng được ở đây: Android không có `prompt()`, mà cả ba thao tác đều cần
 * chữ người dùng gõ chứ không chỉ một nút xác nhận.
 */

export type UserAction = 'lock' | 'unlock' | 'clear' | 'wallet';

export type UserActionInput = {
  /** Lý do khoá / gỡ án phạt, hoặc ghi chú của lượt điều chỉnh ví. */
  text: string;
  /** Chỉ có nghĩa với `wallet`; âm = trừ Xu. */
  amount: number;
  /** Chỉ có nghĩa với `wallet` — xem phần sinh khoá bên dưới. */
  idempotencyKey: string;
};

const COPY: Record<UserAction, { heading: string; label: string; submit: string; hint: string }> = {
  lock: {
    heading: 'Khoá tài khoản',
    label: 'Lý do khoá',
    submit: 'Khoá',
    hint: 'Tài khoản là toàn cục: khoá ở đây là khoá ở MỌI tổ chức người này đang tham gia.',
  },
  unlock: {
    heading: 'Mở khoá tài khoản',
    label: 'Lý do mở khoá',
    submit: 'Mở khoá',
    hint: 'Người này đăng nhập lại được ngay sau khi mở.',
  },
  clear: {
    heading: 'Gỡ án phạt đăng tin',
    label: 'Lý do gỡ',
    submit: 'Gỡ án phạt',
    hint: 'Bị 3 tin từ chối trong 7 ngày là khoá quyền đăng. Đây là đường duy nhất gỡ sớm — dùng khi máy quét chặn oan.',
  },
  wallet: {
    heading: 'Điều chỉnh ví Xu',
    label: 'Ghi chú vào sổ cái',
    submit: 'Ghi sổ',
    hint: 'BE không có đường đọc ví người khác, nên không hiện được số dư hiện tại ở đây. Số âm là trừ Xu.',
  },
};

/**
 * Khoá chống-bấm-đôi, sinh MỘT lần cho mỗi lần mở ngăn.
 *
 * Không có `crypto.randomUUID` trong Hermes và repo cố tình không thêm dependency chỉ để lấy
 * một chuỗi ngẫu nhiên. Thời điểm + 8 ký tự ngẫu nhiên là quá đủ: khoá chỉ cần duy nhất trong
 * phạm vi một người bấm trong vài giây, không phải duy nhất toàn cầu.
 */
const newKey = () => `adj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function UserActionSheet({
  action,
  user,
  pending,
  onSubmit,
  onClose,
}: {
  /** `null` = ngăn đang đóng. */
  action: UserAction | null;
  user: AdminUser | null;
  pending: boolean;
  onSubmit: (input: UserActionInput) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [key, setKey] = useState(newKey);

  // Khoá đổi khi ngăn MỞ, không phải khi bấm gửi: bấm hai lần trong cùng một lần mở phải là
  // cùng một khoá — đó chính là thứ ngăn cộng đôi Xu.
  useEffect(() => {
    if (!action) return;
    setText('');
    setAmount('');
    setKey(newKey());
  }, [action, user?.id]);

  if (!action || !user) return null;
  const copy = COPY[action];
  const isWallet = action === 'wallet';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.heading}>{copy.heading}</Text>
          <Text style={styles.who}>
            {user.name} · {user.email}
          </Text>

          {isWallet && (
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Số Xu (ví dụ 500, hoặc -200 để trừ)"
              placeholderTextColor={C.deskTxtDim}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.amount]}
            />
          )}

          <Text style={styles.label}>{copy.label.toUpperCase()}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Bắt buộc — người sau đọc lại sẽ chỉ còn dòng này"
            placeholderTextColor={C.deskTxtDim}
            maxLength={300}
            multiline
            style={styles.input}
          />

          <Text style={styles.hint}>{copy.hint}</Text>

          <View style={styles.actions}>
            <Pressable onPress={onClose} hitSlop={6}>
              <Text style={styles.cancel}>Huỷ</Text>
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={() =>
                onSubmit({ text: text.trim(), amount: Number(amount.trim()), idempotencyKey: key })
              }
              style={({ pressed }) => [
                styles.submit,
                pending && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.submitText}>{pending ? 'Đang gửi...' : copy.submit}</Text>
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
    gap: 10,
  },
  heading: { fontFamily: F.uiBold, fontSize: 15, color: C.paper },
  who: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },
  label: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.3, color: C.deskTxtDim },
  input: {
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: C.deskRaise,
    borderRadius: 8,
    padding: 11,
    fontFamily: F.ui,
    fontSize: 12.5,
    color: C.deskTxt,
  },
  amount: { minHeight: 0, fontFamily: F.monoBold, fontSize: 15 },
  hint: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.deskTxtDim },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancel: { fontFamily: F.ui, fontSize: 13, color: C.deskTxtDim },
  submit: { backgroundColor: C.pin, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  submitText: { fontFamily: F.uiBold, fontSize: 13, color: C.paperWarm },
});
