import { locationGap, type ListingLocation } from './LocationFields';
import type { ListingAttributes, TemplateField } from '@/api/db';

/*
 * Khớp `createListingSchema` của BE. Chặn ở client để người dùng biết ngay lúc bấm, thay vì gõ
 * xong cả form rồi mới ăn 400 từ server.
 */
const MIN_TITLE = 5;
const MIN_DESC = 10;

export type ListingDraft = {
  title: string;
  price: string;
  desc: string;
  categoryId: string;
  photoCount: number;
  hasFailedPhoto: boolean;
  location: ListingLocation;
  /** Field động ĐANG HIỆN của danh mục đã chọn — đã lọc `showIf` bởi `AttrFields`. */
  attrFields: TemplateField[];
  attributes: ListingAttributes;
};

/** Một chỗ chưa xong: `label` để liệt kê ở chân form, `message` để nói rõ lúc bấm gửi. */
export type DraftGap = { label: string; message: string };

/**
 * TẤT CẢ những chỗ chưa xong, theo thứ tự người dùng đọc form.
 *
 * Trả về danh sách chứ không phải lỗi đầu tiên, vì chân form cần liệt kê "còn thiếu tiêu đề,
 * giá bán, phường / xã" — người đăng tin nhìn một lần là biết còn bao nhiêu việc, thay vì bấm
 * gửi năm lần để lộ ra năm lỗi liên tiếp.
 *
 * Đây là NGUỒN DUY NHẤT của luật: `validateListingDraft` chỉ lấy phần tử đầu. Tách ra hai chỗ
 * tính riêng là kiểu lệch tệ nhất — chân form báo đã đủ mà nút gửi vẫn chặn, hoặc ngược lại.
 *
 * Hàm thuần, đặt cạnh `locationGap` cùng lý do: nó là luật của form, không phải của một màn
 * hình cụ thể — và tách ra khỏi route thì route mới còn chỗ để thở dưới trần LOC.
 */
export function listingDraftGaps(draft: ListingDraft): DraftGap[] {
  const gaps: DraftGap[] = [];

  // Ảnh hỏng và thiếu ảnh loại trừ nhau: ảnh tải lỗi nghĩa là người dùng ĐÃ chọn ảnh, nêu cả
  // hai là bảo họ vừa thiếu ảnh vừa có ảnh hỏng.
  if (draft.hasFailedPhoto) {
    gaps.push({ label: 'ảnh tải lỗi', message: '⚠️ Có ảnh tải lỗi — chạm vào ảnh đó để thử lại' });
  } else if (draft.photoCount === 0) {
    gaps.push({ label: 'ảnh', message: '⚠️ Tin cần ít nhất 1 ảnh' });
  }

  if (draft.title.trim().length < MIN_TITLE) {
    gaps.push({
      label: 'tiêu đề',
      message: `⚠️ Tên món đồ cần ít nhất ${MIN_TITLE} ký tự`,
    });
  }
  if (!draft.price.trim()) {
    gaps.push({ label: 'giá bán', message: '⚠️ Nhập giá bán — cho tặng thì ghi 0' });
  }
  if (draft.desc.trim().length < MIN_DESC) {
    gaps.push({ label: 'mô tả', message: `⚠️ Mô tả cần ít nhất ${MIN_DESC} ký tự` });
  }
  if (!draft.categoryId) {
    gaps.push({ label: 'danh mục', message: '⚠️ Chọn danh mục cho tin trước đã' });
  }

  for (const f of draft.attrFields) {
    if (f.required && isBlank(draft.attributes[f.key])) {
      gaps.push({
        label: f.label.toLowerCase(),
        message: `⚠️ Nhập "${f.label}" — danh mục này bắt buộc`,
      });
    }
  }

  const where = locationGap(draft.location);
  if (where) gaps.push(where);

  return gaps;
}

/** Thông điệp lỗi ĐẦU TIÊN, `null` nếu hợp lệ — cùng luật với `listingDraftGaps`. */
export function validateListingDraft(draft: ListingDraft): string | null {
  return listingDraftGaps(draft)[0]?.message ?? null;
}

/** Rỗng = người dùng chưa nhập. `false` và `0` là giá trị THẬT — khớp `isBlank` bên BE. */
function isBlank(value: ListingAttributes[string] | undefined): boolean {
  if (value === undefined || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}
