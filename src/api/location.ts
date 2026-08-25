import type { Province } from './generated';

/**
 * Địa giới hành chính 2 cấp (Tỉnh → Phường/Xã) sau 01/07/2025. Dữ liệu do BE giữ, app chỉ tải
 * về — trước đây bảng này nằm luôn trong bundle, nhưng nhét 3.321 xã vào app rồi mỗi lần địa
 * giới đổi lại phải phát hành bản mới là cách bảo trì tệ nhất trong các lựa chọn.
 *
 * File này chỉ còn phần LỌC, cố tình chạy ở client: danh sách đã nằm sẵn trong bộ nhớ sau lần
 * tải đầu, gọi API mỗi lần gõ phím là tự tạo độ trễ cho một việc mà máy làm được ngay.
 */

export type { Province };

/** Tên tỉnh hợp lệ. Dùng kiểu này thay `string` ở mọi state/prop giữ tỉnh — gõ sai là lỗi biên dịch. */
export type ProvinceName = Province['name'];

/** Dấu phụ tổ hợp mà NFD tách ra được. Viết bằng \u để source không chứa ký tự vô hình. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Bỏ dấu về ASCII để "ha noi" khớp "Hà Nội". `đ` phải xử riêng: nó không phải `d` + dấu phụ
 * nên NFD không tách ra được, thiếu dòng đó thì gõ "da nang" không ra "Đà Nẵng".
 */
export function normalizeVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Lọc tỉnh theo tên mới, tên đầy đủ, tên tỉnh cũ và tên gọi tắt. `formerNames`/`aliases` là lý
 * do chính phải tự lọc thay vì so mỗi `name`: người dùng còn gõ "Bình Dương" hay "Sài Gòn"
 * nhiều năm nữa, thiếu nó thì họ kết luận app không có tỉnh của mình.
 */
export function filterProvinces(
  provinces: readonly Province[],
  keyword: string,
): readonly Province[] {
  const term = normalizeVi(keyword);
  if (!term) return provinces;

  return provinces.filter((p) =>
    [p.name, p.fullName, ...p.formerNames, ...p.aliases].some((label) =>
      normalizeVi(label).includes(term),
    ),
  );
}

export function filterWards(wards: readonly string[], keyword: string): readonly string[] {
  const term = normalizeVi(keyword);
  if (!term) return wards;
  return wards.filter((w) => normalizeVi(w).includes(term));
}

/** Chú thích "gồm ..." dưới tên tỉnh. Chỉ dùng `formerNames` — `aliases` không phải tỉnh cũ. */
export function mergedFromLabel(province: Province): string | undefined {
  return province.formerNames.length > 0 ? `gồm ${province.formerNames.join(', ')}` : undefined;
}
