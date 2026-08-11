import { useQueryClient } from '@tanstack/react-query';
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
