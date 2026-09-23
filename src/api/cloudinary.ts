/**
 * Upload ảnh thẳng từ máy người dùng lên Cloudinary rồi chỉ gửi URL xuống BE.
 *
 * Preset chạy ở chế độ **Signed**, nên mỗi lượt gồm HAI chặng:
 *
 *   1. `POST /uploads/signature` tới BE  → xin `signature` + `timestamp` + `api_key`.
 *   2. `POST` thẳng lên Cloudinary       → file đi kèm ba thứ đó.
 *
 * File vẫn KHÔNG đi qua server — chỉ chữ ký đi. Đẩy vài MB ảnh qua instance mỗi lượt đăng tin
 * là tốn băng thông gấp đôi để đổi lấy đúng một phép băm.
 *
 * `apiSecret` tuyệt đối không có mặt trong repo này: bundle React Native giải nén được. Nó chỉ
 * sống ở BE (`upload.service.ts`), và đó là toàn bộ lý do chặng 1 tồn tại. `apiKey` thì không
 * phải bí mật, nhưng vẫn lấy từ BE cho cùng một nguồn sự thật.
 *
 * ĐIỀU ĐỔI LẠI: upload không còn ẩn danh — chưa đăng nhập thì không có chữ ký. Trước đây (preset
 * unsigned) bất kỳ ai giải nén được .apk đều bơm được file vào tài khoản này, và không dòng code
 * nào bên app chặn nổi. Đó là lỗ hổng mà Signed bịt lại.
 *
 * Cấu hình preset ở Console vẫn còn giá trị và vẫn nên đặt — Allowed formats (chỉ ảnh),
 * Max file size, Max image dimensions — nhưng giờ chúng là lớp thứ hai, không phải lớp duy nhất.
 * `folder` thì KHÔNG còn đọc từ preset: BE ký kèm nó, nên thư mục ảnh rơi vào luôn khớp thư mục
 * mà job dọn ảnh quét.
 */
import { Image } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { API_BASE_URL, getAccessToken } from './http';

/**
 * Chữ ký cho một lượt upload, do BE cấp (`POST /uploads/signature`).
 *
 * Cloud name, thư mục và tên preset đều tới từ đó chứ không còn hằng số trong file này: cả ba
 * đều là tham số ĐƯỢC KÝ, nên app tự chọn một giá trị khác là chữ ký lệch và Cloudinary trả 401.
 */
type UploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadPreset: string;
};

/**
 * Trần cạnh dài của ảnh upload. Màn rộng nhất app phục vụ ~430pt × 3 = 1290px, và `displayUrl`
 * đã resize lúc hiển thị, nên ảnh LƯU chỉ cần đủ cho màn chi tiết + zoom nhẹ. 2000 → 1600 bớt
 * ~35% bytes so với bản trước — trên 4G là ~0,3–0,5s mỗi ảnh, trên 3G nhiều hơn.
 */
const MAX_DIMENSION = 1600;

/** Mức nén JPEG DUY NHẤT của cả app — picker không nén nữa (xem `prepare`). */
const JPEG_QUALITY = 0.75;

