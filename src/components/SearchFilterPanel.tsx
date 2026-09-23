import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProvinceField, WardField } from './LocationPicker';
import { AttrFilters } from './AttrFilters';
import { PriceField } from './PriceField';
import { useCategories } from '@/queries/listings';
import { useCategoryTemplate } from '@/queries/templates';
import { useMyOrgs } from '@/queries/org';
import type { ProvinceName } from '@/api/location';
import type { SearchFilter } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Ngăn lọc của màn tìm kiếm: khu vực (tỉnh → phường/xã → nhóm đã tham gia) · danh mục ·
 * khoảng giá.
 *
 * Nhận nguyên `SearchFilter` và trả về bản đã sửa, thay vì bốn cặp value/onChange. Bộ lọc luôn
 * đi cùng nhau (key cache, điều kiện `enabled`, số bộ lọc đang bật đều tính trên cả cụm), nên
 * xé lẻ ở đây chỉ đẩy việc ghép lại sang cho người gọi.
 *
 * Ba nhóm, theo đúng thứ tự người dùng thu hẹp: khu vực → danh mục (và bộ lọc riêng của nó) →
 * khoảng giá. Giá đứng CUỐI có chủ ý: nó là thứ người ta điều chỉnh sau khi đã biết đang xem
 * loại gì, chứ không phải câu hỏi đầu tiên — và từ khi chip giá bám theo danh mục, thứ tự đó
 * còn là điều kiện để chip hiện ra đúng bậc.
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
      {/*
        Khu vực đi HAI tầng như form đăng tin — cùng `ProvinceField`/`WardField`, cùng từ điển.
        Chỉ một ô "Khu vực" là người dùng chọn xong tỉnh rồi đứng chờ một ô tiếp theo không tới.
      */}
      <ProvinceField
        label="Tỉnh / Thành phố"
        value={filter.province}
        onChange={(province) => {
          if (province === filter.province) return;
          // Đổi tỉnh là bỏ xã và nhóm NGAY tại đây, không đợi `WardField` tự dọn: nó chỉ dọn sau
          // khi danh sách xã mới tải xong, còn nút "Tìm kiếm" thì bấm được ngay — kịp lọt một xã
          // của tỉnh cũ xuống BE và ăn 400. Nhóm thì bày theo tỉnh, đổi tỉnh là danh sách khác.
          patch({ province, ward: null, orgSlug: null });
        }}
        allowAll
      />
      <WardField
        province={filter.province}
        value={filter.ward}
        onChange={(ward) => patch({ ward })}
        allowAll
        // Có nhóm thì tỉnh/xã không lọc lên tin (`locationApplies`): ô xã khoá và nói thẳng vì sao,
        // thay vì nhận một lựa chọn rồi lặng lẽ không dùng.
        disabledReason={
          filter.orgSlug ? 'Đang lọc theo nhóm — bỏ chọn nhóm để lọc theo phường / xã' : undefined
        }
      />
      {/* Chỉ sau khi đã chọn tỉnh — nhóm có địa bàn, chưa có tỉnh thì chưa biết bày nhóm nào. */}
      {filter.province ? (
        <OrgChips
          province={filter.province}
          value={filter.orgSlug}
          // Chọn nhóm là bỏ xã: xã sẽ không được gửi lên nữa, giữ lại là một lựa chọn treo.
          onChange={(orgSlug) => patch({ orgSlug, ward: orgSlug ? null : filter.ward })}
        />
      ) : null}

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
      {/*
        Chip gợi ý bám theo DANH MỤC đang chọn, không phải một thang chung — xem `LADDERS`.
        Truyền `slug` chứ không truyền cả object danh mục: đây là thứ duy nhất `PriceField` cần
        biết, và nhận nhiều hơn thế là mở đường cho nó đọc thêm thứ không thuộc việc của nó.
      */}
      <PriceField
        min={filter.minPrice}
        max={filter.maxPrice}
        categorySlug={categories?.find((c) => c.id === filter.categoryId)?.slug ?? null}
        onChange={({ min, max }) => patch({ minPrice: min, maxPrice: max })}
      />
    </View>
  );
}

/**
 * Nhóm đã tham gia ở tỉnh đang lọc — tầng ba của khu vực. Chọn một nhóm là chỉ xem tin NỘI BỘ
 * của nhóm đó, ở BẤT KỲ tỉnh nào — tỉnh vừa chọn chỉ để tìm ra nhóm, không lọc lên tin (xem
 * `locationApplies` trong `db.ts`).
 *
 * Bày theo tỉnh vì nhóm là thứ có địa bàn (`provinceCode`): chọn "Hà Nội" rồi thấy hội nhiếp
 * ảnh Sài Gòn là một lựa chọn gần chắc trả về rỗng. Nhóm không khai tỉnh xếp SAU chứ không bị
 * loại — "không gắn tỉnh" khác "ở tỉnh khác". Nhóm bị khoá thì loại hẳn: gửi slug của nó là
 * ăn 403 ở mọi request.
 *
 * Khách chưa đăng nhập hoặc người chưa vào nhóm nào → không vẽ gì: khối này nói về nhóm CỦA
 * họ, không có thì không có gì để nói. Có nhóm nhưng không nhóm nào ở tỉnh này → một dòng
 * nói rõ vì sao trống, thay vì để họ tưởng khối chưa tải xong.
 */
function OrgChips({
  province,
  value,
  onChange,
}: {
  province: ProvinceName;
  value: string | null;
  onChange: (slug: string | null) => void;
}) {
  const { data: orgs } = useMyOrgs();
  if (!orgs?.length) return null;

  const active = orgs.filter((o) => o.status === 'active');
  const here = [
    ...active.filter((o) => o.provinceCode === province),
    ...active.filter((o) => o.provinceCode === null),
  ];

  return (
    <>
      <Text style={styles.label}>Nhóm đã tham gia</Text>
      {here.length === 0 ? (
        <Text style={styles.hint}>Bạn chưa tham gia nhóm nào ở {province}.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tất cả" on={value === null} onPress={() => onChange(null)} />
          {here.map((o) => (
            <Chip
              key={o.slug}
              label={`👥 ${o.name}`}
              on={value === o.slug}
              onPress={() => onChange(value === o.slug ? null : o.slug)}
            />
          ))}
        </ScrollView>
      )}
    </>
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
  hint: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginBottom: 14 },
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
