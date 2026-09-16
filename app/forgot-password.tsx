import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CODE_LENGTH, CodeField, useResendCountdown } from '@/components/CodeField';
import { Field, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from '@/queries/auth';
import { C, F, S, T } from '@/theme';

/**
 * Quên mật khẩu — MỘT màn, BA bước.
 *
 * Ba chứ không hai, và lý do là trần 5 lần gõ sai của mã: gộp "nhập mã" với "đặt mật khẩu" thì
 * mỗi lần gõ nhầm mã bắt người dùng gõ lại cả mật khẩu — một ô họ không nhìn thấy để soát — mà
 * mỗi lần gõ lại vẫn đốt một lượt trong năm lượt đó. Năm lần fat-finger là mã chết, dù họ chưa
 * hề sai ở phần mật khẩu.
 *
 * Không tách thành ba route vì email và vé phải đi cùng người dùng qua các bước: truyền qua
 * params là ném chúng vào URL, nơi deep-link và log của navigator đọc được. Giữ trong state của
 * chính màn này thì chúng không rời khỏi bộ nhớ.
 *
 * Màn này nằm ngoài cổng đăng nhập (`app/_layout.tsx`, khối `guard={!isAuthenticated}`) — người
 * quên mật khẩu theo định nghĩa là người không vào được.
 */

/** Khớp `resetPasswordSchema.password` của BE — chặn tại chỗ để khỏi mất một vòng mạng. */
const MIN_PASSWORD = 6;

type Step = 'email' | 'code' | 'password';

export default function ForgotPassword() {
  const router = useRouter();
  const toast = useToast();
  const forgot = useForgotPassword();
  const verifyCode = useVerifyResetCode();
  const reset = useResetPassword();
  const { left: waitLeft, start: startCountdown } = useResendCountdown();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');

  const sendCode = () =>
    forgot.mutate(email.trim().toLowerCase(), {
      onSuccess: () => {
        setStep('code');
        // 60 giây là hạn chờ của BE. Hằng số vì `forgot` cố ý trả thân rỗng — không nói gì là
        // một phần của việc không lộ ra địa chỉ này có tài khoản hay không.
        startCountdown(60);
      },
      onError: (e: Error) => toast(`⚠️ ${e.message}`),
    });

  const submitCode = () =>
    verifyCode.mutate(
      { email: email.trim().toLowerCase(), code },
      {
        onSuccess: (resetToken) => {
          setTicket(resetToken);
          setStep('password');
        },
        onError: (e: Error) => {
          setCode('');
          toast(`⚠️ ${e.message}`);
        },
      },
    );

  const submitPassword = () =>
    reset.mutate(
      { email: email.trim().toLowerCase(), resetToken: ticket, password },
      {
        onSuccess: () => {
          toast('✅ Đã đặt lại mật khẩu, đăng nhập lại nhé');
          // `replace` chứ không `push`: mật khẩu đã đổi nên quay lại màn này là quay lại một
          // cái vé vừa chết.
          router.replace('/login');
        },
        onError: (e: Error) => {
          /*
           * Vé chỉ hỏng vì hết hạn hoặc đã dùng — cả hai đều phải quay về XIN MÃ MỚI, không
           * phải gõ lại mật khẩu trên một cái vé đã chết. Ở lại bước 3 là mời người dùng thử
           * lại một thao tác không bao giờ thành công.
           */
          toast(`⚠️ ${e.message}`);
          setTicket('');
          setCode('');
          setStep('code');
        },
      },
    );

  const canSend = /.+@.+\..+/.test(email.trim());

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Quên mật khẩu" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 'email' && (
            <>
              <Text style={styles.lead}>
                Nhập địa chỉ email của tài khoản. Nếu địa chỉ đó có tài khoản, chúng tôi gửi tới
                một mã {CODE_LENGTH} số.
              </Text>
              <Field
                label="Email"
                placeholder="email@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
              />
              <PinButton
                label="Gửi mã"
                tone="ok"
                onPress={sendCode}
                disabled={!canSend}
                loading={forgot.isPending}
              />
            </>
          )}

          {step === 'code' && (
            <>
              {/*
                "Nếu địa chỉ này có tài khoản" chứ không "đã gửi tới email của bạn" — BE trả 200
                cho cả địa chỉ không tồn tại để không thành máy dò, nên app hứa chắc là app nói
                sai với đúng người vừa gõ nhầm địa chỉ.
              */}
              <Text style={styles.lead}>
                Nếu <Text style={styles.email}>{email.trim()}</Text> có tài khoản, mã {CODE_LENGTH}{' '}
                số đã được gửi tới đó. Mã có hiệu lực trong 10 phút.
              </Text>

              <CodeField value={code} onChange={setCode} autoFocus />

              <PinButton
                label="Xác minh mã"
                tone="ok"
                onPress={submitCode}
                disabled={code.length < CODE_LENGTH}
                loading={verifyCode.isPending}
              />

              <Pressable
                onPress={sendCode}
                disabled={waitLeft > 0 || forgot.isPending}
                hitSlop={8}
                style={styles.link}
              >
                <Text style={[styles.linkText, waitLeft > 0 && { color: C.muted }]}>
                  {waitLeft > 0 ? `Gửi lại sau ${waitLeft}s` : 'Không nhận được mã? Gửi lại'}
                </Text>
              </Pressable>

              <Pressable onPress={() => setStep('email')} hitSlop={8} style={styles.link}>
                <Text style={styles.backText}>Đổi địa chỉ email</Text>
              </Pressable>
            </>
          )}

          {step === 'password' && (
            <>
              <Text style={styles.lead}>
                Mã hợp lệ. Đặt mật khẩu mới cho <Text style={styles.email}>{email.trim()}</Text>.
              </Text>

              <Field
                label="Mật khẩu mới"
                placeholder={`Tối thiểu ${MIN_PASSWORD} ký tự`}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                autoFocus
              />

              <PinButton
                label="Đặt lại mật khẩu"
                tone="ok"
                onPress={submitPassword}
                disabled={password.length < MIN_PASSWORD}
                loading={reset.isPending}
              />

              {/* Nói ra hệ quả TRƯỚC khi bấm: người dùng không đoán được, và nếu họ đang đăng
                  nhập ở máy khác thì cần biết máy đó sắp bị đăng xuất. */}
              <Text style={styles.note}>
                Đặt lại mật khẩu sẽ đăng xuất tài khoản này khỏi mọi thiết bị khác.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.xxl },
  lead: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginBottom: S.xl },
  email: { fontFamily: F.uiBold, color: C.ink },
  note: { fontFamily: F.ui, ...T.xs, color: C.muted, textAlign: 'center', marginTop: S.lg },

  link: { alignSelf: 'center', marginTop: S.md, padding: S.sm },
  linkText: { fontFamily: F.uiBold, ...T.sm, color: C.brandTx },
  backText: { fontFamily: F.ui, ...T.sm, color: C.muted },
});
