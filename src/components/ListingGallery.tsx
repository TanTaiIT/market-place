import React, { useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ListingPhoto } from './ListingPhoto';
import { C, type Grad } from '@/theme';

/**
 * Hero của màn chi tiết: vuốt ngang qua các ảnh đã upload, kèm chấm chỉ vị trí.
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
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={{ width, height: '100%' }} resizeMode="cover" />
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
    </View>
  );
}

const styles = StyleSheet.create({
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
