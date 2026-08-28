import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCategories } from '@/queries/listings';
import { useCategoryTemplate } from '@/queries/templates';
import {
  activeFilterCount,
  EMPTY_SEARCH,
  priceRangeLabel,
  type ListingAttrFilter,
  type SearchFilter,
  type TemplateField,
} from '@/api/db';
import { C, F, R } from '@/theme';

/** Một tiêu chí đang bật, kèm bộ lọc SAU KHI bỏ nó — chip không cần tự biết cách xoá mình. */
type Crumb = { key: string; icon: string; text: string; without: SearchFilter };

/**
 * Hàng tiêu chí của trang kết quả: xem bộ lọc đang bật, bỏ từng cái, hoặc mở lại form sửa cả bộ.
 *
 * **Bỏ được tại chỗ, nhưng không sửa được tại chỗ.** Cái bẫy mà việc tách hai màn đã gỡ là "kết
 * quả tự đổi dưới tay" — thanh giá kéo liên tục làm danh sách nhảy mỗi frame. Bấm ✕ không phải
 * loại đó: một phát bấm, kết quả đổi đúng một lần, và người dùng chủ động bỏ chính cái chip họ
 * đang nhìn. Còn mọi thao tác CHỌN (gõ từ khoá, kéo giá, đổi danh mục) vẫn phải về form.
 *
 * Tiêu chí sống trong route params, nên `onChange` bên ngoài chỉ việc `replace` lại URL: không có
 * bản sao state nào ở đây để lệch với thanh địa chỉ.
 */
