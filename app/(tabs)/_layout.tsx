import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { useAuthStore, usePendingEmailVerify } from '@/stores/auth';

export default function TabsLayout() {
  const router = useRouter();
  const pendingVerify = usePendingEmailVerify();

  /*
   * Mời xác thực email NGAY SAU khi đăng ký — nhưng từ đây, không từ `register.tsx`.
   *
   * HARD#18 cấm tự điều hướng khi đổi trạng thái auth: `register` bật phiên xong là
   * `Stack.Protected` đổi stack, và một `router.push` bắn cùng lúc sẽ chạy trên stack cũ rồi
   * bị vứt. Đọc cờ ở đây thì lượt điều hướng xảy ra SAU khi stack mới đã mount — đến từ
   * trạng thái app chứ không từ sự kiện đăng nhập, nên không đua với navigator.
   *
   * Xoá cờ trước khi đẩy để lượt mount kế tiếp không đẩy lần hai (React 19 chạy effect hai
   * lượt ở chế độ dev).
   */
  useEffect(() => {
    if (!pendingVerify) return;
    useAuthStore.getState().clearPendingEmailVerify();
    router.push('/verify-email');
  }, [pendingVerify, router]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="chatlist" />
      <Tabs.Screen name="notif" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
