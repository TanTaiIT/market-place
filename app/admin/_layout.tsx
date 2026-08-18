import React from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorScreen } from '@/components/ErrorScreen';
import { qk } from '@/queries/keys';
import { C } from '@/theme';

/**
 * Boundary RIÊNG cho cụm quản trị, không dựa vào cái ở root.
 *
 * Bàn quản trị là chỗ dữ liệu lạ nhất (ma trận phủ sóng, hàng đợi hai trục, role_grants) và
 * cũng là chỗ ít người dùng nhất — tức là ít được thử nhất. Có boundary ở đây thì một màn admin
 * vỡ chỉ vỡ trong khu admin; thiếu nó thì lỗi trồi lên tận root và kéo cả app xuống theo.
 *
 * `useQueryClient()` chạy được ở đây (khác root): boundary này nằm bên TRONG
 * `<QueryClientProvider>` của `app/_layout.tsx`.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const qc = useQueryClient();
  return (
    <ErrorScreen
      error={error}
      onDark
      onRetry={() => {
        // Chỉ dọn cụm admin, không `clear()` cả cache: người dùng có thể quay ra bảng tin dùng
        // tiếp, không có lý do bắt họ tải lại từ đầu vì một màn quản trị hỏng.
        // Qua `qk` chứ không viết `['admin']` tại chỗ (HARD#3) — prefix đổi thì đổi một nơi.
        qc.removeQueries({ queryKey: qk.adminRoot() });
        retry();
      }}
    />
  );
}

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
