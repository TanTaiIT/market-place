import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradOf, initialsOf } from '@/api/client';
import { squareUrl } from '@/api/cloudinary';
import { F } from '@/theme';

/**
 * Mặt của một nhóm — chỗ DUY NHẤT biết chuỗi dự phòng khi nhóm chưa có ảnh.
 *
 * **Ba bậc: avatar → ẢNH BÌA → chữ viết tắt.**
 *
 * Bìa làm bậc hai vì màn sửa hồ sơ nhóm hỏi bìa TRƯỚC avatar, nên "có bìa mà chưa đặt avatar"
 * là ca thường gặp nhất — bỏ bậc này là hiện chữ viết tắt cho một nhóm đang có ảnh hẳn hoi.
 * Chuỗi này vốn đã đúng ở dải "Nhóm quanh bạn", nhưng hai thẻ nhóm ở màn khám phá dừng lại ở
 * bậc hai: hết ảnh thì chúng vẽ một khối màu hai tông không mang thông tin gì, và nhóm chưa có
 * ảnh nào trông như nhóm bị lỗi tải.
 *
 * Người gọi truyền `style` để định hình — ô vuông bo góc ở thẻ danh sách, vòng tròn ở dải bảng
 * tin. Cỡ chữ viết tắt phải đi kèm vì nó là HÌNH chứ không phải chữ: buộc nó vào thang `T` là
 * để một ô trang trí kéo theo cả phân cấp tiêu đề.
 */
export function OrgFace({
  seed,
  name,
  avatarUrl,
  coverUrl,
  style,
  initialsSize = 18,
}: {
  /** Khoá của dải màu dự phòng — cùng nhóm thì luôn ra cùng màu giữa các lần mở. */
  seed: string;
  name: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  initialsSize?: number;
}) {
  const face = avatarUrl || coverUrl;

  if (face) {
    return (
      <View style={[styles.box, style]}>
        {/* `squareUrl`: ô này vuông hoặc tròn, mà bìa thì ngang — `g_auto` cắt theo chủ thể
            thay vì cắt giữa mù, nên một bố cục lệch một bên không ra mảng tường trống. */}
        <Image
          source={{ uri: squareUrl(face, 400) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={gradOf(seed)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.box, styles.center, style]}
    >
      <Text style={[styles.initials, { fontSize: initialsSize }]}>{initialsOf(name)}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  /** `'#fff'` là ngoại lệ được tha trong style.convention §1 — chữ trên nền màu đậm. */
  initials: { fontFamily: F.uiBold, color: '#fff' },
});
