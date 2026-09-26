import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ProvinceName } from '@/api/location';
import { AddressField, ProvinceField, WardField } from './LocationPicker';
import { C, F, S } from '@/theme';

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
/**
 * Chỗ còn thiếu của khối khu vực — TÊN ô để liệt kê, kèm câu giải thích đầy đủ.
 *
 * Hai thứ đó đi cùng nhau ở một chỗ vì chúng phải nói về CÙNG một điều kiện: dòng "còn thiếu"
 * dưới chân form và câu lỗi lúc bấm gửi mà lệch nhau thì người dùng sửa xong vẫn không bấm được.
 */
export function locationGap(location: ListingLocation): { label: string; message: string } | null {
  // Thiếu tỉnh thì tin không lên được bộ lọc khu vực, coi như người mua gần đó không thấy.
  if (!location.province) {
    return {
      label: 'tỉnh / thành',
      message: '⚠️ Chọn tỉnh / thành để người mua gần bạn tìm được',
    };
  }
  if (!location.ward) return { label: 'phường / xã', message: '⚠️ Chọn phường / xã' };
  return null;
}


export function LocationFields({
  value,
  lockArea,
  onChange,
}: {
  value: ListingLocation;
  /**
   * Khoá TỈNH và PHƯỜNG, chỉ còn số nhà sửa được — form SỬA truyền cờ này.
   *
   * Hai field đó là khoá định tuyến: BE dựng `provinceCode`/`wardCode` từ chúng đúng một lần
   * lúc tạo, và chúng quyết định ô (danh mục × tỉnh × phường) nào duyệt tin. `PATCH /listings`
   * vì thế không nhận chúng nữa — bày ô chọn ở đây là hứa một việc server sẽ từ chối.
   *
   * Hiện thành CHỮ chứ không ẩn đi: người sửa tin vẫn cần thấy tin của mình đang ở đâu, và
   * một khối biến mất giữa form thì họ tưởng dữ liệu bị mất.
   */
  lockArea?: boolean;
  onChange: (next: ListingLocation) => void;
}) {
  const patch = (fields: Partial<ListingLocation>) => onChange({ ...value, ...fields });

  return (
    <View style={styles.group}>
      {lockArea ? (
        <View style={styles.locked}>
          <Text style={styles.lockedLabel}>KHU VỰC</Text>
          <Text style={styles.lockedValue}>
            {[value.ward, value.province].filter(Boolean).join(', ') || 'Chưa có khu vực'}
          </Text>
          <Text style={styles.lockedHint}>
            Khu vực cố định sau khi đăng — nó quyết định ai duyệt tin. Cần đổi thì đăng tin mới.
          </Text>
        </View>
      ) : (
        <>
          <ProvinceField value={value.province} onChange={(province) => patch({ province })} />
          {/* Đổi tỉnh không cần xoá `ward` ở đây — `WardField` tự bỏ xã không thuộc tỉnh đang chọn. */}
          <WardField
            province={value.province}
            value={value.ward}
            onChange={(ward) => patch({ ward })}
          />
        </>
      )}
      {/* Sau xã: người dùng đã khoanh xong vùng rồi mới gõ chi tiết trong vùng đó. Số nhà KHÔNG
          tham gia định tuyến nên vẫn sửa được ở form sửa. */}
      <AddressField value={value.address} onChange={(address) => patch({ address })} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 18 },
  locked: {
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    marginBottom: S.md,
  },
  lockedLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.inkSoft },
  lockedValue: { fontFamily: F.uiBold, fontSize: 14, color: C.ink, marginTop: 3 },
  lockedHint: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 6, lineHeight: 17 },
});
