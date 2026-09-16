import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { C, F, R, S } from '@/theme';

/**
 * Ô nhập mã 6 số + bộ đếm ngược cho nút "gửi lại" — dùng chung cho xác thực email và đặt lại
 * mật khẩu.
 *
 * Tách ra khi có call-site thứ hai, không sớm hơn (`folder.convention` §1). Hai màn kia chỉ
 * khác nhau ở chỗ gửi mã đi đâu và mã đúng thì làm gì; phần người dùng chạm vào thì phải giống
 * hệt, và giống nhau bằng cách dùng chung một component chứ không bằng cách chép số.
 */

export const CODE_LENGTH = 6;

/**
 * MỘT ô cho cả 6 số, không phải 6 ô rời.
 *
 * Sáu ô trông giống bản mẫu hơn nhưng hỏng đúng thao tác người dùng hay làm nhất: dán mã copy
 * từ thư. Chúng cũng phải tự lo focus, phím xoá và bàn phím che — ba chỗ dễ sai mà không đổi
 * lại được gì.
 */
export function CodeField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="sms-otp"
      autoFocus={autoFocus}
      maxLength={CODE_LENGTH}
      placeholder="••••••"
      placeholderTextColor={C.muted}
      style={styles.input}
    />
  );
}

/**
 * Đếm ngược tới lúc bấm gửi lại được. `start(seconds)` nhận thẳng con số BE trả về, thay vì
 * lặp lại hằng số 60 ở client — server đổi hạn chờ thì client theo, không phải sửa hai nơi.
 */
export function useResendCountdown() {
  const [left, setLeft] = useState(0);

  // Dọn interval khi rời màn, nếu không nó chạy tiếp trên một component đã unmount.
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [left]);

  return { left, start: setLeft };
}

const styles = StyleSheet.create({
  /* Giãn chữ rộng + canh giữa: sáu chữ số phải đọc được thành sáu, không thành một số. */
  input: {
    fontFamily: F.uiBold,
    fontSize: 30,
    letterSpacing: 12,
    textAlign: 'center',
    color: C.ink,
    backgroundColor: C.paperWarm,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.lineInput,
    paddingVertical: S.lg,
    marginBottom: S.xl,
  },
});
