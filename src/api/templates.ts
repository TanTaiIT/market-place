import {
  categoryTemplateCreateDraft,
  categoryTemplatePublish,
  categoryTemplateUpdateDraft,
  defaultTemplateCreateDraft,
  defaultTemplateGet,
  defaultTemplatePublish,
  defaultTemplateUpdateDraft,
  fieldDefinitionList,
} from './generated';
import type {
  CategoryTemplate,
  FieldDefinition,
  FieldOption,
  TemplateField,
} from './generated';
import { api, unwrap } from './client';
import { withAuthRetry } from './http';

/** Màn soạn template đi qua đây, không chạm `generated` — cùng luật với các file `api/**` khác. */
export type { CategoryTemplate, FieldDefinition, FieldOption, TemplateField };

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

/**
 * Thứ đang được soạn: template của MỘT danh mục, hoặc MẪU MẶC ĐỊNH.
 *
 * Union thay vì `categoryId: string | null`: `null` sẽ phải mang hai nghĩa cùng lúc — "chưa
 * chọn gì" và "mẫu mặc định" — rồi mỗi call-site tự đoán một nghĩa. Mẫu mặc định đi đường BE
 * khác hẳn (`/default-template`, không nằm dưới `/categories/:id`) nên nhập nhằng ở đây là gọi
 * sai endpoint.
 */
export type TemplateTarget = { kind: 'category'; categoryId: string } | { kind: 'default' };

/** Hai kiểu bắt buộc phải có lựa chọn — BE chặn ở `fieldDefinitionInputSchema.superRefine`. */
const NEEDS_OPTIONS = new Set<FieldType>(['select', 'multiselect']);

/*
 * Số thứ tự cho `DraftField.uid`. Đếm lên chứ không random: `Math.random()` trong luồng
 * render là thứ style.convention §4 cấm, mà một bộ đếm thì còn tái hiện được khi đọc log.
 */
let uidSeq = 0;

/**
 * Nhận dạng một DÒNG trên form, không phải nhận dạng dữ liệu — không gửi lên BE.
 *
 * Cần nó vì `key` sinh lại theo từng ký tự người soạn gõ vào tên: lấy `key` làm React key
 * thì ô nhập bị dựng lại sau mỗi ký tự và mất tiêu điểm, còn lấy chỉ số mảng thì xoá một thẻ
 * giữa danh sách là mọi thẻ dưới nó nhận state của thẻ khác.
 */
export const nextUid = () => `f${(uidSeq += 1)}`;

