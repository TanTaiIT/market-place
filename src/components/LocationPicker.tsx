import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ProvinceName } from '@/api/location';
import { filterProvinces, filterWards, mergedFromLabel } from '@/api/location';
import { useProvinces, useWards } from '@/queries/location';
import { PickerSheet } from './PickerSheet';
import type { PickerSearch } from './PickerSheet';
import { C, F, shadow } from '@/theme';

/**
 * Ô chọn khu vực 2 cấp: Tỉnh/thành → Phường/xã. Sau 01/07/2025 không còn quận/huyện ở giữa,
 * nên chỉ có đúng hai tầng hành chính — đừng thêm tầng thứ ba vào đây.
 *
 * `AddressField` bên dưới KHÔNG phải tầng thứ ba: nó là dòng chữ tự do (số nhà, tên đường),
 * không tra từ điển và không tham gia lọc.
 *
 * Danh sách tải từ BE (`/locations/*`) và cache vĩnh viễn trong TanStack; việc lọc chạy tại chỗ
 * vì dữ liệu đã nằm sẵn trong bộ nhớ — gọi API mỗi lần gõ phím chỉ tạo thêm độ trễ.
 */

export type { ProvinceName };

export function ProvinceField({
  label = 'Tỉnh / Thành phố',
  value,
  onChange,
  allowAll = false,
}: {
  label?: string;
  value: ProvinceName | null;
  onChange: (province: ProvinceName | null) => void;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: provinces, isPending } = useProvinces();

  const search = useCallback<PickerSearch<ProvinceName>>(
    (keyword) =>
      filterProvinces(provinces ?? [], keyword).map((p) => ({
        key: p.name,
        label: p.name,
        // Nhắc tên tỉnh cũ ngay dưới tên mới: thấy "Bình Dương" nằm trong "Hồ Chí Minh" đỡ
        // hoang mang hơn nhiều so với việc tỉnh cũ biến mất không lời giải thích.
        note: mergedFromLabel(p),
      })),
    [provinces],
  );

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Trigger text={value} placeholder="Chọn tỉnh / thành" onPress={() => setOpen(true)} />

      <PickerSheet
        visible={open}
        title="Chọn tỉnh / thành"
        placeholder="Gõ tên tỉnh, kể cả tên cũ..."
        search={search}
        loading={isPending}
        value={value}
        emptyAll={allowAll ? 'Toàn quốc' : undefined}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/**
 * Phụ thuộc tỉnh: chưa chọn tỉnh thì ô này khoá.
 *
 * Tự xoá `value` khi nó không thuộc tỉnh đang chọn, thay vì bắt mỗi người gọi nhớ bọc
 * `setProvince` — chỗ này có sẵn cả `province` lẫn danh sách xã, còn người gọi thì chỉ cần
 * viết `onChange={setProvince}` một lần là lọt ngay một cái xã của tỉnh cũ xuống BE.
 */
export function WardField({
  label = 'Phường / Xã',
  province,
  value,
  onChange,
  allowAll = false,
}: {
  label?: string;
  province: ProvinceName | null;
  value: string | null;
  onChange: (ward: string | null) => void;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: wards, isPending } = useWards(province);

  useEffect(() => {
    if (!value) return;
    // Bỏ tỉnh thì xã cũ không còn ngữ cảnh nào để thuộc về.
    if (!province) return onChange(null);
    // `wards` undefined nghĩa là đang bay, KHÔNG phải là xã sai — đợi có danh sách mới dám kết
    // luận. Query đổi key theo tỉnh và không giữ dữ liệu cũ, nên không có nhịp nào so nhầm bảng.
    if (wards && !wards.includes(value)) onChange(null);
  }, [province, wards, value, onChange]);

  const search = useCallback<PickerSearch<string>>(
    (keyword) => filterWards(wards ?? [], keyword).map((w) => ({ key: w, label: w })),
    [wards],
  );

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Trigger
        text={value}
        placeholder={
          !province
            ? 'Chọn tỉnh / thành trước'
            : wards?.length
              ? `Chọn trong ${wards.length} phường / xã`
              : 'Đang tải phường / xã...'
        }
        disabled={!province}
        onPress={() => setOpen(true)}
      />

      <PickerSheet
        visible={open}
        title={province ?? 'Chọn phường / xã'}
        placeholder="Gõ tên phường, xã..."
        search={search}
        loading={isPending}
        value={value}
        emptyAll={allowAll ? 'Toàn tỉnh' : undefined}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/**
 * Số nhà / tên đường — mảnh cuối của địa chỉ, dưới cấp xã. Gõ tay chứ không chọn, vì không có
 * từ điển nào tra được tới mức này.
 *
 * Để trống được: BE khai `address` optional, và nhiều người bán chỉ muốn hẹn ở chỗ công cộng
 * chứ không đưa địa chỉ nhà lên tin công khai.
 */
export function AddressField({
  label = 'Số nhà / Đường',
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (address: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Không bắt buộc — ví dụ: 12 Nguyễn Huệ"
        placeholderTextColor={C.muted}
        // Khớp `z.string().max(255)` của BE: chặn tại chỗ thay vì để người dùng gõ xong mới ăn 400.
        maxLength={255}
        style={styles.addressInput}
      />
    </View>
  );
}

function Trigger({
  text,
  placeholder,
  disabled,
  onPress,
}: {
  text: string | null;
  placeholder: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.trigger,
        disabled && styles.triggerOff,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.triggerText, !text && { color: C.muted }]}>{text ?? placeholder}</Text>
      <Text style={styles.triggerGlyph}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: C.inkSoft,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...shadow,
  },
  triggerOff: { backgroundColor: C.chipIdle, borderColor: C.line },
  // Cùng hộp với `trigger` để ba ô khu vực đọc như một khối, chỉ khác là gõ được.
  addressInput: {
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: F.ui,
    fontSize: 14,
    color: C.ink,
    ...shadow,
  },
  triggerText: { flex: 1, fontFamily: F.ui, fontSize: 14, color: C.ink },
  triggerGlyph: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft },
});
