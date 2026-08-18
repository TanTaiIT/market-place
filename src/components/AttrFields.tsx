import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PickerSheet, type PickerItem } from './PickerSheet';
import { CatTape, Field } from './ui';
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

  return (
    <>
      {visible.map((field, i) => (
        <View key={field.key}>
          {/* Tiêu đề nhóm chỉ in ở field ĐẦU của nhóm — template gom sẵn bằng `group`. */}
          {!!field.group && field.group !== visible[i - 1]?.group && (
            <Text style={styles.group}>{field.group}</Text>
          )}
          <AttrField
            field={field}
            value={values[field.key]}
            onChange={(v) => patch(field.key, v)}
            onOpenPicker={() => setPicking(field)}
          />
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
      return (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{label}</Text>
          <Switch
            value={value === true}
            onValueChange={onChange}
            trackColor={{ true: C.pin, false: C.lineInput }}
          />
        </View>
      );

    case 'select':
    case 'year':
      return (
        <>
          <Text style={styles.label}>{label}</Text>
          <Pressable onPress={onOpenPicker} style={styles.select}>
            <Text style={[styles.selectText, value === undefined && { color: C.muted }]}>
              {labelOf(field, value) ?? field.placeholder ?? 'Chọn...'}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
          <HelpText text={field.helpText} />
        </>
      );

    case 'multiselect':
      return (
        <>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.chipRow}>
            {field.options.map((o) => {
              const picked = Array.isArray(value) && value.includes(o.value);
              return (
                <CatTape
                  key={o.value}
                  label={o.label}
                  active={picked}
                  onPress={() => onChange(toggle(value, o.value))}
                />
              );
            })}
          </View>
          <HelpText text={field.helpText} />
        </>
      );

    case 'textarea':
      return (
        <>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            value={value === undefined ? '' : String(value)}
            onChangeText={onChange}
            placeholder={field.placeholder}
            placeholderTextColor={C.muted}
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
          <View style={styles.numberRow}>
            <View style={{ flex: 1 }}>
              <Field
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
              />
            </View>
            {!!field.unit && <Text style={styles.unit}>{field.unit}</Text>}
          </View>
          <HelpText text={field.helpText} />
        </>
      );

    default:
      return (
        <>
          <Field
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

const HelpText = ({ text }: { text?: string }) =>
  text ? <Text style={styles.help}>{text}</Text> : null;

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
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: C.inkSoft,
    marginBottom: 6,
  },
  group: {
    fontFamily: F.uiBlack,
    fontSize: 12.5,
    color: C.ink,
    marginTop: 20,
    marginBottom: 10,
  },
  help: { fontFamily: F.ui, fontSize: 11.5, color: C.muted, marginTop: -12, marginBottom: 16 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    paddingVertical: 9,
    marginBottom: 18,
  },
  selectText: { fontFamily: F.ui, fontSize: 15, color: C.ink },
  chevron: { fontFamily: F.ui, fontSize: 13, color: C.muted },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  switchLabel: { fontFamily: F.uiBold, fontSize: 13, color: C.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  unit: { fontFamily: F.monoBold, fontSize: 13, color: C.pin, marginBottom: 22 },
  textarea: {
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    minHeight: 64,
    textAlignVertical: 'top',
    fontFamily: F.ui,
    fontSize: 15,
    lineHeight: 24,
    color: C.ink,
    paddingVertical: 6,
    marginBottom: 18,
  },
});
