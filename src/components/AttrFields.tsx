import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PickerSheet, type PickerItem } from './PickerSheet';
import { BoxField, BoxSelect, BoxSwitch } from './FormSection';
import type { ListingAttributes, TemplateField } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Render các field ĐỘNG của một danh mục, dựng từ template BE trả về.
 *
 * Form không biết trước danh mục có field nào — đó là cả điểm của hệ template. Nên chỗ này chỉ
 * ánh xạ `type` sang component, còn nhãn / lựa chọn / điều kiện hiện đều đến từ dữ liệu.
 *
 * Giữ state ở NGƯỜI GỌI (`values` + `onChange`) chứ không tự giữ: `ListingForm` cần cả bộ lúc
 * submit, mà state nằm trong này thì nó phải moi ngược ra qua ref.
 *
 * Select KHÔNG còn một kiểu duy nhất — độ rộng của tập lựa chọn quyết định hình dáng:
 * - `brand`: lưới thẻ chữ lồng (key `brand` là khoá DÙNG CHUNG của từ điển field bên BE,
 *   danh mục nào cũng gọi hãng bằng đúng key này nên nhận diện theo key là ổn định);
 * - select ít lựa chọn (≤ {@link MAX_INLINE_OPTIONS}): hàng chip bấm thẳng — chọn 1 trong 6
 *   dung lượng mà phải mở sheet rồi đóng lại là hai chạm thừa;
 * - select dài (năm sản xuất ~35 mục): giữ sheet có ô tìm, chip lúc này thành bức tường chữ.
 */

/**
 * Field này có hiện không.
 *
 * Phải khớp TỪNG DÒNG với `isFieldVisible` bên BE (`category-template.validate.ts`). Hai bên
 * lệch nhau nghĩa là form cho gửi một tin mà server trả 400, hoặc ngược lại — giấu mất một
 * field bắt buộc rồi báo lỗi ở chỗ người dùng không nhìn thấy.
 */
function isVisible(field: TemplateField, values: ListingAttributes): boolean {
  const cond = field.showIf;
  if (!cond) return true;

  const actual = values[cond.key];
  if (cond.in) return cond.in.includes(String(actual));
  // So bằng chuỗi: ô nhập trả "true"/"2020" còn điều kiện khai bằng giá trị thật.
  if (cond.eq !== undefined) return String(actual) === String(cond.eq);
  return true;
}

/**
 * Field đang hiện, đã lọc `showIf`. Export vì `ListingForm` cần đúng danh sách này lúc kiểm
 * `required` — dùng cả `fields` sẽ đòi người bán xe đạp nhập dung tích xi-lanh.
 *
 * BE đã sắp theo `order` nên ở đây chỉ lọc; sắp lại là dựng một nguồn sự thật thứ hai.
 */
export function visibleAttrFields(
  fields: TemplateField[],
  values: ListingAttributes,
): TemplateField[] {
  return fields.filter((f) => isVisible(f, values));
}

/**
 * Bỏ giá trị của field đang bị ẩn.
 *
 * Không làm bước này thì đổi "Xe máy" sang "Xe đạp" vẫn gửi kèm `engineCc` đã nhập lúc trước —
 * một chiếc xe đạp có dung tích xi-lanh. BE cũng loại nó, nhưng người dùng phải thấy nó biến
 * mất ngay, không phải sau khi bấm gửi.
 *
 * Lặp tới khi ổn định: ẩn một field có thể làm field khác (phụ thuộc vào nó) ẩn theo. Trần
 * bằng số field vì mỗi vòng loại ít nhất một key, không có đường lặp vô hạn.
 */
function pruneHidden(fields: TemplateField[], values: ListingAttributes): ListingAttributes {
  let current = values;
  for (let pass = 0; pass < fields.length; pass++) {
    const visible = new Set(fields.filter((f) => isVisible(f, current)).map((f) => f.key));
    const kept = Object.fromEntries(
      Object.entries(current).filter(([key]) => visible.has(key)),
    ) as ListingAttributes;

    if (Object.keys(kept).length === Object.keys(current).length) return kept;
    current = kept;
  }
  return current;
}

/** Danh sách năm cho `type: 'year'` — template chỉ khai `min`, cận trên luôn là năm nay. */
function yearOptions(min?: number): PickerItem<string>[] {
  const thisYear = new Date().getFullYear();
  const from = min ?? 1990;
  return Array.from({ length: thisYear - from + 1 }, (_, i) => {
    const year = String(thisYear - i);
    return { key: year, label: year };
  });
}

