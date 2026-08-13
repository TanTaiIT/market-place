import React from 'react';
import { Stack } from 'expo-router';
import { C } from '@/theme';

/**
 * Cụm bàn quản trị nền tối. Root layout chỉ khai đúng `<Stack.Screen name="admin">` trong khối
 * `guard={isAuthenticated}`, nên mọi màn thêm vào thư mục này được bảo vệ sẵn (HARD#17).
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.desk },
        animation: 'slide_from_right',
      }}
    />
  );
}
