import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { displayUrl } from '@/api/cloudinary';
import type { Grad } from '@/theme';

/**
 * **Ảnh bìa** của một tin đăng — call-site truyền `listing.photoUrls?.[0]`.
 * Có ảnh thật thì hiện ảnh, chưa có thì rơi về cặp màu gradient suy từ id (`gradOf`).
 * Cần xem cả bộ ảnh thì dùng `ListingGallery`.
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
        {/* 800px cho MỌI thumbnail: thẻ rộng nhất (`ListingCard`) chỉ ~400pt logic, 800 là đủ
            cho màn 2x mà vẫn nhẹ hơn ảnh gốc 3-5 lần. Cần ảnh to hơn thì là việc của
            `ListingGallery`/`PhotoViewer`, không phải của thẻ. */}
        <Image
          source={{ uri: displayUrl(photoUrl, 800) }}
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
