import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Field, PinButton } from './ui';
import { C, F } from '@/theme';

/**
 * Khối "Đổi mật khẩu" trên màn Cài đặt. Thuần trình bày: hai ô nhập + ô nhập lại + nút, báo lên
 * `onSubmit` — mutation ở lại route (ranh giới đang đúng trên toàn codebase).
 *
 * Tự kiểm hai thứ mà BE cũng sẽ kiểm (tối thiểu 8 ký tự, hai lần nhập khớp) để nút chỉ sáng khi
 * gửi có nghĩa; lỗi thật (sai mật khẩu hiện tại, tài khoản Google chưa có mật khẩu) thì BE nói.
 */
export function ChangePasswordCard({
  busy,
  onSubmit,
}: {
  busy: boolean;
  /** `reset` để route xoá ba ô sau khi đổi thành công — mật khẩu không được nằm lại trên màn. */
  onSubmit: (input: { currentPassword: string; newPassword: string }, reset: () => void) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');

  const mismatch = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.length >= 8 && next === again;
  const reset = () => {
    setCurrent('');
    setNext('');
    setAgain('');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>ĐỔI MẬT KHẨU</Text>
      <Text style={styles.note}>
        Các thiết bị khác sẽ bị đăng xuất sau khi đổi. Tài khoản đăng nhập bằng Google thì đặt mật
        khẩu lần đầu qua "Quên mật khẩu" ở màn đăng nhập.
      </Text>
      <Field
        label="Mật khẩu hiện tại"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
      />
      <Field
        label="Mật khẩu mới (từ 8 ký tự)"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
      />
      <Field
        label="Nhập lại mật khẩu mới"
        value={again}
        onChangeText={setAgain}
        secureTextEntry
        autoCapitalize="none"
      />
      {mismatch && <Text style={styles.error}>Hai mật khẩu mới chưa khớp nhau</Text>}
      <PinButton
        label="Đổi mật khẩu"
        loading={busy}
        disabled={!ready}
        onPress={() => onSubmit({ currentPassword: current, newPassword: next }, reset)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 28, gap: 6 },
  label: { fontFamily: F.uiBold, fontSize: 11, letterSpacing: 1.2, color: C.inkSoft },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, lineHeight: 17, marginBottom: 6 },
  error: { fontFamily: F.ui, fontSize: 12, color: C.danger },
});
