import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/**
 * Kho phiên: Keychain (iOS) / Keystore (Android) qua `expo-secure-store`.
 *
 * `AsyncStorage` KHÔNG mã hoá — trên máy đã root/jailbreak nó là một file đọc được, và thứ
 * nằm trong đó là refresh token dùng được suốt `JWT_REFRESH_EXPIRES_IN`. Đây là lý do trường
 * này từng mang một `TODO(bảo mật)`.
 *
 * DI CƯ MỘT LẦN, không đá ai ra: lần đọc đầu sau khi cập nhật app, kho bảo mật còn rỗng nên
 * hàm dưới đọc nốt bản cũ trong AsyncStorage, chép sang, rồi xoá bản cũ đi. Thiếu bước này thì
 * mọi người dùng hiện tại bị đăng xuất ngay lúc cập nhật — một sự cố tự gây, đúng vào bản vá
 * bảo mật.
 *
 * Giới hạn cần biết: SecureStore cảnh báo với giá trị trên ~2KB. Phần lưu ở đây là hai JWT +
 * vài chuỗi ngắn (`partialize` cắt hết phần còn lại), tổng dưới 1KB — nhưng nhét thêm dữ
 * liệu vào `partialize` thì phải kiểm lại con số đó.
 */
const secureStorage: StateStorage = {
  getItem: async (name) => {
    const stored = await SecureStore.getItemAsync(name);
    if (stored !== null) return stored;

    const legacy = await AsyncStorage.getItem(name);
    if (legacy === null) return null;
    await SecureStore.setItemAsync(name, legacy);
    // Xoá bản thường NGAY: để lại là giữ nguyên đúng lỗ vừa vá, chỉ khác là có thêm một bản sao.
    await AsyncStorage.removeItem(name);
    return legacy;
  },
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

/**
 * Danh tính của phiên đăng nhập — thứ duy nhất cần sống lâu hơn một màn hình.
 * Hồ sơ đầy đủ (tên, số tin, đánh giá) vẫn thuộc về `useProfile()`; đừng nhân bản vào đây,
 * nếu không sẽ có hai nguồn sự thật lệch nhau sau mỗi lần `useUpdateProfile`.
 *
 * Khai lại type thay vì import `AuthSession` từ `@/api/db`: store là lá, không được import
 * layer khác (folder.convention §6). Hai bên khớp nhau theo cấu trúc.
 *
 * Token nằm trong Keychain/Keystore, KHÔNG phải AsyncStorage — xem `secureStorage` bên dưới.
 */
type Session = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

type AuthState = {
  session: Session | null;
  /** false cho tới khi đọc xong kho bảo mật — giữ splash để guard không nháy qua màn login */
  hydrated: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  /**
   * Vừa đăng ký xong và chưa được mời xác thực email — cờ MỘT LẦN, đọc rồi xoá.
   *
   * Nó tồn tại vì HARD#18: đổi trạng thái auth thì không được tự `router.replace`, phải để
   * `Stack.Protected` đổi stack. Nên `register` không đẩy thẳng sang màn nhập mã được — nó
   * bật cờ này, và `(tabs)/_layout` đọc cờ SAU khi stack đã đổi xong. Điều hướng vì thế đến
   * từ trạng thái app, không phải từ sự kiện đăng nhập, nên không đua với navigator.
   *
   * KHÔNG ghi xuống đĩa (xem `partialize`): tắt app rồi mở lại thì lời mời đó đã cũ, và lối
   * vào vẫn còn nguyên ở dải cảnh báo trong màn Cá nhân.
   */
  pendingEmailVerify: boolean;
  markPendingEmailVerify: () => void;
  clearPendingEmailVerify: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      pendingEmailVerify: false,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null, pendingEmailVerify: false }),
      markPendingEmailVerify: () => set({ pendingEmailVerify: true }),
      clearPendingEmailVerify: () => set({ pendingEmailVerify: false }),
    }),
    {
      name: 'ghim-auth',
      storage: createJSONStorage(() => secureStorage),
      // `hydrated` là cờ runtime; ghi xuống đĩa thì lần mở sau sẽ đọc lại đúng giá trị cũ (false)
      partialize: (s) => ({ session: s.session }),
      // Callback này chạy cả khi đọc đĩa lỗi — luôn mở khoá splash, đừng để app treo ở màn boot.
      //
      // Bản ghi thiếu field thì vứt luôn thay vì mang vào phiên chạy: `useIsAuthenticated` chỉ
      // hỏi `session !== null`, nên một object rỗng cũng đủ để guard thả vào bảng tin, rồi mọi
      // request bay đi không kèm token và hỏng theo kiểu chẳng ai đọc ra nguyên nhân. Gặp ở
      // máy còn giữ dữ liệu của bản app cũ, hoặc khi ghi xuống đĩa bị cắt ngang giữa chừng.
      onRehydrateStorage: () => (state) => {
        const s = state?.session;
        const usable = Boolean(s?.userId && s.accessToken && s.refreshToken);
        useAuthStore.setState({ hydrated: true, ...(s && !usable && { session: null }) });
      },
    },
  ),
);

/* --------------------- selector: đọc từng mảnh, không lấy cả store --------------------- */

export const useIsAuthenticated = () => useAuthStore((s) => s.session !== null);
export const useAuthHydrated = () => useAuthStore((s) => s.hydrated);
export const useSignIn = () => useAuthStore((s) => s.signIn);
export const usePendingEmailVerify = () => useAuthStore((s) => s.pendingEmailVerify);
export const useMarkPendingEmailVerify = () => useAuthStore((s) => s.markPendingEmailVerify);
