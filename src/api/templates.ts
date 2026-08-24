import {
  categoryTemplateCreateDraft,
  categoryTemplatePublish,
  categoryTemplateUpdateDraft,
  fieldDefinitionList,
} from './generated';
import type { CategoryTemplate, FieldDefinition, TemplateField } from './generated';
import { unwrap } from './client';
import { withAuthRetry } from './http';

/** Màn soạn template đi qua đây, không chạm `generated` — cùng luật với các file `api/**` khác. */
export type { CategoryTemplate, FieldDefinition, TemplateField };

/**
 * Soạn template thuộc tính của danh mục. Tách khỏi `client.ts` (đã sát trần LOC) và khỏi
 * `admin-content.ts` (đó là danh mục + thông báo, hai vòng đời khác hẳn).
 *
 * Chỉ master chạm được — cùng cửa với màn Danh mục, vì template là từ điển toàn hệ thống.
 */

/** Bậc thang `order` của BE: cách nhau 10 để chèn field vào giữa mà không phải đánh số lại. */
export const ORDER_STEP = 10;

/** Trần BE ép: mỗi field lọc là một nhánh index quét trên mọi tin của danh mục. */
export const MAX_FILTERABLE = 8;

/** BE nhận 1–40 field một template. */
export const MAX_FIELDS = 40;

/** `^[a-z][a-zA-Z0-9]*$` của BE — chặn ở form để người soạn biết ngay, không đợi 400. */
export const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export type FieldType = FieldDefinition['type'];

/** Một dòng trong bản nháp đang soạn. Phẳng hơn payload BE vì form không nhập lồng nhau. */
export type DraftField = {
  key: string;
  required: boolean;
  filterable: boolean;
  /** Nhãn hiển thị. Khác nhãn từ điển = BE nhận nó dưới dạng `override.label`. */
  label: string;
  type: FieldType;
  /** Có trong từ điển rồi hay là field mới toanh — quyết định có gửi `define` hay không. */
  isNew: boolean;
  /**
   * Hai thứ form KHÔNG sửa nhưng phải mang theo nguyên vẹn khi lưu lại.
   *
   * Bỏ chúng đi thì mỗi lần bấm Lưu là một lần âm thầm xoá điều kiện hiện/ẩn và nhóm của bản
   * nháp — mất dữ liệu mà không có thông báo nào.
   */
  showIf?: TemplateField['showIf'];
  group?: string;
};

/**
 * Template đã ghép (thứ BE trả) → bản nháp sửa được.
 *
 * `GET` trả về bản ĐÃ TRỘN template với từ điển, nên nhìn vào đó không biết `label` là của từ
 * điển hay là một `override`. Gửi lại mà bỏ `override` thì field lặng lẽ quay về nhãn từ điển.
 * Dựng lại bằng cách so với chính từ điển: khác nghĩa là có override.
 */
export function toDraft(fields: TemplateField[], dictionary: FieldDefinition[]): DraftField[] {
  const byKey = new Map(dictionary.map((d) => [d.key, d]));
  return [...fields]
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      key: f.key,
      required: f.required,
      filterable: f.filterable,
      label: f.label,
      type: f.type,
      isNew: !byKey.has(f.key),
      showIf: f.showIf,
      group: f.group,
    }));
}

/**
 * Bản nháp → payload BE. `order` đánh lại theo VỊ TRÍ trong mảng, không giữ số cũ: người soạn
 * kéo thả theo thứ tự nhìn thấy, mà BE thì từ chối hai field trùng `order`.
 */
