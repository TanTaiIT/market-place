import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { categoryLabel } from './CategoryLogo';
import { PickerSheet } from './PickerSheet';
import type { PickerSearch } from './PickerSheet';
import { useProvinceSearch } from './LocationPicker';
import { GlassSheen, glassPane } from './GlassSurface';
import type { Category } from '@/api/db';
import type { ProvinceName } from '@/api/location';
import { C, F, R, shadowLift } from '@/theme';

/**
 * Thẻ tìm nổi trên khối chào của trang chủ: từ khoá · danh mục · khu vực · nút tìm.
 *
 * CẢ BA tiêu chí đều là state riêng của thẻ, chỉ đi theo nút "Tìm tin" sang trang kết quả.
 * Bản trước danh mục dùng chung giá trị với hàng chip (khi chip còn lọc bảng tại chỗ);
 * giờ chip là LỐI ĐI — bấm là sang trang kết quả ngay — nên nếu ngăn danh mục còn nối vào
 * đó thì chọn danh mục trong thẻ sẽ điều hướng tức thì và vứt mất từ khoá vừa gõ.
 */
export function FeedSearchCard({
  categories,
  onSearch,
}: {
  categories: Category[];
  onSearch: (q: string, categoryId: string | null, province: ProvinceName | null) => void;
}) {
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
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
        .map((c) => ({ key: c.id, label: categoryLabel(c) }));
    },
    [categories],
  );

  const active = categories.find((c) => c.id === catId);

  return (
    <View style={styles.card}>
      {/* Lớp 2 của mặt kính — phải là con ĐẦU TIÊN, nếu không nó phủ lên nội dung. */}
      <GlassSheen />
      {/* Ô gõ thẳng tên tin — đường tắt cho người đã biết mình tìm gì; Enter trên bàn phím
          cũng là "Tìm tin" luôn, khỏi với tay xuống nút. */}
      <View style={styles.qRow}>
        <Text style={styles.rowIcon}>🔎</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Bạn đang tìm món gì?"
          placeholderTextColor={C.muted}
          returnKeyType="search"
          onSubmitEditing={() => onSearch(q, catId, province)}
          style={styles.qInput}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} hitSlop={8}>
            <Text style={styles.qClear}>✕</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.sep} />
      <Row
        icon="🏷️"
        label="Danh mục"
        value={active ? categoryLabel(active) : 'Tất cả danh mục'}
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
        onPress={() => onSearch(q, catId, province)}
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
        value={catId}
        emptyAll="Tất cả danh mục"
        onSelect={setCatId}
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
  /*
   * Mảng sáng duy nhất trên nền xanh, nên nó là thứ mắt rơi vào đầu tiên.
   *
   * `glassPane` thay cho `paperWarm` đục: trên nền hero đã làm sâu, một tấm trắng 92% có
   * cạnh vát đọc ra 'kính' còn trắng 100% đọc ra 'tờ giấy dán lên'. Chữ bên trong vẫn là
   * `C.ink` nên độ đục phải ở mức này, không hạ thêm.
   */
  card: {
    ...glassPane,
    borderRadius: R.lg,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    gap: 11,
    ...shadowLift,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  /*
   * `paddingVertical: 0`: Android tự cộng padding dọc vào TextInput, để nguyên thì riêng
   * hàng này cao hơn hai hàng chọn bên dưới dù cùng cỡ chữ.
   */
  qInput: { flex: 1, fontFamily: F.uiSemi, fontSize: 15, color: C.ink, paddingVertical: 0 },
  qClear: { fontFamily: F.ui, fontSize: 14, color: C.muted, paddingHorizontal: 2 },
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
