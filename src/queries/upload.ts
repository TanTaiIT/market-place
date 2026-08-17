import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { uploadImage } from '@/api/cloudinary';

/** Cloudinary không giới hạn, nhưng 6 ảnh là đủ cho một tin */
export const MAX_PHOTOS = 6;

/** Một ảnh đang được chuẩn bị cho tin đăng. `uri` local đóng vai id, `url` có khi upload xong. */
export type ListingPhoto = {
  uri: string;
  url?: string;
  status: 'uploading' | 'done' | 'error';
  /**
   * Lý do upload hỏng, giữ nguyên thông điệp từ Cloudinary. Chỉ có cờ `status: 'error'` là không
   * đủ: lỗi cấu hình vĩnh viễn ("Upload preset not found") trông y hệt lỗi mạng tạm thời, nên
   * người dùng bấm "thử lại" mãi mà không biết là vô ích.
   */
  error?: string;
};

/**
 * Quản lý bộ ảnh của form đăng tin. **Chọn xong là upload ngay**, không đợi lúc submit:
 * người dùng còn đang gõ tiêu đề thì ảnh đã bay lên Cloudinary, nên bấm "Ghim" chỉ còn
 * chờ mỗi bước tạo tin thay vì 2 chặng nối tiếp.
 *
 * Đánh đổi đã cân nhắc: bỏ ngang form hoặc xoá ảnh sau khi chọn sẽ để lại ảnh mồ côi trên
 * Cloudinary. Xoá chúng cần chữ ký nên là việc của BE, FE không làm được.
 */
export function useListingPhotos(initialUrls: string[] = []) {
  // Ảnh của tin đang sửa đã nằm sẵn trên Cloudinary nên vào thẳng `done`, không upload lại;
  // `uri` mượn chính URL đó vì trong hook này `uri` vừa là khoá vừa là nguồn hiển thị.
  // Lazy initializer: `initialUrls` chỉ đọc ở lần mount đầu, các render sau không nuốt mất
  // ảnh người dùng vừa thêm — nên màn sửa phải chờ tin về rồi mới mount form.
  const [photos, setPhotos] = useState<ListingPhoto[]>(() =>
    initialUrls.map((url) => ({ uri: url, url, status: 'done' as const })),
  );
  const upload = useMutation({ mutationFn: uploadImage });

  const patch = (uri: string, next: Partial<ListingPhoto>) =>
    setPhotos((list) => list.map((p) => (p.uri === uri ? { ...p, ...next } : p)));

  const start = async (uri: string) => {
    patch(uri, { status: 'uploading', url: undefined, error: undefined });
    try {
      patch(uri, { status: 'done', url: await upload.mutateAsync(uri) });
    } catch (e) {
      // Báo lỗi ngay trên thumbnail (chạm để thử lại) thay vì toast: 6 ảnh hỏng
      // sẽ đẩy ra 6 toast chồng nhau, và người dùng không biết ảnh nào hỏng.
      patch(uri, { status: 'error', error: (e as Error).message });
    }
    // `patch` là map theo uri nên ảnh bị xoá giữa chừng sẽ tự no-op, không cần huỷ tay
  };

  const addPhotos = (uris: string[]) => {
    const fresh = uris
      .filter((uri) => !photos.some((p) => p.uri === uri))
      .slice(0, MAX_PHOTOS - photos.length);
    if (fresh.length === 0) return;

    setPhotos((list) => [...list, ...fresh.map((uri) => ({ uri, status: 'uploading' as const }))]);
    fresh.forEach((uri) => void start(uri));
  };

  const removePhoto = (uri: string) => setPhotos((list) => list.filter((p) => p.uri !== uri));
  const retryPhoto = (uri: string) => void start(uri);

  return {
    photos,
    addPhotos,
    removePhoto,
    retryPhoto,
    /** Chỉ dùng khi mọi ảnh đã `done` — thứ tự giữ nguyên nên phần tử đầu là ảnh bìa */
    photoUrls: photos.flatMap((p) => (p.url ? [p.url] : [])),
    uploadingCount: photos.filter((p) => p.status === 'uploading').length,
    hasFailed: photos.some((p) => p.status === 'error'),
  };
}

/**
 * Bộ ảnh đã mount, truyền nguyên khối từ route xuống `ListingForm`.
 *
 * Route gọi hook chứ không phải form: upload là `useMutation`, mà mutation chỉ được khởi động
 * từ `app/**` (ranh giới ở AGENTS §Kiến trúc). Truyền cả object thay vì bung ra sáu prop rời —
 * chúng luôn đi cùng nhau, tách ra chỉ để mỗi call-site phải nối lại đúng sáu mảnh đó.
 */
export type ListingPhotosController = ReturnType<typeof useListingPhotos>;
