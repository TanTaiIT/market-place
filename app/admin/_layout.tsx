import React from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminOrgScope } from '@/components/AdminOrgScope';
import { ErrorScreen } from '@/components/ErrorScreen';
import { qk } from '@/queries/keys';
import { useSoleOrgId } from '@/queries/org';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
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
  /*
   * Mặc định "một nhóm thì khỏi bấm chọn" — nhưng KHÔNG cho master.
   *
   * Master cố ý không thuộc nhóm nào; một membership lạc (lỡ bấm "Tham gia" lúc thử) không
   * được biến thành phạm vi quản trị mặc định của họ. Bản trước để `useMyOrgs` tự ghi luật này
   * vào store bằng một effect, và chính effect đó chạy ở mọi màn có gọi hook — kể cả những màn
   * chẳng liên quan gì tới quản trị.
   */
  const sole = useSoleOrgId();
  const master = isMaster(useMyGrants().data);

  return (
    // Phạm vi nhóm bọc NGOÀI `Stack`: nó phải sống qua mọi lần chuyển màn trong cụm quản trị,
    // và chết cùng cụm khi người dùng rời đi. Đặt trong một màn là mất lựa chọn mỗi lần điều hướng.
    <AdminOrgScope fallback={master ? null : sole}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.desk },
          animation: 'slide_from_right',
        }}
      />
    </AdminOrgScope>
  );
}
