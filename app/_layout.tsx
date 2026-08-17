import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Kalam_400Regular, Kalam_700Bold } from '@expo-google-fonts/kalam';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import { BootSplash } from '@/components/BootSplash';
import { ToastProvider } from '@/components/Toast';
import { useSyncAccessToken, useValidateSession } from '@/queries/auth';
import { useChatSocket } from '@/queries/chat';
import { useAuthHydrated, useIsAuthenticated, useOrgSlug } from '@/stores/auth';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Kalam_400Regular,
    Kalam_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
  });

  const isAuthenticated = useIsAuthenticated();
  const authHydrated = useAuthHydrated();
  const orgSlug = useOrgSlug();
  // Đẩy token của phiên xuống tầng HTTP trước khi bất kỳ màn con nào mount và gọi query.
  // Truyền thẳng `queryClient` vì ở đây còn ở NGOÀI `<QueryClientProvider>` bên dưới.
  useSyncAccessToken(queryClient);
  // Đá phiên trỏ tới user đã bị xoá khỏi DB về màn đăng nhập. Phải hỏi tường minh: BE vẫn phục
  // vụ bảng tin bình thường cho token của một user không còn tồn tại.
  useValidateSession(queryClient);
  // Mở kết nối realtime theo phiên. Effect nên nó chạy sau khi token đã được đẩy xuống ở trên.
  useChatSocket();

  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // Font lỗi vẫn cho chạy tiếp, chỉ rơi về font hệ thống. Nhưng phải đợi tới mốc này mới
  // nhường chỗ cho `BootSplash`: chữ ký "Ghim" của nó vẽ bằng Kalam.
  const fontsReady = loaded || error !== null;
  // Phiên đăng nhập phải đọc xong mới dựng Stack — guard chạy sớm sẽ nháy qua màn login rồi
  // mới nhảy vào feed. Đọc đĩa chạy song song với animation splash, không cộng dồn thời gian.
  const ready = fontsReady && authHydrated;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  if (!fontsReady) return <View style={styles.boot} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ToastProvider>
            {/* Splash là mặt bàn tối, app là giấy sáng — thanh trạng thái phải đổi theo. */}
            <StatusBar style={splashDone ? 'dark' : 'light'} />

            {ready && (
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: C.paper },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Protected guard={!isAuthenticated}>
                  <Stack.Screen name="login" options={{ animation: 'fade' }} />
                  <Stack.Screen name="register" options={{ animation: 'fade' }} />
                </Stack.Protected>

                {/* Mọi route cần đăng nhập phải khai ở đây, kể cả route không cần option
                    riêng — screen không nằm trong khối này vẫn mở được bằng deep link. */}
                <Stack.Protected guard={isAuthenticated}>
                  <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="post" options={{ animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="search" />
                  <Stack.Screen name="mylistings" />
                  <Stack.Screen name="saved" />
                  <Stack.Screen name="settings" />
                  {/* Cần đăng nhập nhưng KHÔNG cần thuộc tổ chức nào — đây chính là đường vào
                      tổ chức đầu tiên của một tài khoản mới. */}
                  <Stack.Screen name="join-org" />
                  <Stack.Screen name="listing/[id]" />
                  <Stack.Screen name="listing/edit/[id]" />
                  <Stack.Screen name="user/[id]" />
                  <Stack.Screen name="chat/[id]" />
                  {/* Khai cả cụm `admin` một lần: `app/admin/_layout.tsx` giữ Stack riêng bên trong */}
                  <Stack.Screen name="admin" />
                </Stack.Protected>
              </Stack>
            )}

            {/* Nằm SAU Stack nên phủ lên trên: lúc splash nở ra là thấy luôn app đã dựng sẵn
                phía dưới, không phải chờ mount thêm một nhịp nữa. */}
            {!splashDone && (
              <BootSplash ready={ready} boardLabel={orgSlug} onFinish={finishSplash} />
            )}
          </ToastProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Cùng nền với `splash.backgroundColor` trong app.json và với `BootSplash` — ba lớp nối
  // tiếp nhau lúc khởi động, lệch màu một lớp là thấy nháy.
  boot: { flex: 1, backgroundColor: C.desk },
});
