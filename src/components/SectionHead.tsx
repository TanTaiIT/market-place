import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, S, T } from '@/theme';

/**
 * Đầu một mục của bảng tin: tiêu đề, dòng phụ tuỳ chọn, và lối "Xem tất cả ›".
 *
 * Dựng riêng vì hai file dải (`FeedStrips`, `FeedHighlights`) trước đây mỗi bên tự khai một
 * `styles.heading` với cùng những con số — và tôi đã phải viết chú thích "khớp từng số" ở cả
 * hai chỗ để nhắc người sau đừng làm lệch. Chú thích đó là dấu hiệu của một component còn
 * thiếu, không phải một quy ước cần nhớ.
 *
 * `onSeeAll` là thứ đổi cách đọc cả màn, không chỉ là một cái nút: có nó thì mỗi dải chỉ cần
 * bày 3–4 thẻ rồi mời người dùng đi sâu, thay vì kéo một hàng ngang dài mà phần lớn nội dung
 * nằm ngoài mép phải và không ai biết còn bao nhiêu nữa. Dải nào KHÔNG có đích đến thật thì
 * đừng truyền — một nút dẫn tới chính nó là lời hứa suông.
 */
export function SectionHead({
  title,
  note,
  onSeeAll,
}: {
  title: string;
  /** Dòng giải thích dưới tiêu đề. Chỉ dùng khi mục cần nói ra TIÊU CHÍ của nó (vd "quanh bạn"). */
  note?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {!!onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={styles.seeAll}>Xem tất cả ›</Text>
          </Pressable>
        )}
      </View>
      {!!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Khoảng cách xuống dải nằm ở ĐÂY, không ở từng `heading` như trước — nhờ vậy mục có dòng phụ
   * và mục không có dòng phụ cùng cách dải một khoảng, và cái lề âm `marginTop: -S.sm` mà bản
   * trước phải dùng để kéo dòng phụ lên sát tiêu đề biến mất.
   */
  wrap: { marginBottom: S.md },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm },
  title: { flex: 1, fontFamily: F.uiBold, ...T.lg, color: C.ink },
  /** `T.sm` chứ không `T.xs`: đây là chỗ bấm được, nhỏ quá thì vừa khó đọc vừa khó chạm. */
  seeAll: { fontFamily: F.uiBold, ...T.sm, color: C.brandTx },
  note: { fontFamily: F.ui, ...T.xs, color: C.inkSoft, marginTop: S.xs },
});
