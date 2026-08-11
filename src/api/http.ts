import type { CreateClientConfig } from './generated/client.gen';

/**
 * Cấu hình runtime cho SDK generated (`runtimeConfigPath` trong `openapi-ts.config.ts`):
 * chốt base URL và gắn Bearer token vào mỗi request.
 */

/**
 * Thiết bị thật không hiểu `localhost` — đó là chính nó, không phải máy dev, nên phải là IP LAN
 * của máy chạy BE. Android emulator dùng `10.0.2.2`, iOS simulator thì `localhost` mới đúng.
 * Expo inline biến `EXPO_PUBLIC_*` lúc bundle, nên đổi giá trị phải chạy lại `expo start -c`.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

type HttpSession = {
  accessToken: string;
  /** `_id` của user — `client.ts` cần để tính `Listing.mine` và filter `seller`. */
  userId: string;
};

/**
 * Phiên hiện tại ở module scope vì `src/api/**` không được biết tới `stores/**`
 * (folder.convention §6). `useSyncAccessToken()` trong `queries/auth.ts` đẩy vào đây mỗi khi
 * session đổi — đăng nhập, đăng xuất, và cả lúc rehydrate AsyncStorage khi mở lại app.
 */
let session: HttpSession | null = null;

export function setHttpSession(next: HttpSession | null): void {
  session = next;
}

/** `null` khi chưa đăng nhập hoặc store chưa hydrate xong. */
export function getCurrentUserId(): string | null {
  return session?.userId ?? null;
}

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: API_BASE_URL,
  // Hàm chứ không phải giá trị: token đổi giữa các request, phải đọc lúc gửi mới đúng.
  auth: () => session?.accessToken,
});