/** Một dòng trong bản nháp đang soạn. Phẳng hơn payload BE vì form không nhập lồng nhau. */
export type DraftField = {
  /** Nhận dạng dòng trên form, không thuộc dữ liệu — xem `nextUid`. */
  uid: string;
  key: string;
  required: boolean;
  filterable: boolean;
  /** Nhãn hiển thị. Khác nhãn từ điển = BE nhận nó dưới dạng `override.label`. */
  label: string;
  type: FieldType;
  /**
   * Lựa chọn của kiểu select/multiselect. Mang cả `value` chứ không chỉ nhãn — xem `OptionRow`.
   * Kiểu khác thì rỗng.
   */
  options: FieldOption[];
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

/* ── KHOÁ & LỰA CHỌN ────────────────────────────────────────────────── */

/*
 * Bỏ dấu tiếng Việt bằng BẢNG, không bằng `normalize('NFD')`.
 *
 * Hermes không bảo đảm có ICU đầy đủ, mà `normalize` no-op im lặng thì "Màu sắc" ra `mus` —
 * một khoá dị dạng nằm lại trong DB VĨNH VIỄN (tin đăng lưu theo key, không đổi lại được).
 * Bảng thì không có nhánh nào chạy khác nhau giữa hai máy.
 */
const MARKED: Record<string, string> = {
  a: 'àáạảãâầấậẩẫăằắặẳẵ',
  e: 'èéẹẻẽêềếệểễ',
  i: 'ìíịỉĩ',
  o: 'òóọỏõôồốộổỗơờớợởỡ',
  u: 'ùúụủũưừứựửữ',
  y: 'ỳýỵỷỹ',
  d: 'đ',
};
const FOLD = new Map<string, string>();
for (const [ascii, marked] of Object.entries(MARKED)) {
  for (const ch of marked) FOLD.set(ch, ascii);
}

const toAscii = (text: string) =>
  Array.from(text.toLowerCase())
    .map((ch) => FOLD.get(ch) ?? ch)
    .join('');

/**
 * Nhãn người soạn gõ → `key` gửi BE.
 *
 * `key` là camelCase ASCII, 2–40 ký tự, dùng chung TOÀN HỆ THỐNG và **không đổi lại được** khi
 * đã có tin đăng trỏ vào. Vì thế màn soạn phải hiện khoá đã sinh ra cho người soạn thấy, chứ
 * không sinh âm thầm.
 *
 * `taken` để tránh 400 `Field "x" khai hai lần`: hai nhãn "Màu sắc" và "Màu Sắc" cùng ra một
 * khoá, mà BE thì từ chối cả lượt ghi.
 */
export function deriveKey(label: string, taken: readonly string[]): string {
  const words = toAscii(label)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const camel = words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  // BE đòi tối thiểu 2 ký tự và phải mở đầu bằng chữ thường: nhãn toàn ký tự lạ hoặc một chữ
  // cái vẫn phải gửi được một khoá hợp lệ, không thể để form chết ở đó.
  const base = (KEY_PATTERN.test(camel) && camel.length >= 2 ? camel : `field${camel}`).slice(0, 40);

  if (!taken.includes(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const next = `${base.slice(0, 37)}${i}`;
    if (!taken.includes(next)) return next;
  }
  return `${base.slice(0, 37)}${taken.length}`;
}

const optionValue = (label: string, taken: ReadonlySet<string>) => {
  const base =
    toAscii(label)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'opt';
  if (!taken.has(base)) return base;
  for (let i = 2; i < 200; i += 1) {
    if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
  }
  return `${base}_${taken.size}`;
};

/**
 * Một dòng lựa chọn trên form — mỗi ô nhập một dòng, thêm dòng bằng nút +.
 *
 * `value` là thứ tin đăng LƯU XUỐNG DB, `label` chỉ là chữ hiện ra. Vì thế `value` sinh ra
 * đúng MỘT lần cho mỗi dòng rồi khoá lại: người soạn sửa chính tả nhãn ("Đỏ tuơi" → "Đỏ tươi")
 * thì mọi tin cũ đang giữ value đó vẫn hợp lệ. Bản trước nhập cả chuỗi phẩy nên phải ĐOÁN
 * dòng nào là dòng cũ vừa đổi tên (khớp hai bậc theo nhãn/vị trí để đoán) — mô hình
 * dòng làm phép đoán đó thành thừa: danh tính của lựa chọn là chính cái dòng.
 *
 * `value: null` = dòng MỚI chưa chốt — lúc build payload mới sinh value từ nhãn hiện tại.
 * Không sinh sớm hơn: đang gõ dở "Đ" thì value "d" là rác, mà chưa tin nào lưu nó nên đổi
 * lúc nào cũng vô hại.
 */
export type OptionRow = { id: string; value: string | null; label: string };

export const toOptionRows = (options: readonly FieldOption[]): OptionRow[] =>
  options.map((o) => ({ id: nextUid(), value: o.value, label: o.label }));

export const emptyOptionRow = (): OptionRow => ({ id: nextUid(), value: null, label: '' });

/** Dòng → options gửi BE. Dòng trống bị bỏ (thêm rồi đổi ý), value đã khoá được giữ nguyên. */
export function rowsToOptions(rows: readonly OptionRow[]): FieldOption[] {
  const taken = new Set<string>();
  const out: FieldOption[] = [];
  for (const row of rows) {
    const label = row.label.trim();
    if (!label) continue;
    const value = row.value && !taken.has(row.value) ? row.value : optionValue(label, taken);
    taken.add(value);
    out.push({ value, label });
  }
  return out;
}
/* ── ĐỔI HÌNH ───────────────────────────────────────────────────────── */

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
      uid: nextUid(),
      key: f.key,
      required: f.required,
      filterable: f.filterable,
      label: f.label,
      type: f.type,
      options: f.options,
      isNew: !byKey.has(f.key),
      showIf: f.showIf,
      group: f.group,
    }));
}

const optionsDiffer = (a: readonly FieldOption[], b: readonly FieldOption[]) =>
  a.length !== b.length || a.some((o, i) => o.value !== b[i].value || o.label !== b[i].label);

/**
 * Phần ghi đè cho RIÊNG danh mục này — chỉ gửi thứ khác từ điển.
 *
 * Gửi thừa là ghim cứng một bản sao: sau này sửa từ điển sẽ không lan tới template nữa.
 *
 * KHÔNG bao giờ gửi `override.type`, dù schema BE cho phép: một khoá đổi kiểu là mọi tin cũ
 * đang giữ giá trị kiểu khác, và form sửa tin sẽ hiện ô rỗng hoặc 400. Chip kiểu bị khoá ở UI
 * cho field đã có trong từ điển; đây là chốt thứ hai cho cùng luật đó.
 */
function overrideOf(field: DraftField, def: FieldDefinition | undefined) {
  if (!def) return {};
  const override: { label?: string; options?: FieldOption[] } = {};
  if (field.label !== def.label) override.label = field.label;
  if (optionsDiffer(field.options, def.options)) override.options = field.options;
  return Object.keys(override).length > 0 ? { override } : {};
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
        ...overrideOf(f, def),
        // Field chưa có trong từ điển thì BE bắt buộc kèm `define` — và chính lượt gọi này tạo
        // luôn mục từ điển, nên không cần gọi `POST /field-definitions` riêng.
        ...(def
          ? {}
          : {
              define: {
                label: f.label,
                type: f.type,
                filterable: f.filterable,
                options: f.options,
              },
            }),
      };
    }),
  };
}

