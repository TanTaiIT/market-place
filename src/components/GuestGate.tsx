import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsAuthenticated } from '@/stores/auth';
import { PinButton, TabHeader } from './ui';
import { useToast } from './Toast';
import { C, F, R } from '@/theme';

/**
 * Khách chưa đăng nhập vẫn xem được bảng tin và chi tiết tin; chỉ những gì GẮN VỚI MỘT TÀI KHOẢN
 * mới cần đăng nhập. File này giữ cả hai nửa của luật đó — màn chặn và hàm chặn hành động — để
 * lời hứa "chỗ nào cần đăng nhập" nằm ở một chỗ, không rải ra từng call-site.
 */

/** Toàn màn: dùng cho tab chỉ có nghĩa với một tài khoản (tin nhắn, thông báo, cá nhân). */
export function GuestGate({ title, message }: { title: string; message: string }) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TabHeader title={title} />
      <View style={styles.body}>
        <Text style={styles.glyph}>🔒</Text>
        <Text style={styles.text}>{message}</Text>
        <View style={styles.act}>
          <PinButton label="Đăng nhập" onPress={() => router.push('/login')} />
        </View>
        <Text style={styles.note} onPress={() => router.push('/register')}>
          Chưa có tài khoản? Đăng ký
        </Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Bọc một hành động cần tài khoản.
 *
 * Trả về hàm chứ không trả về boolean: call-site chỉ cần bọc `onPress` cũ, không phải tự viết
 * nhánh `if (!isAuthenticated)` — mà nhánh đó nếu viết tay 6 chỗ thì sẽ có 6 kiểu thông báo.
 */
export function useRequireAuth() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const toast = useToast();

  return useCallback(
    (action: () => void, why = 'Đăng nhập để dùng tính năng này') => {
      if (isAuthenticated) {
        action();
        return;
      }
      toast(`🔒 ${why}`);
      router.push('/login');
    },
    [isAuthenticated, router, toast],
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 4 },
  glyph: { fontSize: 34, marginBottom: 8 },
  text: {
    fontFamily: F.ui,
    fontSize: 13.5,
    lineHeight: 21,
    color: C.inkSoft,
    textAlign: 'center',
  },
  act: { alignSelf: 'stretch', marginTop: 20, borderRadius: R.md },
  note: { fontFamily: F.uiSemi, fontSize: 13, color: C.brandTx, marginTop: 16 },
});
