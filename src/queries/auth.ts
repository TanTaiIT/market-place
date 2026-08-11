import { useQueryClient } from '@tanstack/react-query';
import { setHttpSession } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

/**
 * Đăng xuất = xoá phiên **và** dọn sạch cache. Thiếu vế thứ hai thì người đăng nhập
 * kế tiếp sẽ thấy tin đã lưu / hội thoại của phiên trước cho tới lần refetch đầu tiên.
 * Không tự điều hướng: `Stack.Protected` trong `app/_layout.tsx` lo phần đó.
 */
export function useSignOut() {
  const qc = useQueryClient();

  return () => {
    useAuthStore.getState().signOut();
    qc.clear();
  };
}

/**
 * Cầu nối store → tầng HTTP: `src/api/**` không được import `stores/**` (folder.convention §6),
 * nên token phải được đẩy vào từ đây. Gọi **một lần** ở `app/_layout.tsx`.
 *
 * Chạy qua store nên phủ cả ba đường session đổi: đăng nhập, đăng xuất, và rehydrate
 * AsyncStorage lúc mở lại app — không cần seed riêng cho từng trường hợp.
 */
export function useSyncAccessToken(): void {
  const session = useAuthStore((s) => s.session);

  // Ghi ngay trong render, KHÔNG qua useEffect: effect của màn con chạy trước effect của
  // layout cha, nên query đầu tiên sau khi mở lại app sẽ bay đi lúc token còn null và nhận
  // 401. Layout cha render trước con, nên ghi ở đây là kịp. An toàn vì lệnh này idempotent.
  setHttpSession(session ? { accessToken: session.accessToken, userId: session.userId } : null);
}