/**
 * Nháp → field đã ghép, CHỈ để xem trước.
 *
 * BE không có đường dựng thử một template chưa lưu, mà `AttrFields` lại đọc đúng hình
 * `TemplateField` — nên ghép tại client. Thứ tự ưu tiên giống `toTemplateDto` bên BE: giá trị
 * của template thắng, thứ template không giữ (`unit`/`min`/`max`/`placeholder`) rơi về từ điển.
 */
export function draftToResolved(
  fields: DraftField[],
  dictionary: FieldDefinition[],
): TemplateField[] {
  const byKey = new Map(dictionary.map((d) => [d.key, d]));
  return fields.map((f, i) => {
    const def = byKey.get(f.key);
    return {
      key: f.key,
      label: f.label,
      type: f.type,
      options: f.options,
      order: i * ORDER_STEP,
      required: f.required,
      filterable: f.filterable,
      ...(def?.unit ? { unit: def.unit } : {}),
      ...(def?.min != null ? { min: def.min } : {}),
      ...(def?.max != null ? { max: def.max } : {}),
      ...(def?.placeholder ? { placeholder: def.placeholder } : {}),
      ...(def?.helpText ? { helpText: def.helpText } : {}),
      ...(f.showIf ? { showIf: f.showIf } : {}),
      ...(f.group ? { group: f.group } : {}),
    };
  });
}

/** Lỗi hình dạng mà BE sẽ trả 400 — bắt trước ở client để người soạn sửa ngay tại chỗ. */
export function validateDraft(fields: DraftField[]): string | null {
  if (fields.length === 0) return 'Template phải có ít nhất một field';
  if (fields.length > MAX_FIELDS) return `Tối đa ${MAX_FIELDS} field, đang có ${fields.length}`;

  const seen = new Set<string>();
  for (const f of fields) {
    // Nhãn trước khoá: thuộc tính vừa thêm chưa có tên thì khoá của nó cũng còn rỗng, mà báo
    // "khoá rỗng" cho một ô người soạn còn chưa gõ vào là chỉ vào chỗ họ không nhìn thấy.
    if (!f.label.trim()) return 'Còn thuộc tính chưa đặt tên';
    if (!KEY_PATTERN.test(f.key)) return `Khoá "${f.key}" phải bắt đầu bằng chữ thường, không dấu`;
    if (seen.has(f.key)) return `Khoá "${f.key}" khai hai lần`;
    seen.add(f.key);
    // BE chỉ chặn ca này ở `define` (field mới). Field cũ sửa options qua `override` thì lọt
    // xuống form đăng tin thành một dropdown rỗng — không ai điền được, cũng không ai báo lỗi.
    if (NEEDS_OPTIONS.has(f.type) && f.options.length === 0) {
      return `"${f.label}" là kiểu chọn nên phải có ít nhất một lựa chọn`;
    }
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

  /**
   * Bản đang phục vụ của một mục tiêu.
   *
   * Danh mục thì đi qua `api.getCategoryTemplate` (đường đọc công khai, form đăng tin cũng dùng);
   * mẫu mặc định có endpoint riêng và master-only.
   */
  async get(target: TemplateTarget, version?: number): Promise<CategoryTemplate> {
    if (target.kind === 'category') return api.getCategoryTemplate(target.categoryId, version);
    const res = await withAuthRetry(() =>
      defaultTemplateGet({ query: version != null ? { version } : undefined }),
    );
    return unwrap(res, 'Không tải được mẫu mặc định');
  },

  async createDraft(input: {
    target: TemplateTarget;
    fields: DraftField[];
    dictionary: FieldDefinition[];
  }): Promise<CategoryTemplate> {
    const body = toPayload(input.fields, input.dictionary);
    const res = await withAuthRetry(() =>
      input.target.kind === 'category'
        ? categoryTemplateCreateDraft({ path: { id: input.target.categoryId }, body })
        : defaultTemplateCreateDraft({ body }),
    );
    return unwrap(res, 'Không tạo được bản nháp');
  },

  async updateDraft(input: {
    target: TemplateTarget;
    version: number;
    fields: DraftField[];
    dictionary: FieldDefinition[];
  }): Promise<CategoryTemplate> {
    const body = toPayload(input.fields, input.dictionary);
    const res = await withAuthRetry(() =>
      input.target.kind === 'category'
        ? categoryTemplateUpdateDraft({
            path: { id: input.target.categoryId, version: input.version },
            body,
          })
        : defaultTemplateUpdateDraft({ path: { version: input.version }, body }),
    );
    return unwrap(res, 'Không lưu được bản nháp');
  },

  /**
   * Phát hành. Sau bước này bản đó BẤT BIẾN — tin đăng ghim `templateRef.version`, sửa bản cũ
   * nghĩa là tin cũ đột nhiên mang field chưa từng tồn tại với chúng. Muốn đổi tiếp thì tạo
   * bản nháp mới.
   */
  async publish(input: {
    target: TemplateTarget;
    version: number;
  }): Promise<CategoryTemplate> {
    const res = await withAuthRetry(() =>
      input.target.kind === 'category'
        ? categoryTemplatePublish({
            path: { id: input.target.categoryId, version: input.version },
          })
        : defaultTemplatePublish({ path: { version: input.version } }),
    );
    return unwrap(res, 'Không phát hành được bản nháp');
  },
};
