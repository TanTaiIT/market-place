import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ScreenHeader } from '@/components/ui';
import { LEGAL_UPDATED, SITE, legalArticle } from '@/api/legal';
import { C, F, S, T } from '@/theme';

/**
 * Trang bài viết pháp lý — phần ĐỌC của cụm tạm thời; công thức gỡ nằm ở `@/api/legal`.
 *
 * Một route động cho cả mười bài thay vì mười file trong `app/**`: bài viết khác nhau ở
 * CHỮ chứ không ở cách bày, và mười file rỗng ruột là mười chỗ phải xoá lúc gỡ.
 *
 * Không guard đăng nhập (`app/_layout.tsx` khai nó ở khối công khai). Cả điểm của cụm này là
 * công bố cho người chưa có tài khoản đọc — bắt đăng nhập là tự vô hiệu hoá nó.
 */

/** Tiền tố đánh dấu tiêu đề phụ trong `body` — xem `LegalArticle.body`. */
const HEAD = '## ';

export default function LegalPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const article = legalArticle(slug);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Tiêu đề thanh đầu là TÊN SÀN, không phải tên bài: tên bài dài tới 9 chữ, và thanh
          đầu không xuống dòng được. Tên bài làm tiêu đề lớn ngay đầu phần cuộn. */}
      <ScreenHeader title={SITE.brand} />

      {article ? (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>{article.title}</Text>
          <Text style={styles.updated}>Cập nhật ngày {LEGAL_UPDATED}</Text>
          {article.body.map((para) =>
            para.startsWith(HEAD) ? (
              <Text key={para} style={styles.h2}>
                {para.slice(HEAD.length)}
              </Text>
            ) : (
              <Text key={para} style={styles.p}>
                {para}
              </Text>
            ),
          )}
        </ScrollView>
      ) : (
        <EmptyState icon="📄" text="Mục này chưa có nội dung công bố." />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xxl },

  h1: { fontFamily: F.uiBlack, ...T.xl, color: C.ink },
  updated: { fontFamily: F.ui, ...T.xs, color: C.muted, marginTop: S.xs, marginBottom: S.lg },
  h2: { fontFamily: F.uiBold, ...T.md, color: C.ink, marginTop: S.xl, marginBottom: S.sm },
  /*
   * `T.sm` (13/19) chứ không `T.md`: đây là văn bản DÀI, và ở cỡ thân mặc định thì mỗi bài
   * thành một bức tường chữ trên màn điện thoại. Bù lại bằng `marginBottom` rộng giữa các
   * đoạn — mắt bám dòng bằng khoảng trắng, không bằng cỡ chữ.
   */
  p: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginBottom: S.md },
});
