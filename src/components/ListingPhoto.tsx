import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Grad } from '@/theme';

/**
 * **Ảnh bìa** của một tin đăng — call-site truyền `listing.photoUrls?.[0]`.
 * Có ảnh thật thì hiện ảnh, chưa có thì rơi về cặp màu gradient (6 tin mẫu trong `db.ts`
 * đều thuộc nhánh sau). Cần xem cả bộ ảnh thì dùng `ListingGallery`.
 */
export function ListingPhoto({
  photo,
  photoUrl,
  style,
  imageStyle,
  children,
}: {
  photo: Grad;
  photoUrl?: string;
  style?: StyleProp<ViewStyle>;
  /** Bo góc cho riêng ảnh — View cha không truyền `borderRadius` xuống `Image` được */
  imageStyle?: StyleProp<ImageStyle>;
  children?: React.ReactNode;
}) {
  if (photoUrl) {
    return (
      <View style={style}>
        <Image
          source={{ uri: photoUrl }}
          style={[StyleSheet.absoluteFill, imageStyle]}
          resizeMode="cover"
        />
        {children}
      </View>
    );
  }

  return (
    <LinearGradient colors={photo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}
