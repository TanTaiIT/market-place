import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CODE_LENGTH, CodeField, useResendCountdown } from '@/components/CodeField';
import { PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSendEmailCode, useVerifyEmail } from '@/queries/auth';
import { useProfile } from '@/queries/listings';
import { C, F, S, T } from '@/theme';

/**
 * Nhập mã 6 số gửi về hộp thư.
 *
 * Màn này KHÔNG chặn đường: bỏ qua được, và người dùng vẫn dùng app bình thường. Xác thực email
 * hiện chỉ là một dấu trên hồ sơ, chưa gác tính năng nào — muốn nó gác đăng tin thì đó là một
 * quyết định sản phẩm riêng, phải sửa cả BE.
 *
 * Lối vào thứ hai là dải cảnh báo ở màn Cá nhân, nên bấm "Để sau" không phải là đóng cửa vĩnh
 * viễn — đó là điều kiện để nút đó tồn tại.
 */


export default function VerifyEmail() {
  const router = useRouter();
  const toast = useToast();
  const { data: profile } = useProfile();
  const send = useSendEmailCode();
  const verify = useVerifyEmail();

  const [code, setCode] = useState('');
  const { left: waitLeft, start: startCountdown } = useResendCountdown();

  /**
   * `useCallback` chỉ để effect bên dưới khai đủ dependency mà không phải tắt lint. Danh tính
   * của `send` đổi theo từng bước trạng thái của mutation nên effect CÓ chạy lại — vô hại, vì
   * `sentOnce` mới là thứ quyết định có gửi hay không.
   */
  const resend = useCallback(() => {
    send.mutate(undefined, {
      onSuccess: (r) => startCountdown(r.resendAfterSeconds),
      onError: (e: Error) => toast(`⚠️ ${e.message}`),
    });
  }, [send, toast, startCountdown]);

  /*
   * Tự gửi mã đúng MỘT lần khi mở màn — người vừa đăng ký không nên phải bấm thêm một nút để
   * bắt đầu. Khoá bằng ref chứ không bằng state: React 19 chạy effect hai lượt ở chế độ dev,
   * và lượt thứ hai sẽ ăn 429 rồi hiện một câu báo lỗi cho thao tác người dùng không hề làm.
   */
  const sentOnce = useRef(false);
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    resend();
  }, [resend]);

  const submit = () =>
    verify.mutate(code, {
      onSuccess: () => {
        toast('✅ Đã xác thực email');
        leave();
      },
      onError: (e: Error) => {
        // Xoá ô nhập: gõ lại 6 số dễ hơn sửa giữa một chuỗi sai, và nó nói rõ mã đó hỏng rồi.
        setCode('');
        toast(`⚠️ ${e.message}`);
      },
    });

  const leave = () =>
    router.canGoBack() ? router.back() : router.replace('/(tabs)/feed');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Xác thực email" onBack={leave} />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.lead}>
          Chúng tôi vừa gửi mã {CODE_LENGTH} số tới{' '}
          <Text style={styles.email}>{profile?.email ?? 'hộp thư của bạn'}</Text>. Mã có hiệu lực
          trong 10 phút.
        </Text>

        <CodeField value={code} onChange={setCode} autoFocus />

        <PinButton
          label="Xác nhận"
          tone="ok"
          onPress={submit}
          disabled={code.length < CODE_LENGTH}
          loading={verify.isPending}
        />

        <Pressable
          onPress={resend}
          disabled={waitLeft > 0 || send.isPending}
          hitSlop={8}
          style={styles.resend}
        >
          <Text style={[styles.resendText, waitLeft > 0 && { color: C.muted }]}>
            {waitLeft > 0 ? `Gửi lại sau ${waitLeft}s` : 'Không nhận được mã? Gửi lại'}
          </Text>
        </Pressable>

        <Pressable onPress={leave} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>Để sau</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { flex: 1, paddingHorizontal: S.lg, paddingTop: S.lg },
  lead: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginBottom: S.xl },
  email: { fontFamily: F.uiBold, color: C.ink },


  resend: { alignSelf: 'center', marginTop: S.lg, padding: S.sm },
  resendText: { fontFamily: F.uiBold, ...T.sm, color: C.brandTx },
  skip: { alignSelf: 'center', padding: S.sm },
  skipText: { fontFamily: F.ui, ...T.sm, color: C.muted },
});
