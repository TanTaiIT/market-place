import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListingPhoto } from './ListingPhoto';
import { Loading } from './ui';
import { useListingSuggestions } from '@/queries/listings';
import type { Listing } from '@/api/db';
import { C, F, shadow } from '@/theme';

/**
 * Dải "tin tương tự" dưới chân trang chi tiết.
 *
 * Hàng ngang chứ không phải lưới: đây là phần phụ của trang, một lưới dọc sẽ đẩy nút "Liên hệ
 * người bán" ra khỏi tầm mắt và biến trang chi tiết thành bảng tin thứ hai.
 *
 * KHÔNG hiện gì khi rỗng — kể cả tiêu đề. Một mục "Tin tương tự" trống trơn khiến người xem
 * tưởng màn hình hỏng, trong khi sự thật chỉ là danh mục đó chưa có tin nào khác.
 */
export function ListingSuggestions({ current }: { current: Listing }) {
  const router = useRouter();
  const { data, isLoading } = useListingSuggestions(current);

  // Lỗi tải cũng im lặng: gợi ý là phần thêm, dựng một bảng lỗi ở đây sẽ chen ngang thứ người
  // dùng đang thật sự đọc. Lỗi thật của trang đã có bề mặt riêng ở màn chi tiết (HARD#6).
  if (isLoading) return <Loading />;
  if (!data?.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Tin tương tự</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {data.map((item) => (
          <Pressable
            key={item.id}
            // `replace` chứ không `push`: bấm chuyền từ tin này sang tin khác mười lần rồi bấm
            // back mười lần mới thoát được là cách chắc chắn nhất để mất người xem.
            onPress={() => router.replace(`/listing/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <ListingPhoto
              photo={item.photo}
              photoUrl={item.photoUrls?.[0]}
              style={styles.thumb}
              imageStyle={styles.thumbRadius}
            />
            <Text numberOfLines={2} style={styles.title}>
              {item.title}
            </Text>
            <Text style={styles.price}>{item.price}</Text>
            {!!item.province && (
              <Text numberOfLines={1} style={styles.where}>
                {item.province}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  rail: { paddingHorizontal: 20, gap: 12 },
  card: {
    width: 148,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 8,
    ...shadow,
  },
  thumb: { height: 96, borderRadius: 6, marginBottom: 8 },
  thumbRadius: { borderRadius: 6 },
  title: { fontFamily: F.uiBold, fontSize: 12, color: C.ink, lineHeight: 16 },
  price: { fontFamily: F.monoBold, fontSize: 13, color: C.moss, marginTop: 4 },
  where: { fontFamily: F.ui, fontSize: 10.5, color: C.inkSoft, marginTop: 2 },
});
