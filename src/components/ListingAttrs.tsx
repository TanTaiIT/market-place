import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCategoryTemplate } from '@/queries/templates';
import type { Listing, ListingAttributes, TemplateField } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Bảng thuộc tính của một tin ở màn chi tiết.
 *
 * Component riêng chứ không nội tuyến trong `app/listing/[id].tsx`: route đó đã 244/250 dòng,
 * chạm trần LOC (AGENTS §11).
 *
 * Đọc template để lấy NHÃN và nhãn-của-lựa-chọn. Tin lưu `condition: 'like_new'`; hiện thẳng
 * chuỗi đó ra là để lộ khoá kỹ thuật cho người đọc, mà "Như mới (99%)" mới là thứ họ hiểu.
 */
export function ListingAttrs({ listing }: { listing: Listing }) {
  /*
   * Ghim ĐÚNG bản template mà tin này được tạo ra với nó.
   *
   * Đọc bản mới nhất thì `rows` bên dưới — vốn lọc theo `template.fields` — sẽ NUỐT MẤT những
   * thuộc tính mà bản mới đã bỏ đi: tin vẫn giữ giá trị trong DB nhưng màn chi tiết không hiện,
   * và nhãn của các field còn lại có thể đã đổi nghĩa.
   */
  const { data: template } = useCategoryTemplate(listing.categoryId, listing.templateVersion);

  const values = listing.attributes;
  if (!values || !template) return null;

  /*
   * Đi theo thứ tự của TEMPLATE, không theo thứ tự key trong `attributes`.
   *
   * Thứ tự key của một object không có gì bảo đảm, nên lặp qua `values` sẽ cho ra bảng xếp
   * khác nhau giữa hai tin cùng danh mục.
   */
  const rows = template.fields
    .filter((f) => values[f.key] !== undefined)
    .map((f) => ({ key: f.key, label: f.label, text: display(f, values[f.key]) }));

  if (rows.length === 0) return null;

  return (
    <View style={styles.box}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** Giá trị thô → chuỗi cho người đọc: nhãn của option, "Có/Không", và hậu tố đơn vị. */
function display(field: TemplateField, value: ListingAttributes[string]): string {
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';

  const labelOf = (v: string) => field.options.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map(labelOf).join(', ');

  const text = typeof value === 'number' ? String(value) : labelOf(value);
  return field.unit ? `${text} ${field.unit}` : text;
}

const styles = StyleSheet.create({
  box: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.lineInput,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.lineInput,
  },
  label: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft, flexShrink: 0 },
  // `flex: 1` + căn phải: giá trị dài (danh sách tiện ích) xuống dòng trong cột của nó thay vì
  // đẩy nhãn ra khỏi màn hình.
  value: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, flex: 1, textAlign: 'right' },
});
