import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Listing } from '@/api/db';
import { ListingPhoto } from './ListingPhoto';
import { C, F, shadow } from '@/theme';

/**
 * Một tin ở dạng DÒNG GỌN: ảnh 64 + tiêu đề 2 dòng + giá + meta.
 *
 * Tách ra từ `app/search.tsx` để màn nhóm dùng CÙNG một bộ layout: hai màn cùng hình dạng mà
 * nuôi hai bản style là hai bản sẽ lệch nhau ngay ở lần sửa thứ hai.
 *
 * Cố tình KHÔNG có nút lưu/nhắn tin như `FeedCard`: dòng này để quét nhanh cả danh sách, hành
 * động nằm ở màn chi tiết. Nhét nút vào đây là nhân đôi bề mặt hành động cho cùng một tin.
 */
export function ListingRow({
  item,
  index,
  onPress,
}: {
  item: Listing;
  index: number;
  onPress: () => void;
}) {
  return (
    // Chặn độ trễ ở mốc thứ 5 như `FeedCard`: danh sách dài không giới hạn, nhân thẳng `index`
    // thì tin thứ 20 vào màn sau hơn một giây — nhìn như treo, không như hiệu ứng.
    <Animated.View entering={FadeInDown.delay(Math.min(index, 4) * 60).duration(320)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <ListingPhoto
          photo={item.photo}
          photoUrl={item.photoUrls?.[0]}
          style={styles.photo}
          imageStyle={styles.photoRadius}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          <Text style={styles.price}>{item.price}</Text>
          <Text style={styles.meta}>{item.meta}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 10,
    ...shadow,
  },
  photo: { width: 64, height: 64, borderRadius: 6 },
  photoRadius: { borderRadius: 6 },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 3 },
  price: { fontFamily: F.monoBold, fontSize: 12, color: C.moss, marginBottom: 3 },
  meta: { fontFamily: F.ui, fontSize: 10.5, color: C.inkSoft },
});
