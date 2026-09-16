import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListingSlide, SlideRow } from './ListingSlide';
import { SectionHead } from './SectionHead';
import { Loading } from './ui';
import { useListingSuggestions } from '@/queries/listings';
import type { Listing } from '@/api/db';
import { S } from '@/theme';

/**
 * Dải "Tin tương tự" dưới chân trang chi tiết.
 *
 * Dùng ĐÚNG `SlideRow` + `ListingSlide` của trang chủ, không dựng thẻ riêng. Bản trước cũng
 * trượt một-thẻ-một-màn, nhưng bằng thẻ DÒNG NGANG tự khai số đo (ảnh 104px bên trái) — nên
 * cùng một tin đọc ở hai nơi ra hai hình dạng khác nhau. Đó đúng là thứ `ListingSlide` được
 * tách ra để chấm dứt; xem docblock của nó.
 *
 * Vẫn là hàng NGANG chứ không phải lưới dọc: đây là phần phụ của trang. Lưới dọc sẽ đẩy nút
 * "Nhắn cho người bán" ra khỏi tầm mắt và biến trang chi tiết thành bảng tin thứ hai.
 *
 * KHÔNG hiện gì khi rỗng — kể cả tiêu đề. Một mục "Tin tương tự" trống trơn khiến người xem
 * tưởng màn hình hỏng, trong khi sự thật chỉ là danh mục đó chưa có tin nào khác.
 *
 * Bỏ chấm chỉ trang + số trang của bản cũ: mép thẻ kế luôn ló ra (`SlideRow` chừa sẵn 20px)
 * nên "còn nữa" đã nhìn thấy được, và mọi dải khác trong app đều không có chúng.
 */
export function ListingSuggestions({ current }: { current: Listing }) {
  const router = useRouter();
  const { data, isLoading } = useListingSuggestions(current);

  // Lỗi tải cũng im lặng: gợi ý là phần thêm, dựng một bảng lỗi ở đây sẽ chen ngang thứ người
  // dùng đang thật sự đọc. Lỗi thật của trang đã có bề mặt riêng ở màn chi tiết (HARD#6).
  if (isLoading) return <Loading />;
  if (!data?.length) return null;

  return (
    <View style={styles.block}>
      <SectionHead title="Tin tương tự" />
      <SlideRow>
        {data.map((item) => (
          <ListingSlide
            key={item.id}
            item={item}
            // `replace` chứ không `push`: bấm chuyền từ tin này sang tin khác mười lần rồi bấm
            // back mười lần mới thoát được là cách chắc chắn nhất để mất người xem.
            onPress={() => router.replace(`/listing/${item.id}`)}
          />
        ))}
      </SlideRow>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Tự bù lề ngang. Khác các dải ở trang chủ, dải này là con TRỰC TIẾP của `ScrollView` màn chi
   * tiết chứ không nằm trong khối `body` vốn đã có lề — không bù thì thẻ dính sát mép màn.
   *
   * Dùng `S.lg` (16) đúng bằng lề của `SlideRow` ở trang chủ, để bề ngang thẻ khớp nhau: cùng
   * một thẻ mà hai màn rộng khác nhau vài pixel là mắt đọc ra ngay.
   */
  block: { marginTop: S.xl, paddingHorizontal: S.lg },
});