/** Trên mức này select rời hàng chip và quay về sheet có ô tìm. */
const MAX_INLINE_OPTIONS = 12;

export function AttrFields({
  fields,
  values,
  onChange,
}: {
  fields: TemplateField[];
  values: ListingAttributes;
  onChange: (next: ListingAttributes) => void;
}) {
  /** Field đang mở ngăn chọn. RN không có `<select>` nên mỗi lần chỉ một sheet được mở. */
  const [picking, setPicking] = useState<TemplateField | null>(null);

  const patch = (key: string, value: ListingAttributes[string] | undefined) => {
    const next = { ...values };
    if (value === undefined || value === '') delete next[key];
    else next[key] = value;
    onChange(pruneHidden(fields, next));
  };

  const visible = visibleAttrFields(fields, values);
  if (visible.length === 0) return null;

  /*
   * "Dòng máy" đợi "Hãng": hai key này đi cặp trong từ điển field của BE, và tin không hãng
   * thì dòng máy gõ gì cũng vô nghĩa. Không dùng `showIf` được — điều kiện đó ẨN hẳn field,
   * còn ở đây cần nó ĐỨNG YÊN ở dạng khoá để người điền thấy trước mình sắp phải nhập gì.
   */
  const brandPending = fields.some((f) => f.key === 'brand') && values.brand === undefined;

  return (
    <>
      {visible.map((field, i) => (
        <View key={field.key}>
          {/* Tiêu đề nhóm chỉ in ở field ĐẦU của nhóm — template gom sẵn bằng `group`. */}
          {!!field.group && field.group !== visible[i - 1]?.group && (
            <Text style={styles.group}>{field.group}</Text>
          )}
          {field.key === 'model' && brandPending ? (
            <View style={[styles.lockedBox]}>
              <Text style={styles.lockedLabel}>{field.label}</Text>
              <Text style={styles.lockedHint}>Chọn hãng trước</Text>
            </View>
          ) : (
            <AttrField
              field={field}
              value={values[field.key]}
              onChange={(v) => patch(field.key, v)}
              onOpenPicker={() => setPicking(field)}
            />
          )}
        </View>
      ))}

      {!!picking && (
        <PickerSheet
          visible
          title={picking.label}
          placeholder={`Tìm ${picking.label.toLowerCase()}...`}
          loading={false}
          value={(values[picking.key] as string | undefined) ?? null}
          search={(keyword) => searchOptions(picking, keyword)}
          emptyAll={picking.required ? undefined : 'Bỏ trống'}
          onSelect={(next) => patch(picking.key, next ?? undefined)}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

/** Lọc client-side: danh sách option của một field nhiều nhất vài chục mục, không cần hỏi BE. */
function searchOptions(field: TemplateField, keyword: string): PickerItem<string>[] {
  const all =
    field.type === 'year'
      ? yearOptions(field.min)
      : field.options.map((o) => ({ key: o.value, label: o.label }));

  const term = keyword.trim().toLowerCase();
  return term ? all.filter((o) => o.label.toLowerCase().includes(term)) : all;
}

function AttrField({
  field,
  value,
  onChange,
  onOpenPicker,
}: {
  field: TemplateField;
  value: ListingAttributes[string] | undefined;
  onChange: (next: ListingAttributes[string] | undefined) => void;
  onOpenPicker: () => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  switch (field.type) {
    case 'boolean':
      return <BoxSwitch label={label} value={value === true} onChange={onChange} />;

    case 'select': {
      // Lưới hãng đứng trước luật đếm: 9 hãng vẫn phải là lưới, không phải sheet.
      if (field.key === 'brand' && field.options.length > 0) {
        return (
          <View style={styles.fieldBlock}>
            <FieldHead field={field} />
            <BrandGrid
              field={field}
              value={value as string | undefined}
              onPick={(v) => onChange(v === value ? undefined : v)}
            />
            <HelpText text={field.helpText} />
          </View>
        );
      }

      if (field.options.length > 0 && field.options.length <= MAX_INLINE_OPTIONS) {
        return (
          <View style={styles.fieldBlock}>
            <FieldHead field={field} />
            <View style={styles.chipRow}>
              {field.options.map((o) => (
                <OptionChip
                  key={o.value}
                  label={chipLabel(o.label, field.unit)}
                  swatch={swatchOf(o.label)}
                  active={value === o.value}
                  // Chạm lại chip đang chọn là bỏ chọn — validation lúc gửi mới là chỗ đòi
                  // field bắt buộc, chip không được phép thành cửa một chiều.
                  onPress={() => onChange(value === o.value ? undefined : o.value)}
                />
              ))}
            </View>
            <HelpText text={field.helpText} />
          </View>
        );
      }

      return (
        <>
          <BoxSelect
            label={label}
            value={labelOf(field, value)}
            placeholder={field.placeholder ?? 'Chạm để chọn'}
            onPress={onOpenPicker}
          />
          <HelpText text={field.helpText} />
        </>
      );
    }

    case 'year':
      return (
        <>
          <BoxSelect
            label={label}
            value={labelOf(field, value)}
            placeholder={field.placeholder ?? 'Chạm để chọn'}
            onPress={onOpenPicker}
          />
          <HelpText text={field.helpText} />
        </>
      );

    case 'multiselect':
      return (
        <View style={styles.fieldBlock}>
          <FieldHead field={field} />
          <View style={styles.chipRow}>
            {field.options.map((o) => {
              const picked = Array.isArray(value) && value.includes(o.value);
              return (
                <OptionChip
                  key={o.value}
                  label={chipLabel(o.label, field.unit)}
                  swatch={swatchOf(o.label)}
                  active={picked}
                  onPress={() => onChange(toggle(value, o.value))}
                />
              );
            })}
          </View>
          <HelpText text={field.helpText} />
        </View>
      );

    case 'textarea':
      return (
        <>
          <BoxField
            label={label}
            value={value === undefined ? '' : String(value)}
            onChangeText={onChange}
            placeholder={field.placeholder}
            multiline
            style={styles.textarea}
          />
          <HelpText text={field.helpText} />
        </>
      );

    // `number` và `year` cùng lưu số, nhưng `year` đã rẽ sang dropdown ở trên.
    case 'number':
      return (
        <>
          <BoxField
            label={label}
            value={value === undefined ? '' : String(value)}
            // Giữ CHUỖI trong ô nhập; BE ép sang số. Ép ở đây thì gõ dở "1" của "15000"
            // sẽ nhảy về 1 ngay dưới ngón tay.
            //
            // Lượt thứ hai giữ đúng MỘT dấu chấm — bỏ mọi dấu còn dấu khác đứng sau. Để
            // lọt "1.2.3" thì BE nhận `Number()` ra NaN và trả 400 cho chính ô vừa gõ.
            // Lookahead chứ không lookbehind: Hermes không bảo đảm có lookbehind.
            onChangeText={(text) =>
              onChange(text.replace(/[^\d.]/g, '').replace(/\.(?=.*\.)/g, ''))
            }
            placeholder={field.placeholder ?? '0'}
            keyboardType="number-pad"
            // Đơn vị đứng TRONG thẻ, cạnh con số — bản cũ treo nó lơ lửng ngoài ô nhập.
            suffix={field.unit}
          />
          <HelpText text={field.helpText} />
        </>
      );

    default:
      return (
        <>
          <BoxField
            label={label}
            value={value === undefined ? '' : String(value)}
            onChangeText={onChange}
            placeholder={field.placeholder}
          />
          <HelpText text={field.helpText} />
        </>
      );
  }
}

/**
 * Nhãn đứng NGOÀI hàng chip (khác `BoxField` giữ nhãn trong thẻ): chip tự mang hình hài riêng,
 * bọc thêm một lớp thẻ nữa là hộp trong hộp. Field không bắt buộc nói thẳng "không bắt buộc"
 * thay vì bắt người điền suy ngược từ việc thiếu dấu sao.
 */
function FieldHead({ field }: { field: TemplateField }) {
  return (
    <View style={styles.headRow}>
      <Text style={styles.headLabel}>{field.label}</Text>
      {field.required ? (
        <Text style={styles.headStar}>*</Text>
      ) : (
        <Text style={styles.headOptional}>không bắt buộc</Text>
      )}
    </View>
  );
}

const HelpText = ({ text }: { text?: string }) =>
  text ? <Text style={styles.help}>{text}</Text> : null;

/* ------------------------------- chips ------------------------------- */

/**
 * Chấm màu trước nhãn chip, tra theo NHÃN đã chuẩn hoá. Chỉ là trang trí nhận diện nhanh —
 * nhãn lạ không có trong bảng thì chip vẫn đứng bình thường, không chấm.
 */
const SWATCH: Record<string, string> = {
  đen: '#1B1B1F',
  trắng: '#F5F5F3',
  bạc: '#C9CDD3',
  vàng: '#E7C566',
  hồng: '#F0A8C0',
  đỏ: '#C43D3D',
  tím: '#8E7CD8',
  xám: '#6F757D',
  nâu: '#8B6539',
  be: '#E3D5BE',
  cam: '#E58A3A',
  'xanh dương': '#3D6FD6',
  'xanh lá': '#3F7D52',
  'xanh rêu': '#5F6E4E',
  'titan tự nhiên': '#B7AC9F',
  'titan sa mạc': '#C9AE8B',
  'titan đen': '#3E3F42',
  'titan trắng': '#E8E6E1',
};

const swatchOf = (label: string): string | undefined => SWATCH[label.trim().toLowerCase()];

/** "128" + unit GB → "128 GB"; mốc từ 1024 GB đổi sang TB cho khớp cách người bán nói. */
function chipLabel(label: string, unit?: string): string {
  if (!unit) return label;
  const n = Number(label);
  if (!Number.isFinite(n)) return `${label} ${unit}`;
  if (unit === 'GB' && n >= 1024) return `${n / 1024} TB`;
  return `${label} ${unit}`;
}

function OptionChip({
  label,
  swatch,
  active,
  onPress,
}: {
  label: string;
  swatch?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      {!!swatch && <View style={[styles.dot, { backgroundColor: swatch }]} />}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/* ----------------------------- brand grid ----------------------------- */

/**
 * Chữ lồng thay logo: bộ hãng nằm trong DATA (template đổi được từ bàn quản trị), nên không có
 * bộ icon tĩnh nào theo kịp — chữ cái đầu thì hãng nào cũng tự có.
 */
function monogram(label: string): string {
  const clean = label.trim();
  if (/khác$/i.test(clean)) return '…';
  return clean.charAt(0).toUpperCase();
}

function BrandGrid({
  field,
  value,
  onPick,
}: {
  field: TemplateField;
  value: string | undefined;
  onPick: (next: string) => void;
}) {
  return (
    <View style={styles.brandGrid}>
      {field.options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onPick(o.value)}
            style={[styles.brandCell, active && styles.brandCellOn]}
          >
            <Text style={[styles.brandMark, active && styles.brandMarkOn]}>
              {monogram(o.label)}
            </Text>
            <Text numberOfLines={1} style={[styles.brandName, active && styles.brandNameOn]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------- helpers ------------------------------- */

/** Nhãn hiển thị của giá trị đang chọn — `value` thô (`like_new`) không phải thứ cho người đọc. */
function labelOf(field: TemplateField, value: ListingAttributes[string] | undefined) {
  if (value === undefined) return undefined;
  return field.options.find((o) => o.value === value)?.label ?? String(value);
}

function toggle(current: ListingAttributes[string] | undefined, option: string): string[] {
  const list = Array.isArray(current) ? current : [];
  return list.includes(option) ? list.filter((v) => v !== option) : [...list, option];
}

const styles = StyleSheet.create({
  group: {
    fontFamily: F.uiBlack,
    fontSize: 14,
    color: C.ink,
    marginTop: 22,
    marginBottom: 12,
  },
  // Kéo sát vào thẻ phía trên (thẻ có `marginBottom: 10`) để câu gợi ý đọc là "của ô đó".
  help: { fontFamily: F.ui, fontSize: 11.5, color: C.muted, marginTop: 6 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },

  fieldBlock: { marginBottom: 16 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 9 },
  headLabel: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink },
  headStar: { fontFamily: F.uiBold, fontSize: 13.5, color: C.danger },
  headOptional: { fontFamily: F.ui, fontSize: 11.5, color: C.muted, marginLeft: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipOn: { borderColor: C.brandTx, backgroundColor: C.brandLt },
  chipText: { fontFamily: F.uiBold, fontSize: 13, color: C.ink },
  chipTextOn: { color: C.brandTx },
  // Viền mờ để chấm "Trắng"/"Bạc" không tan vào nền chip.
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: C.line },

  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandCell: {
    // 3 cột trên khổ điện thoại — `flexBasis` theo % để không phải đo màn hình.
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 3,
  },
  brandCellOn: { borderColor: C.brandTx, backgroundColor: C.brandLt },
  brandMark: { fontFamily: F.uiBlack, fontSize: 17, color: C.ink },
  brandMarkOn: { color: C.brandTx },
  brandName: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft },
  brandNameOn: { color: C.brandTx },

  lockedBox: {
    backgroundColor: C.sand,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 12,
    marginBottom: 10,
  },
  lockedLabel: { fontFamily: F.ui, fontSize: 11, color: C.inkSoft },
  lockedHint: { fontFamily: F.uiBold, fontSize: 15, color: C.muted, marginTop: 7 },
});
