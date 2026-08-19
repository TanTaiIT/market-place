import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PickerSheet } from './PickerSheet';
import type { ListingAttrFilter, TemplateField } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Bộ lọc theo thuộc tính động, dựng từ template của danh mục đang chọn.
 *
 * Chọn MỘT giá trị mỗi field, không chọn nhiều: "Honda hoặc Yamaha" nghe hợp lý nhưng trong
 * thực tế người tìm thu hẹp dần từng bước, và chip chọn-nhiều làm mỗi field cao thêm vài dòng —
 * bộ lọc Xe cộ đã dài sẵn. BE vẫn nhận mảng (`$in`), chỉ là giao diện không sinh ra nó nữa.
 *
 * Field nhiều lựa chọn (`select`/`year`) đi qua `PickerSheet` thay vì trải chip: `propertyType`
 * có 10 lựa chọn, `deviceType` 12 — trải ra là đẩy kết quả tìm kiếm xuống hết màn hình. Một
 * dòng mở ngăn chọn cũng là đúng cách màn này đã chọn danh mục và tỉnh.
 *
 * Chỉ nhận field đã `filterable` — người gọi lọc trước. BE chặn lần nữa (400 với key không mở
 * lọc), nên đây chỉ là lớp giao diện, không phải lớp bảo vệ.
 */
export function AttrFilters({
  fields,
  value,
  onChange,
}: {
  fields: TemplateField[];
  value: ListingAttrFilter;
  onChange: (next: ListingAttrFilter) => void;
}) {
  /** Field đang mở ngăn chọn. Một `key` chứ không phải boolean: cả danh sách dùng chung một sheet. */
  const [picking, setPicking] = useState<TemplateField | null>(null);

  /** Bỏ hẳn khoá khi không còn ràng buộc — `attrs` rỗng phải là object rỗng, không phải khoá `undefined`. */
  const set = (key: string, next: ListingAttrFilter[string] | undefined) => {
    const draft = { ...value };
    if (next === undefined) delete draft[key];
    else draft[key] = next;
    onChange(draft);
  };

  return (
    <>
      {picking && (
        <PickerSheet
          visible
          title={picking.label}
          placeholder={`Tìm ${picking.label.toLowerCase()}...`}
          search={(kw) =>
            optionsOf(picking)
              .filter((o) => o.label.toLowerCase().includes(kw.trim().toLowerCase()))
              .map((o) => ({ key: o.value, label: o.label }))
          }
          loading={false}
          value={typeof value[picking.key] === 'string' ? (value[picking.key] as string) : null}
          emptyAll="Tất cả"
          onSelect={(v) => set(picking.key, v ?? undefined)}
          onClose={() => setPicking(null)}
        />
      )}

      {fields.map((field) => (
        <View key={field.key} style={styles.group}>
          <Text style={styles.label}>
            {field.label}
            {!!field.unit && <Text style={styles.unit}> ({field.unit})</Text>}
          </Text>

          {field.type === 'number' ? (
            <RangeRow value={value[field.key]} onChange={(v) => set(field.key, v)} />
          ) : field.type === 'boolean' ? (
            <View style={styles.chips}>
              <Chip
                label="Có"
                on={value[field.key] === true}
                onPress={() => set(field.key, value[field.key] === true ? undefined : true)}
              />
            </View>
          ) : optionsOf(field).length > 0 || field.type === 'year' ? (
            <Pressable
              onPress={() => setPicking(field)}
              style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.triggerText, !value[field.key] && styles.triggerEmpty]}>
                {labelOf(field, value[field.key]) ?? 'Tất cả'}
              </Text>
              <Text style={styles.caret}>⌄</Text>
            </Pressable>
          ) : (
            <TextInput
              value={typeof value[field.key] === 'string' ? (value[field.key] as string) : ''}
              onChangeText={(t) => set(field.key, t.trim() ? t : undefined)}
              placeholder={field.placeholder ?? 'Nhập để lọc chính xác'}
              placeholderTextColor={C.muted}
              style={styles.input}
            />
          )}
        </View>
      ))}
    </>
  );
}

/** `year` không có `options` trong template — dựng danh sách năm từ `min` tới năm nay. */
function optionsOf(field: TemplateField): { value: string; label: string }[] {
  if (field.type !== 'year') return field.options;
  const now = new Date().getFullYear();
  const from = field.min ?? 1990;
  return Array.from({ length: now - from + 1 }, (_, i) => {
    const y = String(now - i);
    return { value: y, label: y };
  });
}

function labelOf(field: TemplateField, v: ListingAttrFilter[string] | undefined) {
  if (typeof v !== 'string') return undefined;
  return optionsOf(field).find((o) => o.value === v)?.label ?? v;
}

function RangeRow({
  value,
  onChange,
}: {
  value: ListingAttrFilter[string] | undefined;
  onChange: (next: ListingAttrFilter[string] | undefined) => void;
}) {
  const range = typeof value === 'object' && !Array.isArray(value) ? value : {};

  // Xoá cả hai đầu thì bỏ hẳn ràng buộc: `{}` gửi lên sẽ bị BE từ chối (phải có gte hoặc lte).
  const put = (side: 'gte' | 'lte', n: number | null) => {
    const next = { ...range, [side]: n ?? undefined };
    onChange(next.gte === undefined && next.lte === undefined ? undefined : next);
  };

  return (
    <View style={styles.range}>
      <NumInput label="Từ" value={range.gte} onChange={(n) => put('gte', n)} />
      <Text style={styles.dash}>—</Text>
      <NumInput label="Đến" value={range.lte} onChange={(n) => put('lte', n)} />
    </View>
  );
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | null) => void;
}) {
  return (
    <TextInput
      value={value === undefined ? '' : String(value)}
      // Chỉ giữ chữ số, cùng lý do với ô giá: bàn phím `numeric` của iOS vẫn có dấu phân cách,
      // mà BE khai `gte`/`lte` là number nên một dấu phẩy lọt xuống là 400 cho cả lượt tìm.
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, '');
        onChange(digits ? Number(digits) : null);
      }}
      placeholder={label}
      placeholderTextColor={C.muted}
      keyboardType="numeric"
      style={[styles.input, styles.num]}
    />
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, on && { color: C.paperWarm }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 14 },
  label: {
    fontFamily: F.uiBold,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
    marginBottom: 7,
  },
  unit: { fontFamily: F.ui, textTransform: 'none', letterSpacing: 0 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: { fontFamily: F.uiSemi, fontSize: 13, color: C.ink },
  triggerEmpty: { fontFamily: F.ui, color: C.inkSoft },
  caret: { fontSize: 13, color: C.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: C.moss, borderColor: C.moss },
  chipText: { fontFamily: F.ui, fontSize: 12, color: C.ink },
  range: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  input: {
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: F.mono,
    fontSize: 12.5,
    color: C.ink,
  },
  num: { flex: 1 },
});
