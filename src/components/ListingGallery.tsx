import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ListingPhoto } from './ListingPhoto';
import { PhotoViewer } from './PhotoViewer';
import { C, type Grad } from '@/theme';

/**
 * Hero của màn chi tiết: vuốt ngang qua các ảnh đã upload, kèm chấm chỉ vị trí.
 * Chạm vào ảnh thì mở `PhotoViewer` xem toàn màn — hero chỉ cao 260px, không đủ để soi món hàng.
 * Tin chưa có ảnh thật thì uỷ lại cho `ListingPhoto` dựng gradient.
 */
export function ListingGallery({
  photo,
  photoUrls,
  style,
  children,
}: {
  photo: Grad;
  photoUrls?: string[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  /** Ảnh đang mở toàn màn; `null` là đang đóng. Không dùng cờ boolean vì còn cần biết mở từ ảnh nào. */
  const [viewing, setViewing] = useState<number | null>(null);
  const urls = photoUrls ?? [];

  if (urls.length === 0) {
    return (
      <ListingPhoto photo={photo} style={style}>
        {children}
      </ListingPhoto>
    );
  }

  return (
    <View style={style}>
      <FlatList
        data={urls}
        keyExtractor={(url) => url}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
        // Suy trang từ offset thay vì onViewableItemsChanged: rẻ hơn và đủ chính xác khi đã pagingEnabled
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => setViewing(i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Xem ảnh ${i + 1} toàn màn hình`}
            // Kích thước phải đặt ở ĐÂY: `height: '100%'` của ảnh tính theo cha, mà Pressable
            // để cao tự động thì cha không có chiều cao và ảnh xẹp còn 0.
            style={{ width, height: '100%' }}
          >
            <Image source={{ uri: item }} style={styles.photo} resizeMode="cover" />
          </Pressable>
        )}
      />

      {urls.length > 1 && (
        <View style={styles.dots}>
          {urls.map((url, i) => (
            <View key={url} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}

      {children}

      {viewing !== null && (
        <PhotoViewer urls={urls} index={viewing} onClose={() => setViewing(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
  dots: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: C.scrim,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.paperWarm, opacity: 0.5 },
  dotActive: { opacity: 1, backgroundColor: C.tape },
});
