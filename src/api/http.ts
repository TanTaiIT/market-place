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
/** Tên header org. Mỗi lượt gọi tự gắn — xem `adminApi`/`orgApi`, tầng này không gắn hộ. */
export const ORG_HEADER = 'X-Org-Id';

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

/** Org đang chọn đã bị khoá/xoá — LỰA CHỌN cũ, không phải phiên chết. */
function isOrgGone(outcome: SdkOutcome): boolean {
  if (outcome.response?.status !== 403) return false;
  const message = errorMessage(outcome);
  return ORG_GONE_ERRORS.some((s) => message.includes(s));
}

/**
 * Cùng phán quyết, nhưng đọc từ `Error` mà tầng query nhận được.
 *
 * PREDICATE chứ không phải callback đăng ký: bản trước là `setOrgGoneHandler`, một hàm toàn cục
 * do `queries/auth` bơm vào để bỏ chọn "org đang thao tác". Không còn org toàn cục nào để bỏ
 * chọn — phạm vi giờ sống trong `AdminOrgScope`, và nó tự hỏi câu này khi thấy lỗi, thay vì
 * tầng HTTP với tay vào state của màn hình.
 */
export function isOrgGoneError(error: unknown): boolean {
  return error instanceof Error && ORG_GONE_ERRORS.some((s) => error.message.includes(s));
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
   * request refresh thì cũng mang đúng cái `X-Org-Id` đó nên nó hỏng y hệt — rồi
   * `refreshSession` dọn phiên và app đăng xuất người dùng vì một lý do không liên quan gì
   * tới phiên của họ. (BE giờ cũng miễn tenant cho `/auth/*`; đây là chốt thứ hai.)
   *
   * Không gọi lại ngay: id org nằm trong chính lượt gọi vừa hỏng, nên gọi lại là gửi đúng cái
   * id vừa bị từ chối. Call-site phải bỏ chọn nhóm rồi mới thử lại.
   */
  if (isOrgGone(first)) return first;

  // Chưa đăng nhập thì 401/404 là lỗi thật của request, không phải phiên hỏng.
  if (!session || !isDeadSession(first)) return first;

  // Phiên đã được làm mới trong lúc request này đang bay: nó chỉ hỏng vì mang token cũ, gọi lại
  // là đủ. Thiếu nhánh này thì mỗi request lỡ nhịp lại kéo thêm một lần refresh — mà BE rotate
  // refresh token, nên lần thừa đó có thể chạy bằng token đã bị lượt trước vô hiệu hoá.
  if (generation !== sentWith) return call();

  return (await refreshOnce()) ? call() : first;
}

/**
 * Câu người dùng đọc khi request KHÔNG tới được server.
 *
 * Đây là chỗ duy nhất dịch nhóm lỗi đó, vì `fetch` bên dưới là điểm nghẽn mà MỌI lượt gọi SDK
 * đi qua — cả đường có token lẫn đường công khai (`categoryList`, `organizationLookup`…). Hơn
 * hai chục màn đang in thẳng `error.message` vào `EmptyState`, nên không dịch ở đây thì người
 * dùng đọc nguyên văn thứ mà tầng native ném ra: *"fetch failed: UnexpectedException: Could
 * not connect to server. (at ExpoModulesCore/Promise.swift:56)"*.
 *
 * Nhận diện bằng "fetch có NÉM hay không", không so chuỗi: lỗi HTTP (4xx/5xx) không ném — nó
 * về dưới dạng response và đã có `unwrap` xử. Fetch mà ném thì chắc chắn là tầng vận chuyển,
 * và chuỗi báo lỗi khác nhau giữa `expo/fetch` (SDK 52+, WinterCG) và fetch cũ của RN
 * (`TypeError: Network request failed`) — so chuỗi là hẹn một ngày đổi SDK là hỏng lặng.
 *
 * `__DEV__` thì kèm URL đang gọi. Ca hay gặp nhất khi dev là `EXPO_PUBLIC_API_URL` còn trỏ vào
 * LAN IP cũ sau khi DHCP cấp lại — biết ngay nó đang gọi đâu thì hết phải đoán. Bản release
 * không hiện: người dùng không cần biết địa chỉ nội bộ, và nó chỉ làm câu thông báo rối.
 */
function networkMessage(): string {
  const base = 'Không kết nối được tới server. Kiểm tra Wi-Fi hoặc 4G rồi thử lại.';
  return __DEV__ ? `${base}\n(đang gọi ${API_BASE_URL})` : base;
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
   * Chỉ còn gánh lỗi mạng. Header org KHÔNG gắn ở đây nữa: mỗi hàm api tự đặt `X-Org-Id` cho
   * lượt gọi của nó.
   *
   * Cái mặc định cũ tiện nhưng nói dối — nó biến "nhóm tôi đang đứng" thành một BỘ LỌC ĐỌC ngầm
   * trên mọi request, nên người thuộc hai nhóm chỉ bao giờ thấy được tin của một nhóm, và chẳng
   * có chữ ký hàm nào cho thấy điều đó. Muốn thu hẹp theo nhóm thì dùng `?orgId=`, một tham số
   * nhìn thấy được.
   */
  fetch: async (request) => {
    try {
      return await globalThis.fetch(request);
    } catch (err) {
      /*
       * Request bị HUỶ không phải lỗi mạng: TanStack cancel khi component unmount hoặc khi
       * query key đổi giữa lúc đang bay. Đổi nó thành lỗi mạng là hiện "mất kết nối" cho một
       * lượt gọi mà chính app vừa chủ động bỏ.
       */
      if (err instanceof Error && err.name === 'AbortError') throw err;
      // `cause` giữ nguyên lỗi gốc của tầng native: giao diện đọc `message` đã dịch, còn log
      // và màn ErrorScreen vẫn lần được về đúng chuỗi mà `expo/fetch` ném ra.
      throw new Error(networkMessage(), { cause: err });
    }
  },
});
