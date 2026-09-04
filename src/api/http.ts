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
/** Tên header org, dùng chung để chỗ ghi đè và chỗ mặc định không lệch nhau. */
export const ORG_HEADER = 'X-Org-Slug';

let session: HttpSession | null = null;

/**
 * Tổ chức đang thao tác, gắn vào MỌI request dưới dạng header `X-Org-Slug`.
 *
 * BE v2 không còn đọc org từ token: nó lấy theo subdomain (web) hoặc header này (app), rồi đối
 * chiếu `memberships` ngay tại request đó. Hệ quả cần nhớ khi đọc code này: rời tổ chức là mất
 * quyền NGAY, không phải chờ token hết hạn.
 *
 * `null` = chưa chọn org. Không gửi header rỗng: BE sẽ coi chuỗi rỗng là "không chỉ ra org" và
 * tự suy ra khi người dùng chỉ thuộc đúng một org — gửi `''` chỉ làm nhiễu log.
 */
let activeOrgSlug: string | null = null;

export function setActiveOrgSlug(next: string | null): void {
  activeOrgSlug = next;
}

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

/**
 * Sentinel 403 của `resolveTenant` bên BE: tổ chức đang chọn đã bị khoá hoặc không còn tồn tại.
 *
 * KHÔNG còn gộp "không thuộc org này" vào đây như bản v1: ở v2 quan hệ thành viên là thứ đổi
 * được trong lúc dùng (bị gỡ khỏi tổ chức), mà PHIÊN ĐĂNG NHẬP thì vẫn tốt nguyên. Đăng xuất
 * người ta vì lý do đó là phản ứng sai — đúng ra chỉ cần bỏ chọn org.
 *
 * Chính lý lẽ đó áp cho org BỊ KHOÁ, nên nó cũng không còn là một đường đăng xuất: xem
 * `isOrgGone` và nhánh xử nó trong `withAuthRetry`.
 */
const ORG_GONE_ERRORS = ['Organization đã bị khoá', 'Organization không tồn tại'];

/**
 * Bỏ chọn org đang thao tác. Do `queries/auth` đẩy vào — `src/api/**` không được import
 * `stores/**` (folder.convention §6), cùng cách `setSessionRefresher` làm.
 */
let orgGoneHandler: (() => void) | null = null;

export function setOrgGoneHandler(next: (() => void) | null): void {
  orgGoneHandler = next;
}

/** Org đang chọn đã bị khoá/xoá — LỰA CHỌN cũ, không phải phiên chết. */
function isOrgGone(outcome: SdkOutcome): boolean {
  if (outcome.response?.status !== 403) return false;
  const message = errorMessage(outcome);
  return ORG_GONE_ERRORS.some((s) => message.includes(s));
}

/**
 * Endpoint DUY NHẤT mà 404 mang nghĩa "phiên trỏ tới một user không còn tồn tại". Ở mọi đường
 * khác 404 chỉ là "không tìm thấy tin/hội thoại này" — đăng xuất vì nó là sai hoàn toàn.
 */
const ME_ENDPOINT = '/users/me';

type SdkOutcome = { error?: unknown; response?: Response };

