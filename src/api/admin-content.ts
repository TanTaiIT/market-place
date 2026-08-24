import {
  categoryList,
  createCategory,
  notificationCreate,
  notificationList,
  updateCategory,
} from './generated';
import type { Category as CategoryDto } from './generated';
import { relativeTime, unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Nhóm "Nội dung" của bàn quản trị: danh mục và thông báo đẩy. Cả hai là **cấu hình** — quản
 * trị đặt ra rồi cả trường chạy theo — khác hẳn hàng đợi kiểm duyệt bên `admin.ts` vốn xử từng
 * tin một. Toàn bộ đi qua SDK thật.
 *
 * Từng có thêm "luật bảng tin" + "hạn mức" ở đây, đã gỡ cùng màn `/admin/settings`: chúng là
 * fixture in-memory không có route nào phía sau, mà UI lại báo "Đã lưu cài đặt" sau mỗi lần
 * bấm. Hạn tin và trần đăng nằm cứng trong BE (`LISTING_TTL_DAYS`, `QUOTA`) và chỉ đổi được
 * bằng deploy — muốn cho chỉnh thì BE phải mở route trước.
 */

// ── TYPES ───────────────────────────────────────────────────────────

/**
 * Danh mục dưới góc nhìn quản trị: đủ `order` và `isActive`, khác `Category` trong `db.ts` vốn
 * chỉ là ba field bảng tin cần để vẽ hàng chip.
 */
export type AdminCategory = CategoryDto;

/**
 * Thứ bàn quản trị gõ ra ở form danh mục. `order` là **chuỗi thô** từ `TextInput` — đổi sang số
 * là việc của file này chứ không phải của màn hình (HARD#2), cùng lý do `price` của tin đăng
 * chuẩn hoá trong `client.ts`.
 */
export type CategoryDraft = {
  name?: string;
  icon?: string;
  order?: string;
  isActive?: boolean;
};

/**
 * Một thông báo đã gửi, đọc từ BE.
 *
 * Không còn `reach` (số người nhận): BE không đếm được và cũng không có khái niệm "gửi tới N
 * người" — thông báo là một bản ghi của tổ chức, ai thuộc phạm vi thì đọc được. Thay bằng
 * `readCount`, con số DUY NHẤT có thật về độ phủ.
 *
 * `NoticeSender` (org/chain/system) cũng bỏ: `chain` là khái niệm đã xoá khỏi hệ thống ở v2,
 * còn `system` chưa từng có endpoint nào gửi.
 */
export type SentNotice = {
  id: string;
  title: string;
  /** `null` = gửi cho cả tổ chức. */
  unitId: string | null;
  readCount: number;
  at: string;
};

/**
 * `CategoryDraft` → body BE nhận, dùng chung cho tạo và sửa.
 *
 * Ô thứ tự để trống = "không đụng tới", KHÔNG phải 0: `Number('')` ra 0 và sẽ đẩy danh mục lên
 * đầu hàng mà người sửa không hề yêu cầu. Field vắng mặt hẳn mới mang đúng nghĩa đó.
 */
function categoryBody({ name, icon, order }: CategoryDraft) {
  const rank = order?.trim() ? Number(order.trim()) : undefined;
  if (rank !== undefined && !Number.isFinite(rank)) throw new Error('Thứ tự phải là số');
  return {
    ...(name?.trim() ? { name: name.trim() } : {}),
    ...(icon !== undefined ? { icon: icon.trim() } : {}),
    ...(rank !== undefined ? { order: rank } : {}),
  };
}

// ── API ─────────────────────────────────────────────────────────────

export const adminContentApi = {
  /**
   * Từ điển danh mục dùng chung TOÀN HỆ THỐNG — không thuộc tổ chức nào, nên bàn quản trị không
   * lọc theo trường như các mục khác.
   *
   * `includeInactive` để thấy cả danh mục đã tắt: không có endpoint xoá (tin cũ vẫn tham chiếu
   * tới danh mục), nên "đã tắt" là trạng thái sống chứ không phải rác cần giấu đi.
   */
  async getCategories(): Promise<AdminCategory[]> {
    const res = await withAuthRetry(() => categoryList({ query: { includeInactive: 'true' } }));
    // Sắp theo `order` ngay tại đây: nó là thứ tự hàng băng dính trên bảng tin của học sinh, mà
    // BE không hứa trả về đã sắp — để màn tự sắp là mỗi màn một kiểu.
    // `sort` chứ không `toSorted`: Hermes chưa có change-array-by-copy, mà `lib: ESNext` của
    // expo/tsconfig.base khai là có nên `tsc` không chặn — chỉ nổ lúc chạy. Mảng đây là bản vừa
    // parse từ response, không ai khác giữ reference nên sắp tại chỗ là an toàn.
    return unwrap(res, 'Không tải được danh mục').sort((a, b) => a.order - b.order);
  },

  /**
   * Tạo danh mục (chỉ master). Không gửi `slug`: BE tự sinh từ tên, và một slug gõ tay lệch với
   * tên là thứ chỉ lộ ra nhiều tháng sau, lúc đã có tin trỏ vào nó.
   */
  async addCategory(input: CategoryDraft): Promise<AdminCategory> {
    const { name, ...rest } = categoryBody(input);
    if (!name) throw new Error('Nhập tên danh mục trước đã');
    const res = await withAuthRetry(() => createCategory({ body: { ...rest, name } }));
    return unwrap(res, 'Không tạo được danh mục');
  },

  /**
   * Sửa danh mục (chỉ master). Cũng là đường DUY NHẤT gỡ một danh mục khỏi lưu thông:
   * `isActive: false`. BE cố ý không có endpoint xoá vì tin đã đăng vẫn trỏ tới nó — xoá thật là
   * để lại một đống tin mang danh mục không còn tồn tại.
   */
  async editCategory({
    id,
    isActive,
    ...draft
  }: CategoryDraft & { id: string }): Promise<AdminCategory> {
    const res = await withAuthRetry(() =>
      updateCategory({
        path: { id },
        body: { ...categoryBody(draft), ...(isActive !== undefined ? { isActive } : {}) },
      }),
    );
    return unwrap(res, 'Không cập nhật được danh mục');
  },

  /**
   * `scope: 'managed'` — thứ người gọi GỬI ĐƯỢC TỚI, không phải thứ họ nhận được.
   *
   * Mặc định `inbox` sẽ sai ở đúng ca thường gặp nhất: quản lý cấp org không đứng trong nhóm
   * nào, nên thông báo họ vừa gửi cho một nhóm không nằm trong hộp thư của họ — panel này sẽ
   * báo gửi xong rồi hiện một danh sách không có nó.
   */
  async getNotices(): Promise<SentNotice[]> {
    const res = await withAuthRetry(() =>
      notificationList({ query: { limit: 20, scope: 'managed' } }),
    );
    return unwrap(res, 'Không tải được thông báo đã gửi').map((n) => ({
      id: n.id,
      title: n.title,
      unitId: n.unitId,
      readCount: n.readCount,
      at: relativeTime(n.createdAt),
    }));
  },

  /**
   * Gửi thông báo. `unitId` rỗng = cả tổ chức — và BE chặn nếu người gửi chỉ phụ trách một nhóm.
   *
   * Không trả "số người nhận": BE không có con số đó, và bịa ra một con số cho một hành động
   * không rút lại được là kiểu nói dối tệ nhất.
   */
  async sendNotice(input: { title: string; body: string; unitId: string | null }) {
    if (!input.title.trim() || !input.body.trim()) {
      throw new Error('Điền tiêu đề và nội dung trước khi gửi');
    }
    const res = await withAuthRetry(() =>
      notificationCreate({
        body: { title: input.title.trim(), body: input.body.trim(), unitId: input.unitId },
      }),
    );
    return unwrap(res, 'Không gửi được thông báo');
  },
};
