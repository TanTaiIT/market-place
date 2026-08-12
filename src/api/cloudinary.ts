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
const CLOUD_NAME = 'ds4dqc7s5';

/** Preset phải được tạo ở Cloudinary Console với Signing Mode = Unsigned. */
const UPLOAD_PRESET = 'ghim_unsigned';

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
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
  const name = uri.split('/').pop() || 'upload.jpg';

  const form = new FormData();
  // React Native nhận `{ uri, name, type }` cho phần file, còn kiểu chuẩn của FormData
  // chỉ khai `Blob | string` — ép kiểu ở đúng một dòng này thay vì nới lỏng cả file.
  form.append('file', { uri, name, type: mimeOf(name) } as unknown as Blob);
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
  return json.secure_url;
}
