import React, { useEffect } from 'react';
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
import { ToastProvider } from '@/components/Toast';
import { useSyncAccessToken } from '@/queries/auth';
import { useAuthHydrated, useIsAuthenticated } from '@/stores/auth';
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
  // Đẩy token của phiên xuống tầng HTTP trước khi bất kỳ màn con nào mount và gọi query.
  // Truyền thẳng `queryClient` vì ở đây còn ở NGOÀI `<QueryClientProvider>` bên dưới.
  useSyncAccessToken(queryClient);
  // Font lỗi vẫn cho chạy tiếp, chỉ rơi về font hệ thống. Nhưng phiên đăng nhập thì phải
  // đọc xong mới render: guard chạy sớm sẽ nháy qua màn login rồi mới nhảy vào feed.
  const ready = (loaded || error) && authHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={styles.boot} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ToastProvider>
            <StatusBar style="dark" />
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
                <Stack.Screen name="listing/[id]" />
                <Stack.Screen name="chat/[id]" />
              </Stack.Protected>
            </Stack>
          </ToastProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: C.cork },
});
