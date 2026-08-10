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
  Manrope_400Regular,
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
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // Font lỗi vẫn cho chạy tiếp, chỉ rơi về font hệ thống
  if (!loaded && !error) return <View style={styles.boot} />;

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
              <Stack.Screen name="login" options={{ animation: 'fade' }} />
              <Stack.Screen name="register" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="post" options={{ animation: 'slide_from_bottom' }} />
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
