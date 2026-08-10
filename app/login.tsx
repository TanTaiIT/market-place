import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, GhostButton, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useLogin } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('090 123 4567');
  const [password, setPassword] = useState('123456');
  const login = useLogin();

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

  const submit = () => {
    login.mutate(
      { phone, password },
      {
        onSuccess: () => router.replace('/(tabs)/feed'),
        onError: (e: Error) => toast(e.message),
      },
    );
  };

  return (
    <LinearGradient colors={[C.cork, C.corkDark]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.pinDrop, pinStyle]} />

          <Animated.View entering={FadeInDown.delay(320).duration(450).springify()} style={styles.card}>
            <Text style={styles.brand}>
              Ghim<Text style={{ color: C.pin }}>.</Text>
            </Text>
            <Text style={styles.tagline}>Ghim tin lên bảng, bán liền trong ngày</Text>

            <Field
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="09xx xxx xxx"
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
    borderTopColor: '#ff9b8a',
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
  link: { color: C.pin, fontFamily: F.uiBold },
});
