import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MAX_PHOTOS, type ListingPhoto } from '@/queries/upload';
import { useToast } from './Toast';
import { C, F, shadow } from '@/theme';

/** Nghiêng nhẹ mỗi thumbnail như ảnh ghim lên bảng — cùng ý đồ với TILTS của NoteCard */
const TILTS = [-2, 1.6, -1, 1.4, -0.6, 2];

/**
 * Ô chọn ảnh cho tin đăng. Chỉ chọn ảnh local rồi báo lên trên — upload do
 * `useListingPhotos` ở `@/queries/upload` lo, component không tự gọi mutation.
 * Trạng thái từng ảnh hiện ngay trên thumbnail: đang tải · xong · lỗi (chạm để thử lại).
 */
export function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  onRetry,
}: {
  photos: ListingPhoto[];
  onAdd: (uris: string[]) => void;
  onRemove: (uri: string) => void;
  onRetry: (uri: string) => void;
}) {
  const toast = useToast();
  const remaining = MAX_PHOTOS - photos.length;
  // Gộp về một dòng thay vì hiện trên từng thumbnail: 96px không đủ chỗ cho câu lỗi, và 6 ảnh
  // hỏng cùng lý do thì lặp 6 lần là nhiễu. Vẫn inline nên bề mặt lỗi vẫn là một (§9).
  const failedReason = photos.find((p) => p.status === 'error')?.error;

  const pick = async () => {
    if (remaining <= 0) {
      toast(`⚠️ Mỗi tin tối đa ${MAX_PHOTOS} ảnh`);
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('⚠️ Cần quyền truy cập thư viện ảnh để chọn ảnh');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      // `allowsEditing` bị bỏ qua khi chọn nhiều ảnh — cắt ảnh hàng loạt không được hỗ trợ
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      // Nén ngay trên máy: ảnh gốc điện thoại 3-12MB, upload bằng 3G sẽ treo rất lâu
      quality: 0.7,
    });
    if (res.canceled) return;

    onAdd(res.assets.map((a) => a.uri));
  };

  if (photos.length === 0) {
    return (
      <Pressable onPress={pick} style={styles.dropZone}>
        <View style={styles.clip} />
        <Text style={{ fontSize: 26 }}>📎</Text>
        <Text style={styles.dropText}>Chạm để thêm ảnh · tối đa {MAX_PHOTOS}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {/* Layout animation (`entering`) và `transform` phải nằm trên hai lớp khác nhau:
            để chung một view thì entering ghi đè transform lúc chạy — Reanimated 4 cảnh báo
            "Property 'transform' of AnimatedComponent(View) may be overwritten". Lớp ngoài
            nhận entering, lớp trong giữ góc nghiêng. */}
        {photos.map((photo, i) => (
          <Animated.View key={photo.uri} entering={FadeInDown.delay(i * 60).duration(300).springify()}>
            <View style={[styles.slot, { transform: [{ rotate: `${TILTS[i % TILTS.length]}deg` }] }]}>
              <Pressable
                onPress={() => photo.status === 'error' && onRetry(photo.uri)}
                style={styles.thumbBox}
              >
                <Image source={{ uri: photo.uri }} style={styles.thumb} resizeMode="cover" />

                {photo.status === 'uploading' && (
                  <View style={styles.overlay}>
                    <ActivityIndicator color={C.paperWarm} size="small" />
                  </View>
                )}

                {photo.status === 'error' && (
                  <View style={[styles.overlay, styles.overlayError]}>
                    <Text style={styles.retryText}>⟳ Thử lại</Text>
                  </View>
                )}
              </Pressable>

              {photo.status === 'done' && i === 0 && (
                <View style={styles.coverTag}>
                  <Text style={styles.coverText}>Ảnh bìa</Text>
                </View>
              )}

              <Pressable onPress={() => onRemove(photo.uri)} hitSlop={10} style={styles.remove}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          </Animated.View>
        ))}

        {remaining > 0 && (
          <Pressable onPress={pick} style={styles.addTile}>
            <Text style={{ fontSize: 22 }}>📎</Text>
            <Text style={styles.addText}>Thêm</Text>
          </Pressable>
        )}
      </ScrollView>

      <Text style={styles.counter}>
        {photos.length}/{MAX_PHOTOS} ảnh · ảnh đầu tiên dùng làm ảnh bìa
      </Text>
      {failedReason && <Text style={styles.failReason}>⚠️ {failedReason}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: C.cork,
    borderRadius: 10,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: C.paperWarm,
  },
  clip: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 22,
    height: 34,
    borderWidth: 4,
    borderColor: C.corkDark,
    borderRadius: 8,
  },
  dropText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft },

  wrap: { marginTop: 12, marginBottom: 20 },
  row: { gap: 12, paddingVertical: 8, paddingRight: 8 },
  slot: {
    width: 96,
    height: 96,
    borderRadius: 6,
    backgroundColor: C.paperWarm,
    padding: 4,
    ...shadow,
  },
  thumbBox: { flex: 1, borderRadius: 4, overflow: 'hidden' },
  thumb: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: C.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayError: { backgroundColor: C.scrimError },
  retryText: { color: '#fff', fontFamily: F.uiBold, fontSize: 11 },
  coverTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: C.moss,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  coverText: { color: '#fff', fontFamily: F.uiBold, fontSize: 9 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.pin,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.paperWarm,
  },
  removeText: { color: '#fff', fontFamily: F.uiBold, fontSize: 10, lineHeight: 13 },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.cork,
    backgroundColor: C.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: { fontFamily: F.uiSemi, fontSize: 11.5, color: C.inkSoft },
  counter: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 4 },
  failReason: { fontFamily: F.uiSemi, fontSize: 11.5, color: C.pinDark, marginTop: 4 },
});
