import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ListingPhoto } from './ListingPhoto';
import type { Listing } from '@/api/db';
import { C, F, R, S, T, shadow } from '@/theme';

/**
 * Thẻ tin của một dải lướt ngang, và cái khung cuộn đi kèm.
 *
 * Dựng riêng vì đây là dải thứ BA vẽ cùng loại thẻ (`FeaturedStrip`, `SuggestedStrip`, và
 * trước đó là `RecentStrip`). Hai dải đầu từng ở chung một file nên dùng chung `styles.feat*`
 * được; dải thứ ba nằm ở file khác, và chép bộ số sang đó là đúng cái smell mà `SectionHead`
 * đã phải tách ra để chữa — hai bản sao rồi sẽ lệch nhau vài pixel, và người dùng đọc ra
 * ngay là hai dải khác nhau trên cùng một màn cuộn.
 */

/** Khoảng hở giữa hai thẻ. Phải khớp `snapToInterval` nên nó là hằng số, không phải `S.*`. */
const GAP = 11;

/**
 * Mỗi slide to bằng MỘT thẻ tin của bảng (full bề ngang trừ lề 16 hai bên), chỉ hụt thêm 20px
 * để ló mép thẻ kế — không có mép ló thì thẻ full-width trông như một tin của bảng và chẳng
 * ai biết chỗ này lướt ngang được.
 */
function useSlideWidth(): number {
  const { width } = useWindowDimensions();
  return width - 32 - 20;
}

/** Khung cuộn: giữ luôn phần `snapToInterval` để mọi dải đậu đúng mép thẻ, không dừng lửng. */
export function SlideRow({ children }: { children: React.ReactNode }) {
  const cardW = useSlideWidth();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      snapToInterval={cardW + GAP}
      decelerationRate="fast"
    >
      {children}
    </ScrollView>
  );
}

export function ListingSlide({ item, onPress }: { item: Listing; onPress: () => void }) {
  const cardW = useSlideWidth();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width: cardW }, pressed && { opacity: 0.9 }]}
    >
      <ListingPhoto
        photo={item.photo}
        photoUrl={item.photoUrls?.[0]}
        style={styles.photo}
        imageStyle={styles.photoRadius}
      >
        <View style={styles.price}>
          <Text style={styles.priceText}>{item.price}</Text>
        </View>
      </ListingPhoto>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {item.favoriteCount > 0 ? `❤️ ${item.favoriteCount} quan tâm · ` : ''}
          👁 {item.viewCount} lượt xem
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* Dải cuộn ngang tràn ra ngoài lề của danh sách, nên tự bù lề bằng `paddingRight`. */
  row: { gap: GAP, paddingRight: S.xs },

  card: { backgroundColor: C.paperWarm, borderRadius: R.md, ...shadow },
  photo: { height: 200, borderTopLeftRadius: R.md, borderTopRightRadius: R.md },
  photoRadius: { borderTopLeftRadius: R.md, borderTopRightRadius: R.md },
  /** Nhãn giá đè góc ảnh — cùng thủ pháp `priceTag` của NoteCard, người dùng đã quen mắt. */
  price: {
    position: 'absolute',
    left: S.lg,
    bottom: -2,
    backgroundColor: C.brandDark,
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 1,
    borderRadius: R.sm,
    borderBottomLeftRadius: 0,
  },
  priceText: { color: '#fff', fontFamily: F.monoBold, ...T.sm },
  body: { padding: S.lg },
  /* Tiêu đề thẻ ở `T.md` (15/22), không phải 19/25. Cỡ 19 trên một thẻ ngang 280pt ăn hết hai
     dòng cho một tiêu đề, đẩy phần meta xuống và làm thẻ trông đầy; 15 với `lineHeight` 1.47×
     vừa gọn vừa đủ chỗ cho dấu tiếng Việt. */
  title: { fontFamily: F.uiBold, ...T.md, color: C.ink },
  meta: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginTop: S.sm },
});
