import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, GhostButton, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useLogin } from '@/queries/auth';
import { useSignIn } from '@/stores/auth';
import { C, F, G, shadow } from '@/theme';

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const signIn = useSignIn();

  // Ghim rơi từ trên xuống rồi nảy nhẹ — @keyframes pinFall
  const drop = useSharedValue(-140);
  const scale = useSharedValue(0.6);
  React.useEffect(() => {
    drop.value = withSpring(0, { damping: 9, stiffness: 140 });
    scale.value = withDelay(60, withSpring(1, { damping: 8 }));
  }, [drop, scale]);
  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value }, { scale: scale.value }],
  }));

  /**
   * Đường thoát khỏi màn đăng nhập — khách vẫn xem tin được, nên màn này KHÔNG phải bức tường.
   *
   * `back()` trước, `replace` sau: gần như mọi lối vào đây đều là `router.push` từ một màn
   * khách đang xem (`GuestGate`, `useRequireAuth`), nên quay lại đúng chỗ họ đang dở còn hơn
   * ném họ về đầu bảng tin và mất vị trí cuộn. Chỉ khi không có gì để lùi — mở thẳng bằng deep
   * link — mới về bảng tin. Cùng công thức `ScreenHeader` đang dùng cho nút quay lại.
   */
  const keepBrowsing = () =>
    router.canGoBack() ? router.back() : router.replace('/(tabs)/feed');

  const submit = () => {
    login.mutate(
      { email: email.trim(), password },
      {
        // Chỉ bật phiên, không tự điều hướng — `Stack.Protected` đổi tập route khả dụng,
        // gọi router.replace ngay đây sẽ chạy trước khi route đích được đăng ký.
        onSuccess: (session) => signIn(session),
        onError: (e: Error) => toast(e.message),
      },
    );
  };

  return (
    <LinearGradient colors={G.auth} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.pinDrop, pinStyle]} />

          {/* `entering` và `transform` (góc nghiêng trong styles.card) phải ở hai lớp khác nhau,
              không thì layout animation ghi đè transform — Reanimated 4 cảnh báo lúc chạy. */}
          <Animated.View entering={FadeInDown.delay(320).duration(450).springify()}>
          <View style={styles.card}>
            <Text style={styles.brand}>
              Ghim<Text style={{ color: C.pin }}>.</Text>
            </Text>
            <Text style={styles.tagline}>Ghim tin lên bảng, bán liền trong ngày</Text>

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="ban@truong.edu.vn"
            />
            <Field
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            <PinButton
              label="Đăng nhập"
              onPress={submit}
              loading={login.isPending}
              style={{ marginTop: 8 }}
            />

            {/* Ngay dưới nút đăng nhập, không lẫn vào chân màn: người bấm vào đây vừa gõ sai
                mật khẩu xong, nên lối thoát phải nằm đúng chỗ mắt họ đang nhìn. */}
            <Text style={styles.forgot} onPress={() => router.push('/forgot-password')}>
              Quên mật khẩu?
            </Text>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.line} />
            </View>

            <GhostButton label="Tiếp tục với Google" onPress={() => toast('Tính năng đang phát triển')} />

            <Text style={styles.switch}>
              Chưa có tài khoản?{' '}
              <Text style={styles.link} onPress={() => router.push('/register')}>
                Đăng ký ngay
              </Text>
            </Text>
          </View>
          </Animated.View>

          {/*
            NGOÀI thẻ giấy, không phải một dòng nữa trong form: đây là hành động RỜI màn này,
            còn mọi thứ trong thẻ đều là các cách để ở lại và đăng nhập. Đặt lẫn vào trong thẻ
            là mời người ta bấm nhầm giữa "đăng nhập bằng cách khác" và "thôi không đăng nhập".

            Hiện sau thẻ một nhịp, cùng ngôn ngữ chuyển động với thẻ — xuất hiện cùng lúc thì
            nó tranh mất sự chú ý của chính cái form là trọng tâm màn.
          */}
          <Animated.View entering={FadeInDown.delay(520).duration(400)}>
            <Pressable
              onPress={keepBrowsing}
              hitSlop={10}
              style={({ pressed }) => [styles.escape, pressed && { opacity: 0.55 }]}
            >
              {/*
                "Quay lại" chứ không phải "Tiếp tục": ngay trên nó đã có "Tiếp tục với Google",
                mà hai nhãn cùng mở đầu bằng một từ nhưng dẫn đi hai hướng ngược nhau (ở lại
                đăng nhập / rời khỏi màn) là chỗ để bấm nhầm khi lướt nhanh.
              */}
              <Text style={styles.escapeText}>← Quay lại xem tin</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26 },
  pinDrop: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.pin,
    borderTopWidth: 6,
    borderTopColor: C.pinLight,
    alignSelf: 'center',
    marginBottom: -17,
    zIndex: 5,
    ...shadow,
  },
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    paddingTop: 34,
    paddingHorizontal: 24,
    paddingBottom: 28,
    transform: [{ rotate: '-1.2deg' }],
    ...shadow,
  },
  brand: { fontFamily: F.hand, fontSize: 38, color: C.ink, textAlign: 'center' },
  tagline: {
    fontFamily: F.ui,
    fontSize: 13.5,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 26,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 14 },
  line: { flex: 1, height: 1, backgroundColor: '#E3DCC6' },
  dividerText: { fontFamily: F.ui, fontSize: 12, color: '#B7AE95' },
  switch: { textAlign: 'center', marginTop: 18, fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft },
  forgot: { alignSelf: 'center', marginTop: 14, fontFamily: F.uiSemi, fontSize: 13, color: C.brandTx },
  link: { color: C.pin, fontFamily: F.uiBold },
  /** Vùng chạm rộng hơn hẳn phần chữ: đây là lối thoát, hụt tay ở đây là kẹt lại trong màn. */
  escape: { alignSelf: 'center', marginTop: 20, paddingVertical: 12, paddingHorizontal: 18 },
  // Nền `G.auth` sáng (#F4FCF7 → #E4E6EA) nên chữ mực đọc rõ; cố tình KHÔNG dùng màu nhấn —
  // nút chính của màn là "Đăng nhập", lối thoát phải lùi lại sau nó.
  escapeText: { fontFamily: F.uiSemi, fontSize: 13.5, color: C.inkSoft },
});
