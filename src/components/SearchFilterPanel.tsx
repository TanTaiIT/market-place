import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProvinceField } from './LocationPicker';
import { useCategories } from '@/queries/listings';
import type { SearchFilter } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Ngăn lọc của màn tìm kiếm: khu vực · danh mục · khoảng giá.
 *
 * Nhận nguyên `SearchFilter` và trả về bản đã sửa, thay vì bốn cặp value/onChange. Bộ lọc luôn
 * đi cùng nhau (key cache, điều kiện `enabled`, số bộ lọc đang bật đều tính trên cả cụm), nên
 * xé lẻ ở đây chỉ đẩy việc ghép lại sang cho người gọi.
 *
 * Giá giữ ở dạng CHUỖI trong ô nhập và chỉ đổi sang số khi đẩy lên: người dùng gõ dở "50" phải
 * còn nhìn thấy "50", còn xoá trắng phải ra `null` chứ không phải `0` — `0` là một mức giá thật.
 */
export function SearchFilterPanel({
  filter,
  onChange,
}: {
  filter: SearchFilter;
  onChange: (next: SearchFilter) => void;
}) {
  const { data: categories } = useCategories();
  const patch = (part: Partial<SearchFilter>) => onChange({ ...filter, ...part });

  return (
    <View style={styles.panel}>
      <ProvinceField label="Khu vực" value={filter.province} onChange={(p) => patch({ province: p })} allowAll />

      <Text style={styles.label}>Danh mục</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Tất cả" on={filter.categoryId === null} onPress={() => patch({ categoryId: null })} />
        {(categories ?? []).map((c) => (
          <Chip
            key={c.id}
            label={`${c.icon} ${c.name}`}
            on={filter.categoryId === c.id}
            onPress={() => patch({ categoryId: filter.categoryId === c.id ? null : c.id })}
          />
        ))}
      </ScrollView>

      <Text style={styles.label}>Khoảng giá (đ)</Text>
      <View style={styles.priceRow}>
        <PriceInput
          placeholder="Giá thấp nhất"
          value={filter.minPrice}
          onChange={(v) => patch({ minPrice: v })}
        />
        <Text style={styles.dash}>—</Text>
        <PriceInput
          placeholder="Giá cao nhất"
          value={filter.maxPrice}
          onChange={(v) => patch({ maxPrice: v })}
        />
      </View>

      {filter.minPrice !== null && filter.maxPrice !== null && filter.minPrice > filter.maxPrice && (
        // Cảnh báo tại chỗ thay vì tự hoán đổi hai ô: đảo giá trị sau lưng người dùng khiến họ
        // thấy con số mình vừa gõ nhảy sang ô kia mà không hiểu vì sao.
        <Text style={styles.warn}>Giá thấp nhất đang lớn hơn giá cao nhất — không tin nào khớp</Text>
      )}
    </View>
  );
}

function PriceInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <TextInput
      value={value === null ? '' : String(value)}
      // Chỉ giữ chữ số: bàn phím `numeric` trên iOS vẫn có dấu chấm/phẩy, mà `minPrice` của BE
      // là number nên một dấu phẩy lọt xuống là 400 cho cả lượt tìm.
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, '');
        onChange(digits ? Number(digits) : null);
      }}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      keyboardType="numeric"
      style={styles.price}
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
  panel: { paddingHorizontal: 18, paddingBottom: 12 },
  label: {
    fontFamily: F.uiBold,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
    marginBottom: 7,
  },
  chips: { gap: 7, paddingBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: C.moss, borderColor: C.moss },
  chipText: { fontFamily: F.ui, fontSize: 12, color: C.ink },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: F.mono,
    fontSize: 12.5,
    color: C.ink,
  },
  dash: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  warn: { fontFamily: F.uiSemi, fontSize: 11, color: C.pin, marginTop: 8 },
});
