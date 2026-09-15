import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ListingSlide, SlideRow } from './ListingSlide';
import { SectionHead } from './SectionHead';
import { useSuggestedListings } from '@/queries/suggested';
import { S } from '@/theme';

/**
 * "Gợi ý cho bạn" — dải thay chỗ "Xem gần đây" ở trang chủ.
 *
 * Thay vì bày lại đúng những tin người dùng vừa mở, nó dùng lịch sử đó làm TÍN HIỆU rồi đi
 * tìm tin mới cùng gu, và loại thẳng những tin đã xem ra khỏi kết quả. Không loại thì dải này
 * chỉ là "Xem gần đây" đội tên khác — chính điều nó được dựng ra để thay.
 *
 * Toàn bộ việc xếp hạng nằm ở `queries/suggested`; component này không biết gì về lịch sử xem
 * hay lịch sử tìm, và đó là ranh giới giữ cho nó chỉ còn là một khối bày.
 *
 * KHÔNG có "Xem tất cả ›": không trang nào bày được tập tin này. Nó là kết quả của một phép
 * trộn ở máy, không phải một bộ lọc mà `/search/results` dựng lại được từ URL.
 */
export function FeedSuggested({ grid, onOpen }: { grid?: boolean; onOpen: (id: string) => void }) {
  const { data, isPending, fallback } = useSuggestedListings();

  /*
   * Đang tải cũng giấu, không hiện khung xương.
   *
   * Dải này nằm giữa bốn dải khác đều vẽ ngay từ cache, nên một khối xương nhấp nháy ở giữa
   * màn đọc ra là lỗi chứ không phải là chờ. Rỗng thì giấu luôn — cùng luật với mọi dải khác
   * của trang Khám phá.
   */
  if (isPending || !data?.length) return null;

  return (
    <View style={[styles.block, grid && styles.inset]}>
      <SectionHead
        title="Gợi ý cho bạn"
        // Nói ra TIÊU CHÍ khi nó không phải thứ người dùng đoán được: chưa có lịch sử nào thì
        // dải đang chạy bằng khu vực, và gọi nó là "gợi ý" mà không nói gì là một lời hứa suông.
        note={fallback ? 'tin quanh khu vực của bạn' : undefined}
      />
      <SlideRow>
        {data.map((item) => (
          <ListingSlide key={item.id} item={item} onPress={() => onOpen(item.id)} />
        ))}
      </SlideRow>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Hai dòng này KHỚP TỪNG SỐ với `FeedHighlights`/`FeedStrips`: ba file cùng vẽ 'một mục của
     bảng tin', lệch nhau vài pixel là mắt đọc ra ba nhịp khác nhau trên cùng một màn cuộn. */
  block: { marginBottom: S.xl },
  inset: { paddingHorizontal: S.lg },
});