function errorMessage(outcome: SdkOutcome): string {
  const message = (outcome.error as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' ? message : '';
}

/**
 * Phiên KHÔNG còn dùng được: token hết hạn (cứu được bằng refresh), hoặc danh tính đứng sau
 * token đã biến mất (chỉ còn đường đăng xuất). Gộp hai ca vì chúng đi cùng một lối: thử refresh
 * một lần, refresh hỏng thì `refreshSession` dọn phiên.
 *
 * Đúng hai dạng, và cả hai đều nói về NGƯỜI DÙNG:
 *  - **401** — route có `authenticate`, hoặc `/auth/refresh` khi user đã bị xoá
 *    (`User no longer valid`).
 *  - **404 trên `/users/me`** — user bị xoá khỏi DB. Đây là trường hợp duy nhất không có mã
 *    4xx nào khác báo hiệu: `authenticate` dựng `req.user` thẳng từ JWT mà không tra DB, nên
 *    `GET /listings` vẫn trả **200** như thường và app không hề hay biết mình đang chạy bằng
 *    danh tính của một người không còn tồn tại.
 *
 * 403 org-bị-khoá KHÔNG nằm ở đây — đó là lựa chọn org cũ, không phải phiên chết (`isOrgGone`).
 * 400 `Missing tenant context` cũng không: chưa chọn org là trạng thái hợp lệ, không phải lỗi phiên.
 */
function isDeadSession(outcome: SdkOutcome): boolean {
  const status = outcome.response?.status;
  if (status === 401) return true;

  // `response.url` là URL tuyệt đối đã resolve, nên so bằng `includes` chứ không phải `===`.
  if (status === 404) return (outcome.response?.url ?? '').includes(ME_ENDPOINT);

  return false;
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

  /*
   * Org đang chọn đã bị khoá: bỏ chọn nó rồi trả lỗi về cho call-site, KHÔNG refresh.
   *
   * Refresh ở đây vừa vô nghĩa vừa tự sát: `auth.service.refresh` bên BE không đọc org, mà
   * request refresh thì cũng mang đúng cái `X-Org-Slug` đó nên nó hỏng y hệt — rồi
   * `refreshSession` dọn phiên và app đăng xuất người dùng vì một lý do không liên quan gì
   * tới phiên của họ. (BE giờ cũng miễn tenant cho `/auth/*`; đây là chốt thứ hai.)
   *
   * Không gọi lại ngay: header org đọc từ `activeOrgSlug` của module này, mà giá trị đó chỉ
   * đổi sau khi store re-render đẩy xuống — gọi lại lập tức là gửi đúng slug vừa bị từ chối.
   */
  if (isOrgGone(first)) {
    orgGoneHandler?.();
    return first;
  }

  // Chưa đăng nhập thì 401/404 là lỗi thật của request, không phải phiên hỏng.
  if (!session || !isDeadSession(first)) return first;

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
  /**
   * Gắn org đang chọn qua `fetch` chứ không qua `headers` của config: `headers` chỉ nhận giá
   * trị TĨNH, đọc một lần lúc dựng client — mà org thì đổi giữa phiên (người dùng chuyển tổ
   * chức) nên phải đọc đúng lúc gửi. Đây cũng là chỗ duy nhất làm được việc đó mà không phải
   * import `client.gen.ts` vào đây: file đó import ngược lại chính `http.ts` làm runtime config.
   */
  fetch: (request) => {
    // Kiểu khai của hey-api rộng hơn thực tế (`string | URL | Request`), nhưng client-fetch
    // luôn dựng sẵn `Request` trước khi gọi. Thu hẹp bằng `instanceof` thay vì ép kiểu: nếu
    // một bản sau đổi cách gọi, header chỉ đơn giản không được gắn thay vì nổ lúc chạy.
    /*
     * KHÔNG ghi đè header người gọi đã tự đặt. Org hoạt động là mặc định của cả app, nhưng
     * vài chỗ cần đọc dữ liệu của MỘT tổ chức khác mà không kéo cả app sang đó — hồ sơ nhóm
     * hiện danh bạ và tin của chính nhóm đang mở, trong khi người dùng vẫn đang thao tác ở
     * nhóm khác. BE vẫn đối chiếu membership với slug nhận được, nên đây không phải lối vòng
     * qua phân quyền: gửi slug của nhóm mình không thuộc về thì vẫn 403 như thường.
     */
    if (activeOrgSlug && request instanceof Request && !request.headers.has(ORG_HEADER)) {
      request.headers.set(ORG_HEADER, activeOrgSlug);
    }
    return globalThis.fetch(request);
  },
});
