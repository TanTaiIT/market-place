import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { setHttpSession, setSessionRefresher } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { qk } from './keys';

/* ------------------------------- mutations ------------------------------- */

export function useLogin() {
  return useMutation({
    // `orgSlug` bắt buộc đi cùng: BE chỉ unique email theo `(organizationId, email)`.
    mutationFn: (v: { email: string; password: string; orgSlug?: string }) =>
      api.login(v.email, v.password, v.orgSlug),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.register,
    // Đăng ký trả về session (token + userId), không phải hồ sơ — nên invalidate để
    // `useProfile()` gọi lại `GET /users/me` bằng token mới thay vì ghi cache bằng session.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile() }),
  });
}

/* --------------------------- session lifecycle --------------------------- */

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
 * Đổi refresh token lấy phiên mới rồi ghi lại cả store lẫn tầng HTTP.
 *
 * Đọc phiên bằng `getState()` chứ không bắt qua closure của render: hàm này chạy đúng lúc access
 * token hết hạn, có thể là nhiều phút sau lần render đã đăng ký nó, lúc đó phiên trong closure
 * đã cũ. Phải ghi **trọn** phiên vì BE rotate cả refresh token.
 */
function refreshSession(qc: QueryClient): Promise<string | null> {
  const current = useAuthStore.getState().session;
  if (!current) return Promise.resolve(null);

  return api
    .refreshSession(current.refreshToken, current.orgSlug)
    .then((renewed) => {
      useAuthStore.getState().signIn(renewed);
      setHttpSession({ accessToken: renewed.accessToken, userId: renewed.userId });
      return renewed.accessToken;
    })
    .catch(() => {
      // Refresh token cũng hết hạn / bị thu hồi / org bị khoá -> hết đường tự cứu. Dọn phiên như
      // `useSignOut` (kể cả cache) để `Stack.Protected` đưa về màn login thay vì treo ở màn lỗi.
      useAuthStore.getState().signOut();
      setHttpSession(null);
      qc.clear();
      return null;
    });
}

/**
 * Cầu nối store → tầng HTTP: `src/api/**` không được import `stores/**` (folder.convention §6),
 * nên token và hàm refresh phải được đẩy vào từ đây. Gọi **một lần** ở `app/_layout.tsx`.
 *
 * Chạy qua store nên phủ cả ba đường session đổi: đăng nhập, đăng xuất, và rehydrate
 * AsyncStorage lúc mở lại app — không cần seed riêng cho từng trường hợp.
 *
 * `qc` phải truyền vào, KHÔNG được lấy bằng `useQueryClient()`: hook này chạy trong thân
 * `RootLayout`, còn `<QueryClientProvider>` lại nằm trong JSX mà `RootLayout` trả về — tức là
 * context chưa tồn tại ở thời điểm gọi, và `useQueryClient()` sẽ ném "No QueryClient set".
 */
export function useSyncAccessToken(qc: QueryClient): void {
  const session = useAuthStore((s) => s.session);

  // Ghi ngay trong render, KHÔNG qua useEffect: effect của màn con chạy trước effect của
  // layout cha, nên query đầu tiên sau khi mở lại app sẽ bay đi lúc token còn null và nhận
  // 401. Layout cha render trước con, nên ghi ở đây là kịp. An toàn vì lệnh này idempotent.
  setHttpSession(session ? { accessToken: session.accessToken, userId: session.userId } : null);
  setSessionRefresher(() => refreshSession(qc));
}
