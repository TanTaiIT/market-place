import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Danh tính của phiên đăng nhập — thứ duy nhất cần sống lâu hơn một màn hình.
 * Hồ sơ đầy đủ (tên, số tin, đánh giá) vẫn thuộc về `useProfile()`; đừng nhân bản vào đây,
 * nếu không sẽ có hai nguồn sự thật lệch nhau sau mỗi lần `useUpdateProfile`.
 *
 * Khai lại type thay vì import `AuthSession` từ `@/api/db`: store là lá, không được import
 * layer khác (folder.convention §6). Hai bên khớp nhau theo cấu trúc.
 *
 * TODO(bảo mật): token đang nằm trong AsyncStorage — đọc được trên máy đã root/jailbreak.
 * Chuyển sang `expo-secure-store` khi thêm được native module (cần rebuild dev client).
 */
type Session = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

type AuthState = {
  session: Session | null;
  /**
   * Tổ chức đang thao tác — KHÔNG còn nằm trong phiên đăng nhập.
   *
   * BE v2 bỏ `organizationId` khỏi token: một tài khoản thuộc nhiều org, và org của mỗi request
   * do chính request chỉ ra (header `X-Org-Slug`) rồi được đối chiếu `memberships` ngay lúc đó.
   * Vì vậy nó là lựa chọn của người dùng, đổi được giữa phiên, và phải sống lâu hơn màn hình —
   * đúng chỗ của Zustand chứ không phải TanStack (store.convention §1).
   *
   * `null` = chưa chọn org: vẫn xem được tin công khai, chỉ không thao tác trong org nào.
   */
  activeOrgSlug: string | null;
  /** false cho tới khi đọc xong AsyncStorage — giữ splash để guard không nháy qua màn login */
  hydrated: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  setActiveOrg: (slug: string | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      activeOrgSlug: null,
      hydrated: false,
      signIn: (session) => set({ session }),
      // Đăng xuất dọn luôn org đang chọn: người kế tiếp đăng nhập trên cùng máy không được
      // thừa hưởng tổ chức của người trước.
      signOut: () => set({ session: null, activeOrgSlug: null }),
      setActiveOrg: (activeOrgSlug) => set({ activeOrgSlug }),
    }),
    {
      name: 'ghim-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` là cờ runtime; ghi xuống đĩa thì lần mở sau sẽ đọc lại đúng giá trị cũ (false)
      partialize: (s) => ({ session: s.session, activeOrgSlug: s.activeOrgSlug }),
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
/** Tổ chức đang thao tác. `null` = chưa chọn org, chỉ xem được nội dung công khai. */
export const useOrgSlug = () => useAuthStore((s) => s.activeOrgSlug ?? undefined);
export const useSetActiveOrg = () => useAuthStore((s) => s.setActiveOrg);
