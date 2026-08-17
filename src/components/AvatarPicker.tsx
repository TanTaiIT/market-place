import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/api/cloudinary';
import { Avatar } from './ui';
import { useToast } from './Toast';
import { C, F, shadow } from '@/theme';

/**
 * Chọn và tải ảnh đại diện.
 *
 * Upload NGAY khi chọn rồi trả URL lên, không đợi lúc bấm Lưu — người dùng thấy ảnh mới trong
 * vòng tròn là biết nó đã lên thật, thay vì bấm Lưu rồi mới biết ảnh hỏng.
 *
 * Đánh đổi giống `useListingPhotos`: chọn ảnh rồi bỏ ngang form sẽ để lại ảnh mồ côi trên
 * Cloudinary. Xoá cần chữ ký nên là việc của BE, FE không làm được.
 *
 * Tự gọi `uploadImage` (không phải mutation của TanStack) vì đây không phải server state của
 * app: nó là một lượt POST sang Cloudinary, không có cache nào để invalidate.
 */
export function AvatarPicker({
  initials,
  url,
  onChange,
}: {
  /** Chữ viết tắt để vẽ khi chưa có ảnh — `Profile.avatar`. */
  initials: string;
  url?: string;
  onChange: (url: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('⚠️ Cần quyền truy cập thư viện ảnh');

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      // Ép vuông ngay lúc chọn: avatar hiển thị trong vòng tròn ở mọi màn, ảnh ngang sẽ bị cắt
      // mất hai đầu mà người dùng không kiểm soát được cắt chỗ nào.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled) return;

    setBusy(true);
    try {
      onChange(await uploadImage(res.assets[0].uri));
    } catch (e) {
      toast(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={pick} disabled={busy} style={styles.tap}>
        {/* `Avatar` tự lo cả hai nhánh ảnh/chữ viết tắt — không dựng `<Image>` riêng ở đây, nếu
            không thì viền và bo góc phải giữ khớp với nó bằng tay ở hai chỗ. */}
        <Avatar text={initials} url={url} size={84} ring />
        <View style={styles.badge}>
          {busy ? (
            <ActivityIndicator size="small" color={C.paperWarm} />
          ) : (
            <Text style={styles.badgeGlyph}>✎</Text>
          )}
        </View>
      </Pressable>
      <Text style={styles.hint}>{busy ? 'Đang tải ảnh lên...' : 'Chạm để đổi ảnh'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 22 },
  tap: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.pin,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  badgeGlyph: { fontSize: 14, color: C.paperWarm },
  hint: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 10 },
});
