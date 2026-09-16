import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useRegister } from '@/queries/auth';
import { useMarkPendingEmailVerify, useSignIn } from '@/stores/auth';
import { C, F, G, shadow } from '@/theme';

export default function Register() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const register = useRegister();
  const signIn = useSignIn();
  const markPendingVerify = useMarkPendingEmailVerify();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    register.mutate(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      },
      {
        // Xem ghi chú ở login.tsx: bật phiên xong để Stack.Protected tự đổi route
        onSuccess: (session) => {
          // Bật cờ TRƯỚC khi đổi phiên: `(tabs)/_layout` đọc nó ngay lượt mount đầu tiên,
          // và lượt đó do chính `signIn` kích hoạt. Bật sau là màn tabs đã dựng xong.
          markPendingVerify();
          signIn(session);
        },
        onError: (e: Error) => toast(e.message),
      },
    );

  return (
    <LinearGradient colors={G.auth} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 30, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* `entering` và `transform` (góc nghiêng trong styles.card) phải ở hai lớp khác nhau,
              không thì layout animation ghi đè transform — Reanimated 4 cảnh báo lúc chạy. */}
          <Animated.View entering={FadeInDown.duration(420).springify()}>
          <View style={styles.card}>
            <Text style={styles.brand}>Tạo tài khoản</Text>
            <Text style={styles.tagline}>Tham gia bảng tin trường bạn</Text>

            <Field label="Họ và tên" value={form.name} onChangeText={set('name')} placeholder="Nguyễn Văn A" />
            <Field
              label="Email"
              value={form.email}
              onChangeText={set('email')}
              keyboardType="email-address"
              placeholder="ban@truong.edu.vn"
            />
            <Field
              label="Số điện thoại"
              value={form.phone}
              onChangeText={set('phone')}
              keyboardType="phone-pad"
              placeholder="09xx xxx xxx"
            />
            <Field
              label="Mật khẩu"
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry
              placeholder="Tối thiểu 6 ký tự"
            />

            <PinButton label="Đăng ký" onPress={submit} loading={register.isPending} style={{ marginTop: 8 }} />

            <Text style={styles.switch}>
              Đã có tài khoản?{' '}
              <Text style={styles.link} onPress={() => router.replace('/login')}>
                Đăng nhập
              </Text>
            </Text>
          </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26 },
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    paddingTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 28,
    transform: [{ rotate: '1deg' }],
    ...shadow,
  },
  brand: { fontFamily: F.hand, fontSize: 30, color: C.ink, textAlign: 'center' },
  tagline: {
    fontFamily: F.ui,
    fontSize: 13.5,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  switch: { textAlign: 'center', marginTop: 18, fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft },
  link: { color: C.pin, fontFamily: F.uiBold },
});
