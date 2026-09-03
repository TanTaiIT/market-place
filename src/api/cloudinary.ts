/**
 * Upload ảnh thẳng từ máy người dùng lên Cloudinary rồi chỉ gửi URL xuống BE.
 *
 * Dùng **unsigned upload preset** — đây là cách duy nhất upload từ client an toàn:
 * bundle React Native giải nén được, nên `apiSecret` (và cả `apiKey`) tuyệt đối không
 * được xuất hiện trong repo này. Chữ ký chỉ tồn tại ở phía server; muốn upload có ký
 * thì BE phải cấp signature, và khi đó luồng không còn là "FE upload thẳng" nữa.
 *
 * Cloud name không phải bí mật — nó nằm sẵn trong mọi URL ảnh Cloudinary trả về.
 */
import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const CLOUD_NAME = 'ds4dqc7s5';

/** Preset phải được tạo ở Cloudinary Console với Signing Mode = Unsigned. */
const UPLOAD_PRESET = 'ghim_unsigned';

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

/**
 * Trần cạnh dài của ảnh upload. `quality` của expo-image-picker chỉ nén JPEG chứ KHÔNG giảm
 * độ phân giải — ảnh 4000×3000 của điện thoại vẫn đi nguyên 4000px lên mạng. Màn hình lớn nhất
 * app phục vụ chỉ ~1200px logic, nên 2000px là đủ dư cho cả zoom, còn dung lượng thì giảm ~3-4 lần.
 */
const MAX_DIMENSION = 2000;

/** Mức nén khi phải re-encode lúc thu nhỏ — cùng tinh thần `quality: 0.7` của các picker. */
const RESIZE_JPEG_QUALITY = 0.8;

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
 * Thu nhỏ ảnh về ≤ `MAX_DIMENSION` TRƯỚC khi upload — tiết kiệm băng thông lúc gửi, không chỉ
 * lúc lưu (việc đó incoming transformation trên preset làm được, nhưng ảnh vẫn phải bò hết
 * 3-12MB qua 3G rồi mới bị Cloudinary cắt).
 *
 * Nằm ở đây chứ không trong từng picker: đây là điểm nghẽn duy nhất mọi ảnh phải đi qua
 * (PhotoPicker, AvatarPicker, màn sửa org), sửa một chỗ phủ cả ba luồng.
 *
 * Ảnh đã nhỏ hơn trần trả về NGUYÊN uri — không re-encode để khỏi mất chất lượng vô ích.
 * Mọi đường lỗi (không đọc được size, resize hỏng) đều rơi về bản gốc: upload chậm hơn là
 * phiền, chặn người dùng đăng tin mới là hỏng việc.
 */
async function downscale(uri: string): Promise<string> {
  const size = await sizeOf(uri);
  if (!size || Math.max(size.width, size.height) <= MAX_DIMENSION) return uri;

  try {
    const context = ImageManipulator.manipulate(uri);
    // Chỉ đặt MỘT cạnh — cạnh kia manipulator tự tính để giữ tỉ lệ.
    context.resize(
      size.width >= size.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION },
    );
    const image = await context.renderAsync();
    // JPEG cố định (kể cả nguồn PNG/HEIC): ảnh chụp thật không cần alpha, và HEIC đổi sang
    // JPEG còn tiện — trước giờ vẫn phải đoán MIME cho nó ở `mimeOf`.
    const saved = await image.saveAsync({ compress: RESIZE_JPEG_QUALITY, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return uri;
  }
}

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

/** Suy MIME từ đuôi file; Cloudinary từ chối phần file thiếu `type` hợp lệ. */
function mimeOf(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

/**
 * Tải một ảnh local (`file://…` từ expo-image-picker) lên Cloudinary.
 * @returns `secure_url` — chuỗi HTTPS để lưu xuống BE.
 */
export async function uploadImage(uri: string): Promise<string> {
  const source = await downscale(uri);
  const name = source.split('/').pop() || 'upload.jpg';

  const form = new FormData();
  // React Native nhận `{ uri, name, type }` cho phần file, còn kiểu chuẩn của FormData
  // chỉ khai `Blob | string` — ép kiểu ở đúng một dòng này thay vì nới lỏng cả file.
  form.append('file', { uri: source, name, type: mimeOf(name) } as unknown as Blob);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
  const json = (await res.json()) as CloudinaryUploadResponse;

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
