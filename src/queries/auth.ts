import { useEffect } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  setActiveOrgSlug,
  setHttpSession,
  setOrgGoneHandler,
  setSessionRefresher,
} from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { qk } from './keys';

/* ------------------------------- mutations ------------------------------- */

export function useLogin() {
  return useMutation({
    mutationFn: (v: { email: string; password: string }) => api.login(v.email, v.password),
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
    .refreshSession(current.refreshToken)
    .then((renewed) => {
      useAuthStore.getState().signIn(renewed);
      setHttpSession({ accessToken: renewed.accessToken, userId: renewed.userId });
      return renewed.accessToken;
    })
    .catch(() => {
      // Refresh token cũng hết hạn / bị thu hồi -> hết đường tự cứu. Dọn phiên như
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
  // Org đang chọn cũng phải xuống tầng HTTP: v2 gửi nó theo header ở MỌI request, và nó đổi
  // được giữa phiên (người dùng chuyển tổ chức) mà không hề đụng tới token.
  const activeOrgSlug = useAuthStore((s) => s.activeOrgSlug);

  // Ghi ngay trong render, KHÔNG qua useEffect: effect của màn con chạy trước effect của
  // layout cha, nên query đầu tiên sau khi mở lại app sẽ bay đi lúc token còn null và nhận
  // 401. Layout cha render trước con, nên ghi ở đây là kịp. An toàn vì lệnh này idempotent.
  setHttpSession(session ? { accessToken: session.accessToken, userId: session.userId } : null);
  setActiveOrgSlug(activeOrgSlug);
  setSessionRefresher(() => refreshSession(qc));
  // Org bị khoá giữa lúc dùng: bỏ chọn nó, đừng đăng xuất. Phiên vẫn tốt nguyên — người dùng
  // chỉ mất tổ chức đang thao tác, và vẫn xem được nội dung công khai như lúc chưa chọn org.
  setOrgGoneHandler(() => useAuthStore.getState().setActiveOrg(null));
}

/**
 * Hỏi BE xem người đang đăng nhập còn tồn tại không, mỗi khi app mở lại hoặc phiên đổi chủ.
 *
 * Cần một lượt gọi RIÊNG vì không màn nào phát hiện hộ được: `authenticate` bên BE dựng
 * `req.user` thẳng từ JWT mà không tra DB, nên user bị xoá khỏi database vẫn có `GET /listings`
 * trả **200** — bảng tin đầy tin như thường, người dùng thao tác bình thường, và chỉ vỡ ra khi
 * chạm đúng một endpoint nào đó cần bản ghi user. `GET /users/me` là chỗ duy nhất trả lời thật
 * (404), và `withAuthRetry` biến 404 đó thành một lượt refresh; refresh trả 401
 * `User no longer valid` nên `refreshSession` dọn phiên và guard đưa về màn đăng nhập.
 *
 * `fetchQuery` chứ không phải `useQuery`: hook này chạy trong thân `RootLayout`, ở NGOÀI
 * `<QueryClientProvider>` — cùng lý do `qc` phải truyền vào như `useSyncAccessToken`. Kết quả
 * ghi thẳng vào `qk.profile()` nên màn Hồ sơ dùng lại luôn, không tốn thêm một vòng gọi.
 *
 * `.catch` rỗng là cố ý: mọi lỗi ở đây đã được `withAuthRetry` phân loại xong (phiên chết thì
 * đã đăng xuất, mạng hỏng thì cứ để phiên yên). Bắt lại chỉ để chặn unhandled rejection —
 * KHÔNG toast, vì lỗi của query không phải bề mặt lỗi của người dùng (query.convention §5).
 */
export function useValidateSession(qc: QueryClient): void {
  const hydrated = useAuthStore((s) => s.hydrated);
  // Theo `userId` chứ không theo cả object `session`: refresh token xoay vòng ghi lại session
  // mới sau mỗi lần làm mới, bám vào object là chạy lại kiểm tra sau từng lượt refresh.
  const userId = useAuthStore((s) => s.session?.userId);

  useEffect(() => {
    if (!hydrated || !userId) return;
    qc.fetchQuery({ queryKey: qk.profile(), queryFn: api.getProfile }).catch(() => {});
  }, [hydrated, userId, qc]);
}
