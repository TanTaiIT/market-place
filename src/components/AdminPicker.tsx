import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PickerSheet, type PickerItem, type PickerSearch } from './PickerSheet';
import { C, F } from '@/theme';

/**
 * Ô chọn một-trong-nhiều cho bàn quản trị nền tối.
 *
 * `LocationPicker` đã có ô tương đương nhưng nhuộm theo nền giấy sáng và đóng cứng vào tỉnh/xã;
 * ở đây danh sách là thành viên, nhóm con hay danh mục — cùng một hình thức, khác nguồn dữ liệu.
 * Phần sheet vẫn là `PickerSheet` dùng chung, component này chỉ lo cái nút bấm mở nó ra.
 *
 * Lọc mặc định là so chuỗi thường trên nhãn; truyền `search` khi cần luật riêng (tên tỉnh cũ,
 * bỏ dấu) — đúng chỗ `filterProvinces` đang làm.
 */
/** Mảng rỗng dùng chung: literal `[]` ngay trong default prop đổi tham chiếu mỗi lần render. */
const NO_ITEMS = [] as const;

export function AdminPickerField<T extends string>({
  label,
  title,
  placeholder,
  items = NO_ITEMS,
  search,
  loading,
  value,
  emptyLabel,
  onChange,
}: {
  label: string;
  title: string;
  placeholder: string;
  items?: readonly PickerItem<T>[];
  search?: PickerSearch<T>;
  loading?: boolean;
  value: T | null;
  /** Nhãn cho dòng bỏ chọn. Không truyền = bắt buộc chọn một mục. */
  emptyLabel?: string;
  onChange: (value: T | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const byLabel = useCallback<PickerSearch<T>>(
    (keyword) => {
      const term = keyword.trim().toLowerCase();
      return term ? items.filter((i) => i.label.toLowerCase().includes(term)) : items;
    },
    [items],
  );

  const selected = items.find((i) => i.key === value);

  return (
    <View style={styles.field}>
      {/* Nhãn rỗng = ô đứng ngay dưới một nhãn khác (vd nút "thêm tỉnh" dưới danh sách tỉnh);
          vẫn dựng `Text` thì chỗ đó ăn thêm một khoảng trống không giải thích được. */}
      {!!label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
      >
        <Text
          numberOfLines={1}
          style={[styles.triggerText, !selected && { color: C.deskTxtDim }]}
        >
          {/* Giá trị đã chọn mà không tra được nhãn thì hiện chính khoá: danh sách có thể vừa
              đổi (nhóm con bị xoá), và một ô trống trơn khiến người dùng tưởng mình chưa chọn. */}
          {selected?.label ?? (value || placeholder)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <PickerSheet
        visible={open}
        title={title}
        placeholder={placeholder}
        search={search ?? byLabel}
        loading={Boolean(loading)}
        value={value}
        emptyAll={emptyLabel}
        onSelect={(next) => {
          onChange(next);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** Nút phụ trên thẻ của bàn quản trị — "Sửa", "Xoá", "Khoá", "Đổi slug". */
export function AdminSmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.small, pressed && { opacity: 0.7 }]}
    >
      <Text style={adminFormStyles.smallText}>{label}</Text>
    </Pressable>
  );
}

/** Viên chọn nhỏ trên nền desk — dùng cho vai trò, phạm vi, loại tổ chức. */
export function AdminChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, on && { color: C.paper }]}>{label}</Text>
    </Pressable>
  );
}

export const adminFormStyles = StyleSheet.create({
  label: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: C.deskTxtDim,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.deskTxtDim, marginTop: 8 },

  /* Bộ dùng chung cho panel thêm/sửa của mọi màn quản trị — trước đó copy nguyên khối ở 3 route. */
  smallText: { fontFamily: F.uiBold, fontSize: 11.5, color: C.deskTxt },
  /** Chú thích cuối màn nói ra giới hạn của BE. Đậm hơn `hint` vì nó đứng một mình, không dưới ô nhập. */
  limit: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.deskTxtDim, marginTop: 14 },
  formActs: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 6 },
  cancel: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
});

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: adminFormStyles.label,
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.desk,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  triggerText: { flex: 1, fontFamily: F.uiSemi, fontSize: 13, color: C.paper },
  chevron: { fontSize: 11, color: C.deskTxtDim },

  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.desk,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  chipOn: { backgroundColor: C.deskHi, borderColor: C.cork },
  chipText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxtSoft },

  small: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
});
