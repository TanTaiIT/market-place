import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Danh tính của phiên đăng nhập — thứ duy nhất cần sống lâu hơn một màn hình.
 * Hồ sơ đầy đủ (tên, số tin, đánh giá) vẫn thuộc về `useProfile()`; đừng nhân bản vào đây,
 * nếu không sẽ có hai nguồn sự thật lệch nhau sau mỗi lần `useUpdateProfile`.
 * Khi có backend thật: thêm `token` vào đây và đổi storage sang `expo-secure-store`.
 */
type Session = { phone: string };

type AuthState = {
  session: Session | null;
  /** false cho tới khi đọc xong AsyncStorage — giữ splash để guard không nháy qua màn login */
  hydrated: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    {
      name: 'ghim-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` là cờ runtime; ghi xuống đĩa thì lần mở sau sẽ đọc lại đúng giá trị cũ (false)
      partialize: (s) => ({ session: s.session }),
      // Callback này chạy cả khi đọc đĩa lỗi — luôn mở khoá splash, đừng để app treo ở màn boot
      onRehydrateStorage: () => () => useAuthStore.setState({ hydrated: true }),
    },
  ),
);

/* --------------------- selector: đọc từng mảnh, không lấy cả store --------------------- */

export const useIsAuthenticated = () => useAuthStore((s) => s.session !== null);
export const useAuthHydrated = () => useAuthStore((s) => s.hydrated);
export const useSignIn = () => useAuthStore((s) => s.signIn);
