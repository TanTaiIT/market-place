/**
 * Upload ảnh thẳng từ máy người dùng lên Cloudinary rồi chỉ gửi URL xuống BE.
 *
 * Dùng **unsigned upload preset** — đây là cách duy nhất upload từ client an toàn:
 * bundle React Native giải nén được, nên `apiSecret` (và cả `apiKey`) tuyệt đối không
 * được xuất hiện trong repo này. Chữ ký chỉ tồn tại ở phía server; muốn upload có ký
 * thì BE phải cấp signature, và khi đó luồng không còn là "FE upload thẳng" nữa.
 *
 * Cloud name không phải bí mật — nó nằm sẵn trong mọi URL ảnh Cloudinary trả về.
 *
 * RỦI RO CÒN LẠI, và nó KHÔNG chặn được bằng code ở đây: unsigned nghĩa là bất kỳ ai đọc được
 * bundle (giải nén .apk là xong) cũng upload được vào tài khoản này. Đây là bài toán lạm dụng
 * và hoá đơn, không phải rò khoá — chặn nó bằng cấu hình PRESET ở Cloudinary Console:
 *
 * - Allowed formats: chỉ ảnh (jpg, png, webp, heic). Mặc định cho phép cả video và raw.
 * - Max file size + max image dimensions: app đã thu nhỏ về `MAX_DIMENSION` trước khi gửi,
 *   nên đặt trần ở preset là chặn đúng thứ KHÔNG đi qua app này.
 * - Folder: ghim tất cả vào một thư mục để tách được rác khi phải dọn.
 * - Access control nếu cần, và theo dõi hạn mức để biết khi bị lạm dụng.
 *
 * KHÔNG bật lại add-on kiểm duyệt ảnh ở đây. Nó từng được bật, và hạ cả luồng đăng tin: hết hạn
 * mức thì Cloudinary không "bỏ qua bước kiểm" mà TỪ CHỐI CẢ LƯỢT UPLOAD, nên một công tơ bên
 * thứ ba cạn giữa tháng là không ai đăng được tin nữa. Ảnh vi phạm giờ do người duyệt gỡ ở bàn
 * quản trị — chậm hơn, nhưng không biến một lá chắn thành sự cố toàn hệ thống.
 *
 * Muốn chặn triệt để thì BE phải cấp chữ ký cho từng lượt upload — khi đó luồng không còn là
 * "FE upload thẳng" nữa, và đó là một thay đổi kiến trúc chứ không phải một cờ cấu hình.
 */
import { Image } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const CLOUD_NAME = 'ds4dqc7s5';

/** Preset phải được tạo ở Cloudinary Console với Signing Mode = Unsigned. */
const UPLOAD_PRESET = 'ghim_unsigned';

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

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

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

/**
 * Tải một ảnh local (`file://…` từ expo-image-picker) lên Cloudinary.
 * @returns `secure_url` — chuỗi HTTPS để lưu xuống BE.
 */
export async function uploadImage(uri: string): Promise<string> {
  const t0 = Date.now();
  const source = await prepare(uri);
  const t1 = Date.now();
  const name = source.split('/').pop() || 'upload.jpg';

  const form = new FormData();
  // Fetch của SDK 57+ theo chuẩn WinterCG, không còn nhận part kiểu `{ uri, name, type }`
  // cũ của React Native (ném "Unsupported FormDataPart implementation"). `File` của
  // expo-file-system tương thích Blob nên append thẳng được; ép kiểu vì lib DOM của TS
  // khai `Blob | string` chứ không biết class này.
  form.append('file', new File(source) as unknown as Blob, name);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
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
  return json.secure_url;
}
