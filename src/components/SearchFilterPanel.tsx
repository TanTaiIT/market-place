import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProvinceField } from './LocationPicker';
import { AttrFilters } from './AttrFilters';
import { PriceRange } from './PriceRange';
import { useCategories } from '@/queries/listings';
import { useCategoryTemplate } from '@/queries/templates';
import type { SearchFilter } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Ngăn lọc của màn tìm kiếm: khu vực · danh mục · khoảng giá.
 *
 * Nhận nguyên `SearchFilter` và trả về bản đã sửa, thay vì bốn cặp value/onChange. Bộ lọc luôn
 * đi cùng nhau (key cache, điều kiện `enabled`, số bộ lọc đang bật đều tính trên cả cụm), nên
 * xé lẻ ở đây chỉ đẩy việc ghép lại sang cho người gọi.
 *
 * Ba nhóm, theo đúng thứ tự người dùng thu hẹp: khu vực → danh mục (và bộ lọc riêng của nó) →
 * khoảng giá. Giá đứng CUỐI có chủ ý: nó là thứ người ta điều chỉnh sau khi đã biết đang xem
 * loại gì, chứ không phải câu hỏi đầu tiên.
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

  // Template của danh mục đang chọn. Chỉ field `filterable` mới thành ô lọc — BE cũng chỉ nhận
  // đúng tập đó, nên hiện thừa là mời người dùng bấm vào một thứ chắc chắn trả 400.
  const { data: template } = useCategoryTemplate(filter.categoryId ?? '');
  const attrFilterFields = (template?.fields ?? []).filter((f) => f.filterable);

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
            // Đổi danh mục là xoá sạch `attrs`: key của danh mục cũ không có trong template mới,
            // và BE sẽ trả 400 cho đúng những key đó. Giữ lại là biến một lượt bấm chip thành
            // một màn lỗi mà người dùng không hiểu vì sao.
            onPress={() =>
              patch({ categoryId: filter.categoryId === c.id ? null : c.id, attrs: {} })
            }
          />
        ))}
      </ScrollView>

      {/*
        Bộ lọc riêng của danh mục. Chỉ hiện khi đã chọn danh mục — BE từ chối `attrs` không kèm
        `category` vì không có template thì không có tập key hợp lệ để đối chiếu.
      */}
      {!!attrFilterFields.length && (
        <AttrFilters
          fields={attrFilterFields}
          value={filter.attrs}
          onChange={(attrs) => patch({ attrs })}
        />
      )}

      <Text style={[styles.label, { marginTop: 18 }]}>Khoảng giá</Text>
      {/* `PriceRange` chặn min > max ngay trong lúc kéo, nên không cần dòng cảnh báo nào. */}
      <PriceRange
        min={filter.minPrice}
        max={filter.maxPrice}
        onChange={({ min, max }) => patch({ minPrice: min, maxPrice: max })}
      />
    </View>
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
  // Lề ngang do người gọi lo (FlatList content container của màn tìm kiếm đã có 18).
  panel: { paddingBottom: 12 },
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
});
