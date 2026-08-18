import { validateLocation, type ListingLocation } from './LocationFields';
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

/**
 * Trả thông điệp lỗi ĐẦU TIÊN, `null` nếu hợp lệ.
 *
 * Hàm thuần, đặt cạnh `validateLocation` cùng lý do: nó là luật của form, không phải của một
 * màn hình cụ thể — và tách ra khỏi route thì route mới còn chỗ để thở dưới trần LOC.
 *
 * Thứ tự kiểm CHÍNH LÀ thứ tự người dùng đọc form, để toast trỏ đúng ô họ vừa bỏ qua.
 */
export function validateListingDraft(draft: ListingDraft): string | null {
  if (draft.hasFailedPhoto) return '⚠️ Có ảnh tải lỗi — chạm vào ảnh đó để thử lại';
  if (draft.photoCount === 0) return '⚠️ Tin cần ít nhất 1 ảnh';
  if (draft.title.trim().length < MIN_TITLE) {
    return `⚠️ Tên món đồ cần ít nhất ${MIN_TITLE} ký tự`;
  }
  if (!draft.price.trim()) return '⚠️ Nhập giá bán — cho tặng thì ghi 0';
  if (draft.desc.trim().length < MIN_DESC) return `⚠️ Mô tả cần ít nhất ${MIN_DESC} ký tự`;
  if (!draft.categoryId) return '⚠️ Chọn danh mục cho tin trước đã';

  const missing = draft.attrFields.find((f) => f.required && isBlank(draft.attributes[f.key]));
  if (missing) return `⚠️ Nhập "${missing.label}" — danh mục này bắt buộc`;

  return validateLocation(draft.location);
}

/** Rỗng = người dùng chưa nhập. `false` và `0` là giá trị THẬT — khớp `isBlank` bên BE. */
function isBlank(value: ListingAttributes[string] | undefined): boolean {
  if (value === undefined || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}
