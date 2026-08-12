import type { CreateClientConfig } from './generated/client.gen';

/**
 * Cấu hình runtime cho SDK generated (`runtimeConfigPath` trong `openapi-ts.config.ts`):
 * chốt base URL, gắn Bearer token, và giữ luồng làm mới phiên khi access token hết hạn.
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
 *
 * Cố tình KHÔNG giữ refresh token ở đây: nó chỉ cần cho đúng một lời gọi và store đã là SoT,
 * nhân bản thêm một bản nữa chỉ tăng chỗ có thể lệch.
 */
let session: HttpSession | null = null;

/**
 * Tăng mỗi khi access token đổi. `withAuthRetry` chụp mốc này TRƯỚC khi gửi để phân biệt hai
 * tình huống nhìn giống nhau: token thật sự hết hạn (phải refresh) và token đã được request khác
 * làm mới trong lúc mình đang bay (chỉ cần gọi lại). So theo giá trị token chứ không đếm số lần
 * gọi, vì `useSyncAccessToken` ghi lại mỗi lần render dù phiên không đổi.
 */
let generation = 0;

export function setHttpSession(next: HttpSession | null): void {
  if (next?.accessToken !== session?.accessToken) generation += 1;
  session = next;
}

/** `null` khi chưa đăng nhập hoặc store chưa hydrate xong. */
export function getCurrentUserId(): string | null {
  return session?.userId ?? null;
}

// ── LÀM MỚI PHIÊN ───────────────────────────────────────────────────

/**
 * Hàm đổi refresh token → phiên mới, do `queries/auth.ts` cắm vào (nó được phép chạm store, còn
 * file này thì không). Trả access token mới, hoặc `null` khi hết đường — caller đừng thử lại nữa.
 */
type SessionRefresher = () => Promise<string | null>;

let refresher: SessionRefresher | null = null;
let inFlight: Promise<string | null> | null = null;

export function setSessionRefresher(next: SessionRefresher | null): void {
  refresher = next;
}

/**
 * Single-flight: nhiều request cùng phát hiện token hết hạn chỉ được refresh **một** lần.
 * Thiếu chốt này thì mỗi request hỏng lại rotate một lượt, và BE rotate refresh token nên lượt
 * sau lập tức vô hiệu hoá token của lượt trước — người dùng bị đá ra ngay giữa lúc dùng.
 */
function refreshOnce(): Promise<string | null> {
  if (!refresher) return Promise.resolve(null);
  return (inFlight ??= refresher().finally(() => {
    inFlight = null;
  }));
}

/** Sentinel của `TenantScopeMissingError` bên BE — khớp theo tiền tố, không phải toàn chuỗi. */
const TENANT_SCOPE_ERROR = 'Missing tenant context';

type SdkOutcome = { error?: unknown; response?: Response };

/**
 * Access token hết hạn nhưng BE trả về **hai** dạng khác nhau, phải nhận cả hai:
 *  - route có `authenticate` (`/users/me`, xoá tin) → 401.
 *  - route public đọc collection có tenant (`GET /listings`) → **400** `Missing tenant context`:
 *    `resolveTenant` nuốt lỗi verify token rồi không mở scope, và `tenantPlugin` fail-closed nên
 *    query ném lỗi trước khi tới `authenticate` nào cả.
 * Chỉ nhìn 401 thì bảng tin sẽ không bao giờ tự hồi phục sau khi token hết hạn.
 */
function isExpiredSession(outcome: SdkOutcome): boolean {
  const status = outcome.response?.status;
  if (status === 401) return true;
  if (status !== 400) return false;

  const message = (outcome.error as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.includes(TENANT_SCOPE_ERROR);
}

/**
 * Gọi request; nếu phiên hết hạn thì refresh rồi gọi **lại đúng một lần**. Không vòng lặp: kết quả
 * lần hai được trả nguyên, kể cả khi vẫn lỗi.
 *
 * Bọc bằng hàm nhận thunk thay vì interceptor của SDK: interceptor phải đăng ký lên instance
 * `client` trong `generated/client.gen.ts`, mà file đó lại import chính `http.ts` này làm runtime
 * config → vòng import ngay lúc khởi tạo module.
 */
export async function withAuthRetry<T extends SdkOutcome>(call: () => Promise<T>): Promise<T> {
  const sentWith = generation;
  const first = await call();
  // Chưa đăng nhập thì 401/400 là lỗi thật của request, không phải phiên hết hạn.
  if (!session || !isExpiredSession(first)) return first;

  // Phiên đã được làm mới trong lúc request này đang bay: nó chỉ hỏng vì mang token cũ, gọi lại
  // là đủ. Thiếu nhánh này thì mỗi request lỡ nhịp lại kéo thêm một lần refresh — mà BE rotate
  // refresh token, nên lần thừa đó có thể chạy bằng token đã bị lượt trước vô hiệu hoá.
  if (generation !== sentWith) return call();

  return (await refreshOnce()) ? call() : first;
}

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: API_BASE_URL,
  /**
   * Mặc định cho MỌI request, không chỉ operation nào khai `security` trong spec.
   *
   * SDK chỉ gắn Bearer khi `opts.security` có giá trị, mà `GET /listings` và `GET /listings/:id`
   * được BE khai là public nên hàm generated ra không kèm `security` — trong khi thực tế chúng
   * vẫn cần token, vì `resolveTenant` lấy organization từ JWT và `tenantPlugin` fail-closed.
   * Thiếu dòng này thì bảng tin gửi request trần và luôn nhận 400 `Missing tenant context`.
   *
   * Ghi đè được: operation nào tự khai `security` thì `{ ..._config, ...options }` ưu tiên nó.
   */
  security: [{ scheme: 'bearer', type: 'http' }],
  // Hàm chứ không phải giá trị: token đổi giữa các request, phải đọc lúc gửi mới đúng.
  auth: () => session?.accessToken,
});
