import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ListingPhoto } from './ListingPhoto';
import { Loading } from './ui';
import { useListingSuggestions } from '@/queries/listings';
import type { Listing } from '@/api/db';
import { C, F, shadow } from '@/theme';

/**
 * Dải "tin tương tự" dưới chân trang chi tiết — MỘT tin mỗi trang, lướt ngang để sang tin kế.
 *
 * Bản trước là hàng thẻ 148px cuộn tự do: nhét được 2,5 thẻ vào màn nên chữ phải bé và tiêu đề
 * cắt ở hai dòng, mà cuộn thì dừng lửng giữa hai thẻ. Một tin một trang đổi lại được cả ba —
 * ảnh lớn hơn, tiêu đề đọc trọn, và mỗi lượt lướt đậu đúng một tin.
 *
 * Vẫn là hàng NGANG chứ không phải lưới dọc: đây là phần phụ của trang. Lưới dọc sẽ đẩy nút
 * "Liên hệ người bán" ra khỏi tầm mắt và biến trang chi tiết thành bảng tin thứ hai.
 *
 * KHÔNG hiện gì khi rỗng — kể cả tiêu đề. Một mục "Tin tương tự" trống trơn khiến người xem
 * tưởng màn hình hỏng, trong khi sự thật chỉ là danh mục đó chưa có tin nào khác.
 */

/** Lề ngang của cả khối, hai bên. */
const EDGE = 20;

/**
 * Bề ngang thẻ hụt đi bấy nhiêu so với khoảng trống, để ló mép thẻ kế.
 *
 * Thẻ đúng bằng full-width thì không có gì cho biết chỗ này lướt được — người dùng đọc nó như
 * một tin đơn lẻ rồi cuộn qua. Cùng con số và cùng lý do với `FeaturedStrip` ở bảng tin.
 */
const PEEK = 20;
const GAP = 11;

export function ListingSuggestions({ current }: { current: Listing }) {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const { data, isLoading } = useListingSuggestions(current);
  const [page, setPage] = useState(0);

  // Lỗi tải cũng im lặng: gợi ý là phần thêm, dựng một bảng lỗi ở đây sẽ chen ngang thứ người
  // dùng đang thật sự đọc. Lỗi thật của trang đã có bề mặt riêng ở màn chi tiết (HARD#6).
  if (isLoading) return <Loading />;
  if (!data?.length) return null;

  const cardW = winW - EDGE * 2 - PEEK;
  const stride = cardW + GAP;

  /**
   * Trang hiện tại, suy từ vị trí cuộn.
   *
   * Nghe CẢ `onMomentumScrollEnd` lẫn `onScrollEndDrag`: cú lướt nhanh có quán tính nên chỉ sự
   * kiện đầu bắn, còn cú kéo chậm rồi nhả tay thì không sinh quán tính và chỉ sự kiện sau bắn.
   * Thiếu một trong hai là chấm chỉ trang đứng lại ở chỗ cũ cho đúng một nửa số cách lướt.
   *
   * Không tính trong `onScroll`: mỗi frame một lượt `setState` là đúng nguồn giật đã gặp ở
   * thanh đầu bảng tin — mà ở đây chấm chỉ trang chỉ cần đúng lúc lướt xong.
   */
  const syncPage = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / stride);
    setPage(Math.max(0, Math.min(next, data.length - 1)));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>Tin tương tự</Text>
        {/* Số trang bằng chữ, cạnh tiêu đề: chấm ở dưới nói "còn nữa", con số nói "còn bao nhiêu". */}
        <Text style={styles.counter}>
          {page + 1}/{data.length}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        // Lướt là đậu đúng mép một thẻ, không dừng lửng giữa hai tin.
        snapToInterval={stride}
        decelerationRate="fast"
        onMomentumScrollEnd={syncPage}
        onScrollEndDrag={syncPage}
      >
        {data.map((item) => (
          <Pressable
            key={item.id}
            // `replace` chứ không `push`: bấm chuyền từ tin này sang tin khác mười lần rồi bấm
            // back mười lần mới thoát được là cách chắc chắn nhất để mất người xem.
            onPress={() => router.replace(`/listing/${item.id}`)}
            style={({ pressed }) => [styles.card, { width: cardW }, pressed && { opacity: 0.85 }]}
          >
            {/*
              Ảnh sang BÊN TRÁI, không nằm trên như bản thẻ hẹp.
              Ở bề ngang gần hết màn, ảnh đặt trên đẩy thẻ cao gần 300px — đúng thứ docblock
              trên cảnh báo: nó chiếm chỗ của nút liên hệ. Nằm ngang thì thẻ cao ~120px mà ảnh
              vẫn lớn hơn hẳn 96px của bản cũ.
            */}
            <ListingPhoto
              photo={item.photo}
              photoUrl={item.photoUrls?.[0]}
              style={styles.thumb}
              imageStyle={styles.thumbRadius}
            />
            <View style={styles.body}>
              <Text numberOfLines={2} style={styles.title}>
                {item.title}
              </Text>
              <Text style={styles.price}>{item.price}</Text>
              {!!item.province && (
                <Text numberOfLines={1} style={styles.where}>
                  📍 {item.province}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/*
        Chấm chỉ trang — chỉ dựng khi có nhiều hơn một tin. Một chấm đơn độc không chỉ ra điều
        gì, nó chỉ là một hạt bụi giữa trang.
      */}
      {data.length > 1 && (
        <View style={styles.dots}>
          {data.map((item, i) => (
            <View key={item.id} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: EDGE,
    marginBottom: 10,
  },
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
  },
  counter: { fontFamily: F.mono, fontSize: 11, color: C.muted },
  rail: { paddingHorizontal: EDGE, gap: GAP },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 10,
    ...shadow,
  },
  thumb: { width: 104, height: 104, borderRadius: 8, overflow: 'hidden' },
  thumbRadius: { borderRadius: 8 },
  /** `flex: 1` + `minWidth: 0`: thiếu nó thì tiêu đề dài đẩy thẻ rộng ra ngoài bề ngang đã tính. */
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: F.uiBold, fontSize: 14, color: C.ink, lineHeight: 19 },
  price: { fontFamily: F.monoBold, fontSize: 15, color: C.moss },
  where: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.lineInput },
  dotOn: { backgroundColor: C.moss, width: 16 },
});