function toPayload(fields: DraftField[], dictionary: FieldDefinition[]) {
  const byKey = new Map(dictionary.map((d) => [d.key, d]));
  return {
    fields: fields.map((f, i) => {
      const def = byKey.get(f.key);
      return {
        key: f.key,
        order: i * ORDER_STEP,
        required: f.required,
        filterable: f.filterable,
        ...(f.showIf ? { showIf: f.showIf } : {}),
        ...(f.group ? { group: f.group } : {}),
        // Nhãn trùng từ điển thì KHÔNG gửi override: gửi thừa là ghim cứng một bản sao, sau này
        // sửa từ điển sẽ không lan tới template nữa.
        ...(def && f.label !== def.label ? { override: { label: f.label } } : {}),
        // Field chưa có trong từ điển thì BE bắt buộc kèm `define` — và chính lượt gọi này tạo
        // luôn mục từ điển, nên không cần gọi `POST /field-definitions` riêng.
        ...(def ? {} : { define: { label: f.label, type: f.type, filterable: f.filterable } }),
      };
    }),
  };
}

/** Lỗi hình dạng mà BE sẽ trả 400 — bắt trước ở client để người soạn sửa ngay tại chỗ. */
export function validateDraft(fields: DraftField[]): string | null {
  if (fields.length === 0) return 'Template phải có ít nhất một field';
  if (fields.length > MAX_FIELDS) return `Tối đa ${MAX_FIELDS} field, đang có ${fields.length}`;

  const seen = new Set<string>();
  for (const f of fields) {
    if (!KEY_PATTERN.test(f.key)) return `Khoá "${f.key}" phải bắt đầu bằng chữ thường, không dấu`;
    if (seen.has(f.key)) return `Khoá "${f.key}" khai hai lần`;
    seen.add(f.key);
    if (!f.label.trim()) return `Field "${f.key}" chưa có nhãn`;
  }

  // `showIf` trỏ ra ngoài template = field không bao giờ hiện. BE chặn, nhưng lỗi ở đây đọc
  // được hơn vì người soạn đang nhìn đúng danh sách gây ra nó.
  for (const f of fields) {
    if (f.showIf && !seen.has(f.showIf.key)) {
      return `"${f.label}" phụ thuộc khoá "${f.showIf.key}" không có trong template`;
    }
  }

  const filterable = fields.filter((f) => f.filterable).length;
  if (filterable > MAX_FILTERABLE) {
    return `${filterable} field mở lọc, tối đa ${MAX_FILTERABLE}`;
  }
  return null;
}

export const templateApi = {
  /** Từ điển field dùng chung — nguồn để chọn field có sẵn thay vì gõ lại định nghĩa. */
  async definitions(): Promise<FieldDefinition[]> {
    const res = await withAuthRetry(() => fieldDefinitionList());
    return unwrap(res, 'Không tải được từ điển field');
  },

  async createDraft(input: {
    categoryId: string;
    fields: DraftField[];
    dictionary: FieldDefinition[];
  }): Promise<CategoryTemplate> {
    const res = await withAuthRetry(() =>
      categoryTemplateCreateDraft({
        path: { id: input.categoryId },
        body: toPayload(input.fields, input.dictionary),
      }),
    );
    return unwrap(res, 'Không tạo được bản nháp');
  },

  async updateDraft(input: {
    categoryId: string;
    version: number;
    fields: DraftField[];
    dictionary: FieldDefinition[];
  }): Promise<CategoryTemplate> {
    const res = await withAuthRetry(() =>
      categoryTemplateUpdateDraft({
        path: { id: input.categoryId, version: input.version },
        body: toPayload(input.fields, input.dictionary),
      }),
    );
    return unwrap(res, 'Không lưu được bản nháp');
  },

  /**
   * Phát hành. Sau bước này bản đó BẤT BIẾN — tin đăng ghim `templateRef.version`, sửa bản cũ
   * nghĩa là tin cũ đột nhiên mang field chưa từng tồn tại với chúng. Muốn đổi tiếp thì tạo
   * bản nháp mới.
   */
  async publish(input: { categoryId: string; version: number }): Promise<CategoryTemplate> {
    const res = await withAuthRetry(() =>
      categoryTemplatePublish({ path: { id: input.categoryId, version: input.version } }),
    );
    return unwrap(res, 'Không phát hành được bản nháp');
  },
};
