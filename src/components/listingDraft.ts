import { locationGap, type ListingLocation } from './LocationFields';
import type { Listing, ListingAttributes, TemplateField } from '@/api/db';
import type { ListingReach } from './ListingReach';

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
  /** Đã chọn bậc trong nhóm mà chưa chỉ ra nhóm nào — `routeListing` bên BE từ chối tổ hợp đó. */
  needsGroup: boolean;
  /**
   * Khu vực đã ĐÓNG BĂNG (form sửa) — thôi đòi tỉnh/phường.
   *
   * Không có cờ này thì form sửa thành ngõ cụt với tin TRONG NHÓM: bậc `members`/`group_open`
   * được phép không có tỉnh (`resolveProvinceCode` trả `null` cho chúng), nên `locationGap` báo
   * "Chọn tỉnh / thành" trong khi ô chọn đã bị khoá — người dùng không có đường nào làm nó im.
   *
   * Và đòi cũng vô nghĩa: lúc này khu vực thuộc về server, người sửa tin không đặt được nó.
   */
  areaLocked: boolean;
};


/*
 * Hình dạng dữ liệu của form, và phép ánh xạ từ một tin đã lưu sang nó.
 *
 * Ở đây chứ không trong `ListingForm.tsx` vì cả hai là LUẬT THUẦN của form, không phải giao
 * diện — cùng lý do `listingDraftGaps` nằm ở file này. Và `ListingForm` đã quá trần LOC, nên
 * mọi thứ không phải JSX đều nên rời khỏi đó trước.
 */
export type ListingFormValues = {
  title: string;
  /** Chuỗi thô từ `TextInput`; đổi sang số là việc của `client.ts`, không phải của form. */
  price: string;
  desc: string;
  categoryId: string;
  /** Người bán nhận giao tận nơi — lời hứa của họ, sửa được sau khi đăng. */
  canDeliver: boolean;
  /** Bậc phủ sóng + nhóm đích. Chỉ có nghĩa lúc TẠO — BE không cho sửa cả hai sau khi đăng. */
  reach: ListingReach;
  orgId: string | null;
  location: ListingLocation;
  /** Thuộc tính động theo template của danh mục — rỗng khi danh mục chưa có field nào. */
  attributes: ListingAttributes;
  /**
   * Bản template của tin đang sửa. Chỉ form SỬA mới có — tin mới luôn dùng bản mới nhất.
   * Không gửi lên BE; nó chỉ quyết định form hỏi template nào.
   */
  templateVersion?: number;
};

/**
 * Tin đã lưu → giá trị điền sẵn cho form sửa.
 *
 * Đọc `priceValue` chứ không phải `price`: bản hiển thị đã qua `formatPrice`, và "Miễn phí"
 * thì không còn đường nào quay về `0`.
 */
export function listingToFormValues(listing: Listing): ListingFormValues {
  return {
    title: listing.title,
    price: String(listing.priceValue),
    desc: listing.desc,
    categoryId: listing.categoryId,
    canDeliver: listing.canDeliver,
    reach: listing.reach,
    orgId: null,
    attributes: listing.attributes ?? {},
    templateVersion: listing.templateVersion,
    location: {
      province: listing.province ?? null,
      ward: listing.ward ?? null,
      address: listing.address ?? '',
    },
  };
}

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

  if (draft.needsGroup) {
    gaps.push({ label: 'nhóm', message: '⚠️ Chọn nhóm sẽ đăng vào, hoặc chuyển sang đăng lên sàn' });
  }

  if (!draft.areaLocked) {
    const where = locationGap(draft.location);
    if (where) gaps.push(where);
  }

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
