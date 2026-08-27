import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminPickerField, adminFormStyles } from './AdminPicker';
import type { PickerSearch } from './PickerSheet';
import { useCategories } from '@/queries/listings';
import { useProvinces, useWards } from '@/queries/location';
import { filterProvinces, filterWards, type ProvinceName } from '@/api/location';
import { C, F } from '@/theme';

/**
 * Ô địa lý của TRỤC DANH MỤC — hai tầng, một khối.
 *
 * Tách khỏi `RoleGrantForm` vì hai lý do cùng chiều: form đã đụng trần LOC (HARD#11), và "ô nào"
 * là một khái niệm khép kín với dữ liệu riêng (danh mục · tỉnh · phường) mà phần còn lại của form
 * không cần biết tới.
 *
 * Tầng tỉnh nhận NHIỀU tỉnh. Tầng phường nhận ĐÚNG một tỉnh + danh sách phường, vì cặp
 * (tỉnh, phường) mới định danh được một ô — 243 tên phường lặp giữa các tỉnh.
 */
export type GeoScope = 'category_province' | 'category_ward';

export type GeoScopeValue = {
  categoryId: string | null;
  provinceCodes: ProvinceName[];
  wardCodes: string[];
};

export function RoleGrantGeoFields({
  scope,
  value,
  onChange,
}: {
  scope: GeoScope;
  value: GeoScopeValue;
  onChange: (patch: Partial<GeoScopeValue>) => void;
}) {
  const { data: categories } = useCategories();
  const { data: provinces, isPending: provincesPending } = useProvinces();

  /** Tầng phường chỉ mang một tỉnh, nên tỉnh ở đây là ô chọn ĐƠN chứ không phải danh sách. */
  const wardProvince = (value.provinceCodes[0] ?? null) as ProvinceName | null;
  // `null` khi đang ở tầng tỉnh: `useWards` tự tắt, không bắn request cho một ô không hiện.
  const { data: wards, isPending: wardsPending } = useWards(
    scope === 'category_ward' ? wardProvince : null,
  );

  const searchProvince = useCallback<PickerSearch<ProvinceName>>(
    (keyword) =>
      filterProvinces(provinces ?? [], keyword)
        // Tỉnh đã chọn thì bỏ khỏi danh sách: chọn lại chỉ tạo bản trùng trong `provinceCodes`.
        .filter((p) => !value.provinceCodes.includes(p.name))
        .map((p) => ({ key: p.name, label: p.name })),
    [provinces, value.provinceCodes],
  );

  const searchWard = useCallback<PickerSearch<string>>(
    (keyword) =>
      filterWards(wards ?? [], keyword)
        .filter((w) => !value.wardCodes.includes(w))
        .map((w) => ({ key: w, label: w })),
    [wards, value.wardCodes],
  );

  return (
    <View style={{ marginTop: 18 }}>
      <AdminPickerField
        label="Danh mục"
        title="Chọn danh mục"
        placeholder="Chưa chọn danh mục"
        items={(categories ?? []).map((c) => ({ key: c.id, label: c.name }))}
        value={value.categoryId}
        onChange={(categoryId) => onChange({ categoryId })}
      />

      {scope === 'category_province' ? (
        <>
          <Text style={adminFormStyles.label}>TỈNH PHỤ TRÁCH</Text>
          <Chips
            items={value.provinceCodes}
            onRemove={(p) =>
              onChange({ provinceCodes: value.provinceCodes.filter((x) => x !== p) })
            }
          />
          <AdminPickerField
            label=""
            title="Thêm tỉnh phụ trách"
            placeholder="Thêm tỉnh..."
            search={searchProvince}
            loading={provincesPending}
            value={null}
            onChange={(p) => p && onChange({ provinceCodes: [...value.provinceCodes, p] })}
          />
        </>
      ) : (
        <>
          {/* Đổi tỉnh thì xoá phường đã chọn: phường của tỉnh cũ không thuộc ô nào của tỉnh mới. */}
          <AdminPickerField
            label="Tỉnh / thành"
            title="Chọn tỉnh"
            placeholder="Chưa chọn tỉnh"
            search={searchProvince}
            loading={provincesPending}
            value={wardProvince}
            onChange={(province) =>
              onChange({ provinceCodes: province ? [province] : [], wardCodes: [] })
            }
          />

          <Text style={adminFormStyles.label}>PHƯỜNG / XÃ PHỤ TRÁCH</Text>
          <Chips
            items={value.wardCodes}
            onRemove={(w) => onChange({ wardCodes: value.wardCodes.filter((x) => x !== w) })}
          />
          <AdminPickerField
            label=""
            title="Thêm phường/xã"
            placeholder={wardProvince ? 'Thêm phường/xã...' : 'Chọn tỉnh trước đã'}
            search={searchWard}
            loading={wardsPending}
            value={null}
            onChange={(w) => w && onChange({ wardCodes: [...value.wardCodes, w] })}
          />
        </>
      )}
    </View>
  );
}

/** Viên đã chọn, chạm để bỏ — dùng chung cho cả tỉnh và phường. */
function Chips({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  return (
    <View style={adminFormStyles.chips}>
      {items.map((item) => (
        <Pressable
          key={item}
          onPress={() => onRemove(item)}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.chipText}>{item} ✕</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.deskHi,
    borderWidth: 1,
    borderColor: C.cork,
  },
  chipText: { fontFamily: F.uiSemi, fontSize: 12, color: C.paper },
});
