import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PickerSheet } from './PickerSheet';
import type { PickerSearch } from './PickerSheet';
import { useProvinceSearch } from './LocationPicker';
import type { Category } from '@/api/db';
import type { ProvinceName } from '@/api/location';
import { C, F, R, shadowLift } from '@/theme';

/**
 * Thẻ tìm nổi trên khối chào của bảng tin: danh mục · khu vực · nút tìm.
 *
 * **Danh mục KHÔNG có bản riêng ở đây** — nó là đúng giá trị mà hàng chip bên dưới đang dùng, đưa
 * vào qua props. Một màn hai nguồn thì có lúc chip "Điện thoại" đang sáng mà thẻ vẫn ghi "Tất cả
 * danh mục", và người dùng không biết cái nào mới là thứ sắp được tìm.
 *
 * **Khu vực thì ngược lại: state riêng của thẻ.** `useListings` không lọc theo tỉnh, nên chọn
 * tỉnh KHÔNG đổi bảng tin bên dưới — nó chỉ đi theo nút "Tìm tin" sang trang kết quả. Đẩy nó lên
 * màn hình sẽ hứa một thứ mà bảng tin không thực hiện.
 */
export function FeedSearchCard({
  categories,
  categoryId,
  onCategory,
  onSearch,
}: {
  categories: Category[];
  categoryId: string;
  onCategory: (id: string) => void;
  onSearch: (province: ProvinceName | null) => void;
}) {
  const [province, setProvince] = useState<ProvinceName | null>(null);
  /** Ngăn chọn đang mở. Một khoá chứ không hai boolean: hai ngăn không bao giờ mở cùng lúc. */
  const [picking, setPicking] = useState<'category' | 'province' | null>(null);
  const provinces = useProvinceSearch();

  // Lọc tại chỗ: danh mục đã nằm sẵn trong cache của `useCategories`, gọi mạng mỗi lần gõ phím
  // chỉ thêm độ trễ. `useCallback` vì `PickerSheet` nhận nó làm dependency của vòng tìm.
  const categorySearch = useCallback<PickerSearch<string>>(
    (keyword) => {
      const kw = keyword.trim().toLowerCase();
      return categories
        .filter((c) => c.name.toLowerCase().includes(kw))
        .map((c) => ({ key: c.id, label: c.icon ? `${c.icon} ${c.name}` : c.name }));
    },
    [categories],
  );

  const active = categories.find((c) => c.id === categoryId);

  return (
    <View style={styles.card}>
      <Row
        icon="🏷️"
        label="Danh mục"
        value={active ? [active.icon, active.name].filter(Boolean).join(' ') : 'Tất cả danh mục'}
        onPress={() => setPicking('category')}
      />
      <View style={styles.sep} />
      <Row
        icon="📍"
        label="Khu vực"
        value={province ?? 'Toàn quốc'}
        onPress={() => setPicking('province')}
      />
      <Pressable
        onPress={() => onSearch(province)}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <Text style={styles.ctaText}>Tìm tin</Text>
      </Pressable>

      <PickerSheet
        visible={picking === 'category'}
        title="Chọn danh mục"
        placeholder="Gõ tên danh mục..."
        search={categorySearch}
        loading={false}
        // Chuỗi rỗng là "Tất cả" ở tầng lọc, nhưng `PickerSheet` đọc `null` là "chưa chọn" — hai
        // cách viết cùng một ý, đổi qua lại đúng ở biên này chứ không để lẫn vào state.
        value={categoryId || null}
        emptyAll="Tất cả danh mục"
        onSelect={(id) => onCategory(id ?? '')}
        onClose={() => setPicking(null)}
      />
      <PickerSheet
        visible={picking === 'province'}
        title="Chọn tỉnh / thành"
        placeholder="Gõ tên tỉnh, kể cả tên cũ..."
        search={provinces.search}
        loading={provinces.loading}
        value={province}
        emptyAll="Toàn quốc"
        onSelect={setProvince}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

/** Một dòng của thẻ: nhãn nhỏ ở trên, giá trị đang chọn ở dưới — cả dòng là vùng bấm. */
function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Mảng trắng duy nhất trên nền xanh, nên nó là thứ mắt rơi vào đầu tiên.
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: R.lg,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    gap: 11,
    ...shadowLift,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft },
  rowValue: { fontFamily: F.uiSemi, fontSize: 15, color: C.ink, marginTop: 1 },
  chev: { fontFamily: F.ui, fontSize: 18, color: C.muted },
  // Thụt bằng đúng bề ngang cột icon: đường kẻ chạy dưới phần CHỮ, không cắt ngang hàng icon.
  sep: { height: 1, backgroundColor: C.line, marginLeft: 33 },
  cta: {
    backgroundColor: C.brand,
    borderRadius: R.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 3,
  },
  ctaText: { fontFamily: F.uiBold, fontSize: 15, color: C.paperWarm },
  pressed: { opacity: 0.75 },
});
