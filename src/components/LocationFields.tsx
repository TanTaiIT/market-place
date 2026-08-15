import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ProvinceName } from '@/api/location';
import { AddressField, ProvinceField, WardField } from './LocationPicker';

/**
 * Khối khu vực của form đăng tin: gom ba ô địa chỉ cùng luật hợp lệ của chúng vào một chỗ, để
 * route chỉ còn giữ một mẩu state thay vì ba và không phải tự nhớ thứ tự tỉnh → xã → đường.
 *
 * Ba ô đi liền nhau nên nhận CHUNG một object: tách thành ba cặp value/onChange thì mỗi màn dùng
 * lại phải tự khai ba state và tự nhớ ràng buộc giữa chúng — đúng thứ file này sinh ra để bỏ.
 */

export type ListingLocation = {
  province: ProvinceName | null;
  ward: string | null;
  /** Số nhà / tên đường. Chuỗi rỗng chứ không phải null: nó nối thẳng vào `TextInput`. */
  address: string;
};

export const EMPTY_LOCATION: ListingLocation = { province: null, ward: null, address: '' };

/**
 * Trả về câu nhắc cho ô còn thiếu, `null` khi đủ. Theo thứ tự người dùng đọc form để toast trỏ
 * đúng ô họ vừa bỏ qua.
 *
 * `address` không nằm trong đây: BE khai optional, và tin chỉ có tỉnh/xã vẫn tìm được bình thường.
 */
export function validateLocation(location: ListingLocation): string | null {
  // Thiếu tỉnh thì tin không lên được bộ lọc khu vực, coi như người mua gần đó không thấy.
  if (!location.province) return '⚠️ Chọn tỉnh / thành để người mua gần bạn tìm được';
  if (!location.ward) return '⚠️ Chọn phường / xã';
  return null;
}

export function LocationFields({
  value,
  onChange,
}: {
  value: ListingLocation;
  onChange: (next: ListingLocation) => void;
}) {
  const patch = (fields: Partial<ListingLocation>) => onChange({ ...value, ...fields });

  return (
    <View style={styles.group}>
      <ProvinceField value={value.province} onChange={(province) => patch({ province })} />
      {/* Đổi tỉnh không cần xoá `ward` ở đây — `WardField` tự bỏ xã không thuộc tỉnh đang chọn. */}
      <WardField
        province={value.province}
        value={value.ward}
        onChange={(ward) => patch({ ward })}
      />
      {/* Sau xã: người dùng đã khoanh xong vùng rồi mới gõ chi tiết trong vùng đó. */}
      <AddressField value={value.address} onChange={(address) => patch({ address })} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 18 },
});