/** Đọc kích thước từ header file, không decode cả ảnh. Lỗi trả `null` — caller tự quyết. */
function sizeOf(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

/**
 * Chuẩn hoá ảnh TRƯỚC khi upload: thu về ≤ `MAX_DIMENSION` và mã hoá JPEG — một lần, ở đây và
 * chỉ ở đây. Tiết kiệm băng thông lúc GỬI, không chỉ lúc lưu (incoming transformation trên
 * preset làm được việc sau, nhưng ảnh vẫn phải bò hết 3-12MB qua 3G rồi mới bị Cloudinary cắt).
 *
 * Trước đây picker nén (`quality: 0.7`) rồi hàm này nén lại: hai lần decode + encode một ảnh
 * 12MP cho một kết quả mà lần đầu bị vứt đi — ~0,5–1s mỗi ảnh trên máy tầm trung, và lần đầu
 * chạy NGAY trong picker nên chọn 6 ảnh là picker treo 6 lần. Giờ picker trả nguyên bản
 * (`quality: 1`), và đây là điểm nghẽn duy nhất mọi ảnh đi qua (PhotoPicker, AvatarPicker, màn
 * sửa org) — sửa một chỗ phủ cả ba luồng.
 *
 * LUÔN mã hoá lại, kể cả ảnh đã nhỏ hơn trần: nguồn giờ là bản chưa nén (PNG chụp màn hình,
 * JPEG q100, HEIC), bỏ qua nó là upload nguyên 5MB. JPEG cố định kể cả cho PNG/HEIC: ảnh chụp
 * thật không cần alpha, và MIME suy được thẳng từ đuôi file.
 *
 * Mọi đường lỗi (không đọc được size, render hỏng) rơi về bản gốc: upload chậm hơn là phiền,
 * chặn người dùng đăng tin mới là hỏng việc.
 */
async function prepare(uri: string): Promise<string> {
  try {
    const size = await sizeOf(uri);
    const context = ImageManipulator.manipulate(uri);
    if (size && Math.max(size.width, size.height) > MAX_DIMENSION) {
      // Chỉ đặt MỘT cạnh — cạnh kia manipulator tự tính để giữ tỉ lệ.
      context.resize(
        size.width >= size.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION },
      );
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return uri;
  }
}

/** KB của một file local; `null` nếu không đọc được — chỉ để log, không quyết định gì. */
function kbOf(uri: string): number | null {
  try {
    const size = new File(uri).size;
    return size === null ? null : Math.round(size / 1024);
  } catch {
    return null;
  }
}

/**
 * Chỉ trong dev: một dòng cho mỗi ảnh — thời gian chuẩn hoá trên máy, bytes trước/sau, và thời
 * gian Cloudinary (kết nối + gửi + xử lý phía server, gộp). Không có ba con số này thì mọi lần
 * chỉnh preset hay mức nén đều là đoán: "4 giây" có thể là 3 giây CPU máy yếu, hoặc 3 giây một
 * add-on kiểm duyệt đồng bộ đang giữ response ở phía Cloudinary — hai bệnh, hai thuốc.
 */
function logTiming(original: string, prepared: string, t0: number, t1: number, t2: number) {
  if (!__DEV__) return;
  // oxlint-disable-next-line no-console
  console.log(
    `[upload] prepare ${t1 - t0}ms (${kbOf(original) ?? '?'}KB → ${kbOf(prepared) ?? '?'}KB) · cloudinary ${t2 - t1}ms`,
  );
}

/**
 * URL hiển thị cho một bề ngang cho trước — chèn transformation vào URL Cloudinary.
 *
 * Thẻ tin, vòng khu vực, dải gợi ý đều chỉ vẽ 74–400px nhưng trước đây tải nguyên ảnh gốc
 * (tới 2000px sau `downscale`): decode ảnh cỡ đó chạy đúng lúc đang lướt là rớt khung hình —
 * đây chính là nguồn giựt của các dải cuộn ngang. Cloudinary resize NGAY TRÊN URL nên không
 * cần upload lại gì cả.
 *
 * - `c_limit`: chỉ thu nhỏ, không phóng to ảnh vốn đã nhỏ hơn `width`.
 * - `q_auto,f_auto`: Cloudinary tự chọn mức nén + định dạng (WebP/AVIF) theo thiết bị.
 * - URL không phải Cloudinary (không có `/upload/`) trả nguyên vẹn — helper không đoán mò
 *   cấu trúc của một CDN khác.
 */
/**
 * Bản VUÔNG của một ảnh — dùng khi nhét ảnh ngang (bìa nhóm 16:9) vào ô vuông hoặc tròn.
 *
 * `c_fill,g_auto` chứ không phải `c_limit` như `displayUrl`: `c_limit` chỉ co vừa khung, nên
 * phần cắt do `resizeMode="cover"` của RN quyết định — và nó luôn cắt GIỮA. Ảnh bìa thường
 * bố cục ngang với chủ thể lệch một bên, cắt giữa ra một mảng tường trống.
 * `g_auto` để Cloudinary tự tìm chủ thể rồi mới cắt, nên ô tròn còn ra được thứ nhận diện được.
 */
export function squareUrl(url: string, size: number): string {
  return url.includes('/upload/')
    ? url.replace(
        '/upload/',
        `/upload/w_${size},h_${size},c_fill,g_auto,q_auto,f_auto/`,
      )
    : url;
}

export function displayUrl(url: string, width: number): string {
  return url.includes('/upload/')
    ? url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`)
    : url;
}

/** Xem lý do chọn 60s ở chỗ dùng nó trong `uploadImage`. */
const UPLOAD_TIMEOUT_MS = 60_000;

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
  /**
   * Chỉ có khi preset bật add-on kiểm duyệt ảnh (aws_rek...). Add-on ĐỒNG BỘ trả kết quả ngay
   * trong response này; add-on bất đồng bộ trả `pending` rồi báo kết quả về webhook của BE
   * (`market/src/features/moderation/moderation.webhook.*`).
   */
  moderation?: Array<{ status?: 'approved' | 'rejected' | 'pending'; kind?: string }>;
};

/** Trần chờ chữ ký — request thường, cùng ngân sách với `REQUEST_TIMEOUT_MS` bên `http.ts`. */
const TICKET_TIMEOUT_MS = 15_000;

/**
 * Xin chữ ký từ BE cho một lượt upload.
 *
 * `fetch` tay chứ không qua SDK generated: nó chỉ là một chặng của `uploadImage`, mà hàm đó vốn
 * đã nói chuyện thẳng với Cloudinary. Đổi lại phải tự cầm token — xem `getAccessToken`.
 *
 * Một chữ ký cho MỘT ảnh, không tái sử dụng: `timestamp` nằm trong chữ ký, và Cloudinary từ chối
 * chữ ký quá cũ. Đăng tin 5 ảnh là 5 lượt gọi — rẻ, vì response chỉ vài trăm byte.
 */
async function fetchTicket(): Promise<UploadTicket> {
  const token = getAccessToken();
  /*
   * Khách chưa đăng nhập KHÔNG upload được nữa, và đó chính là điểm của việc chuyển preset sang
   * Signed: trước đây ai giải nén được bundle cũng đẩy file vào tài khoản này. Bắt ở đây thay vì
   * để BE trả 401 — câu này nói ra được việc cần làm, mã 401 thì không.
   */
  if (!token) throw new Error('Đăng nhập để tải ảnh lên');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TICKET_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/uploads/signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new Error('Không xin được chữ ký tải ảnh. Kiểm tra Wi-Fi hoặc 4G rồi thử lại.', {
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }

  // 501 = server thiếu `CLOUDINARY_*`; 429 = xin chữ ký quá nhanh. Cả hai đều có câu đọc được ở
  // BE, nên hiện nguyên văn thay vì nuốt đi và nói chung chung "tải ảnh thất bại".
  const body = (await res.json().catch(() => null)) as
    | { data?: UploadTicket; message?: string }
    | null;
  if (!res.ok || !body?.data) {
    throw new Error(body?.message ?? `Không xin được chữ ký tải ảnh (HTTP ${res.status})`);
  }
  return body.data;
}

/**
 * Tải một ảnh local (`file://…` từ expo-image-picker) lên Cloudinary.
 * @returns `secure_url` — chuỗi HTTPS để lưu xuống BE.
 */
export async function uploadImage(uri: string): Promise<string> {
  const t0 = Date.now();
  // Xin chữ ký TRƯỚC khi nén: hỏng vì chưa đăng nhập hay server thiếu cấu hình thì biết ngay,
  // không bắt người dùng chờ hết một lượt resize rồi mới báo lỗi.
  const ticket = await fetchTicket();
  const source = await prepare(uri);
  const t1 = Date.now();
  const name = source.split('/').pop() || 'upload.jpg';

  const form = new FormData();
  // Fetch của SDK 57+ theo chuẩn WinterCG, không còn nhận part kiểu `{ uri, name, type }`
  // cũ của React Native (ném "Unsupported FormDataPart implementation"). `File` của
  // expo-file-system tương thích Blob nên append thẳng được; ép kiểu vì lib DOM của TS
  // khai `Blob | string` chứ không biết class này.
  form.append('file', new File(source) as unknown as Blob, name);
  /*
   * ĐÚNG những trường này, không thừa không thiếu.
   *
   * `folder`, `timestamp`, `upload_preset` là ba tham số BE đã ký — gửi lệch một giá trị, bỏ bớt
   * một trường, hay thêm một trường được ký nữa (`context`, `tags`…) đều làm chữ ký sai và
   * Cloudinary trả 401. Thêm tham số mới thì phải thêm ở CẢ HAI phía, `upload.service.ts` trước.
   *
   * `file` và `api_key` không tham gia ký — Cloudinary loại chúng ra trước khi đối chiếu.
   */
  form.append('api_key', ticket.apiKey);
  form.append('timestamp', String(ticket.timestamp));
  form.append('signature', ticket.signature);
  form.append('folder', ticket.folder);
  form.append('upload_preset', ticket.uploadPreset);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`;

  /*
   * Cùng lối với `http.ts`, khác NGÂN SÁCH. `fetch` không tự bỏ cuộc, nên Wi-Fi rớt giữa lúc
   * đẩy ảnh để lại một thumbnail quay vòng tròn vĩnh viễn và form đăng tin không bao giờ bấm
   * gửi được — người dùng không có cách nào biết chuyện gì đang xảy ra.
   *
   * 60s chứ không phải 15s như request thường: ảnh sau `prepare` vẫn cỡ vài trăm KB tới vài MB,
   * và trên 3G yếu thì một phút là một lượt tải đang chạy bình thường, không phải một lượt hỏng.
   */
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: 'POST', body: form, signal: ctrl.signal });
  } catch (err) {
    if (timedOut) {
      throw new Error('Tải ảnh lên quá lâu — kiểm tra mạng rồi thử lại', { cause: err });
    }
    // Trước bản này lỗi vận chuyển bay thẳng lên giao diện, và người dùng đọc nguyên văn chuỗi
    // native. Cùng lý do `networkMessage()` tồn tại bên `http.ts`.
    throw new Error('Không gửi được ảnh lên máy chủ ảnh. Kiểm tra Wi-Fi hoặc 4G rồi thử lại.', {
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json()) as CloudinaryUploadResponse;
  logTiming(uri, source, t0, t1, Date.now());

  if (!res.ok || !json.secure_url) {
    // Kèm nguyên văn message của Cloudinary sau phần copy tiếng Việt: nó là thứ duy nhất phân biệt
    // được lỗi cấu hình vĩnh viễn ("Upload preset not found") với lỗi tạm thời đáng thử lại.
    const detail = json.error?.message;
    throw new Error(
      detail ? `Tải ảnh lên thất bại — Cloudinary: ${detail}` : 'Tải ảnh lên thất bại, thử lại nhé',
    );
  }
  // Ảnh bị kiểm duyệt ĐỒNG BỘ từ chối: báo ngay trên thumbnail như một lượt upload hỏng —
  // đừng để người dùng đăng tin với một URL mà Cloudinary sẽ không bao giờ phục vụ.
  // `pending` thì cho qua: kết quả sẽ về webhook của BE, gỡ sau nếu vi phạm.
  if (json.moderation?.some((m) => m.status === 'rejected')) {
    throw new Error('Ảnh không được chấp nhận vì chứa nội dung không phù hợp');
  }
  return json.secure_url;
}