export function SearchCrumbBar({
  filter,
  count,
  loading,
  onChange,
  onEdit,
}: {
  filter: SearchFilter;
  /** Số tin đang hiện, `null` khi chưa có lượt tìm nào chạy. */
  count: number | null;
  loading: boolean;
  onChange: (next: SearchFilter) => void;
  onEdit: () => void;
}) {
  const { data: categories } = useCategories();
  /*
   * Nhãn của `attrs` nằm trong template danh mục, không nằm trong bộ lọc.
   *
   * Hiện thẳng cặp key/value ra là để lộ khoá kỹ thuật (`ram: 8`), mà ràng buộc dạng khoảng thì
   * `String()` cho ra đúng chữ "[object Object]" — vô nghĩa với người đọc.
   */
  const { data: template } = useCategoryTemplate(filter.categoryId ?? '');
  const category = categories?.find((c) => c.id === filter.categoryId);

  const q = filter.q.trim();
  const price = priceRangeLabel(filter.minPrice, filter.maxPrice);

  const crumbs: Crumb[] = [];
  if (q) crumbs.push({ key: 'q', icon: '🔍', text: `“${q}”`, without: { ...filter, q: '' } });
  if (filter.province) {
    crumbs.push({
      key: 'province',
      icon: '📍',
      text: filter.province,
      without: { ...filter, province: null },
    });
  }
  if (filter.categoryId) {
    crumbs.push({
      key: 'category',
      icon: category?.icon ?? '🏷️',
      text: category?.name ?? 'Danh mục',
      // Bỏ danh mục là xoá sạch `attrs`, y như form đăng tin: không có template thì không còn
      // tập key hợp lệ nào để đối chiếu, và BE trả 400 cho `attrs` không kèm `category`.
      without: { ...filter, categoryId: null, attrs: {} },
    });
  }
  if (price) {
    crumbs.push({
      key: 'price',
      icon: '💰',
      text: price,
      without: { ...filter, minPrice: null, maxPrice: null },
    });
  }
  for (const [key, value] of Object.entries(filter.attrs)) {
    crumbs.push({
      key: `attr:${key}`,
      icon: '⚙️',
      text: attrText(
        template?.fields.find((f) => f.key === key),
        key,
        value,
      ),
      without: { ...filter, attrs: withoutKey(filter.attrs, key) },
    });
  }

  const active = activeFilterCount(filter);

  return (
    <View style={styles.bar}>
      <View style={styles.top}>
        <Pressable
          onPress={onEdit}
          hitSlop={6}
          style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
        >
          <Text style={styles.filterIcon}>⚙</Text>
          <Text style={styles.filterLabel}>Bộ lọc</Text>
          {active > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{active}</Text>
            </View>
          )}
        </Pressable>

        {/*
          Số đếm là số tin ĐANG hiện, không phải tổng của BE: `useSearch` chưa phân trang.
          Lúc đang tìm thì nói "đang tìm" chứ không giữ số cũ — `keepPreviousData` vẫn để danh
          sách cũ nằm đó, số cũ đứng cạnh tiêu chí mới là một lời khẳng định sai.
        */}
        {loading ? (
          <Text style={styles.count}>Đang tìm…</Text>
        ) : count === null ? null : count === 0 ? (
          <Text style={styles.count}>Không có tin nào</Text>
        ) : (
          <Text style={styles.count}>
            <Text style={styles.countNum}>{count}</Text> tin phù hợp
          </Text>
        )}

        <View style={styles.spacer} />

        {/* Một chip thì ✕ của chính nó đã là "xoá tất cả" — thêm nút nữa chỉ là chữ thừa. */}
        {crumbs.length >= 2 && (
          <Pressable onPress={() => onChange(EMPTY_SEARCH)} hitSlop={8}>
            <Text style={styles.clearAll}>Xoá tất cả</Text>
          </Pressable>
        )}
      </View>

      {crumbs.length === 0 ? (
        <Text style={styles.hint}>Chưa lọc gì — bấm Bộ lọc để chọn tiêu chí.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {crumbs.map((crumb) => (
            <View key={crumb.key} style={styles.crumb}>
              <Text style={styles.crumbIcon}>{crumb.icon}</Text>
              {/* Bấm vào thân chip = "tôi muốn đổi cái này" → về form; chỉ ✕ mới là bỏ. */}
              <Pressable onPress={onEdit} hitSlop={4}>
                <Text style={styles.crumbText} numberOfLines={1}>
                  {crumb.text}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onChange(crumb.without)}
                hitSlop={10}
                style={({ pressed }) => [styles.x, pressed && styles.pressed]}
              >
                <Text style={styles.xText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Bỏ một khoá khỏi `attrs`: object rỗng mới là "không lọc", khoá mang `undefined` thì không. */
function withoutKey(attrs: ListingAttrFilter, key: string): ListingAttrFilter {
  const draft = { ...attrs };
  delete draft[key];
  return draft;
}

/**
 * Một ràng buộc `attrs` → chuỗi người đọc hiểu, đọc nhãn từ template danh mục.
 *
 * Không tra được field (template chưa tải xong, hoặc bản template mới đã bỏ field đó) thì lấy
 * chính `key` làm nhãn: xấu nhưng thật. Ẩn chip đi thì người dùng thấy kết quả hẹp bất thường mà
 * không có gì trên màn giải thích vì sao, và cũng không có ✕ nào để bỏ nó ra.
 */
function attrText(
  field: TemplateField | undefined,
  key: string,
  value: ListingAttrFilter[string],
): string {
  const name = field?.label ?? key;
  const unit = field?.unit ? ` ${field.unit}` : '';
  const optionLabel = (v: string) => field?.options.find((o) => o.value === v)?.label ?? v;

  // Field bật/tắt: "Còn bảo hành" đã đủ nghĩa, thêm ": Có" chỉ làm chip dài ra vô ích.
  if (typeof value === 'boolean') return value ? name : `${name}: Không`;
  if (Array.isArray(value)) return `${name}: ${value.map(optionLabel).join(' · ')}`;
  if (typeof value === 'object') {
    const { gte, lte } = value;
    if (gte !== undefined && lte !== undefined) return `${name}: ${gte} — ${lte}${unit}`;
    if (gte !== undefined) return `${name}: từ ${gte}${unit}`;
    if (lte !== undefined) return `${name}: đến ${lte}${unit}`;
    return name;
  }
  if (typeof value === 'number') return `${name}: ${value}${unit}`;
  return `${name}: ${optionLabel(value)}${unit}`;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.paperWarm,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingTop: 2,
    paddingBottom: 10,
    gap: 9,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  // Nút hành động duy nhất của thanh này nên là chỗ duy nhất có màu thương hiệu; chip là trạng
  // thái, để trung tính — cả hàng cùng xanh thì không còn gì nổi lên là thứ bấm được.
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.brand,
    borderRadius: R.pill,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 7,
  },
  filterIcon: { fontSize: 12, color: C.paperWarm },
  filterLabel: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.paperWarm },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: R.pill,
    backgroundColor: C.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: F.uiBold, fontSize: 10.5, color: C.brandTx },
  count: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft },
  countNum: { fontFamily: F.uiBold, color: C.ink },
  spacer: { flex: 1 },
  clearAll: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft },
  hint: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 16, color: C.muted, paddingHorizontal: 16 },
  rail: { gap: 7, paddingHorizontal: 16 },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.chipIdle,
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: R.pill,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 5,
  },
  crumbIcon: { fontSize: 11 },
  // Chặn bề ngang: một từ khoá dài không được đẩy ✕ của chính nó ra khỏi màn.
  crumbText: { fontFamily: F.uiSemi, fontSize: 12, color: C.ink, maxWidth: 190 },
  x: { paddingHorizontal: 5, paddingVertical: 1 },
  xText: { fontFamily: F.ui, fontSize: 11, color: C.muted },
  pressed: { opacity: 0.7 },
});
