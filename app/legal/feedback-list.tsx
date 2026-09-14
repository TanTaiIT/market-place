import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, PagedFooter, ScreenHeader } from '@/components/ui';
import { usePublishedFeedback } from '@/queries/social-feedback';
import { C, F, R, S, T } from '@/theme';

/**
 * Danh sách đánh giá đã công bố — cụm tạm thời, gỡ theo `@/api/legal`.
 *
 * Bản web bày bảng 5 cột (ID · Tên tổ chức · Số quyết định · Nội dung · Ngày gửi). Ở đây là
 * THẺ, không phải bảng: 5 cột trên màn điện thoại thì cột "Nội dung" còn chừng 12 ký tự, và
 * một bảng cuộn ngang là thứ không ai đọc hết.
 *
 * Cột ID bỏ hẳn. Nó là khoá nội bộ của DB, người đọc không dùng được vào việc gì — mà dãy số
 * đứt quãng của nó lại tố cáo chính xác bao nhiêu ý kiến đã bị lọc, đúng thứ không nên in lên
 * một trang công bố pháp lý.
 */
export default function SocialFeedbackList() {
  const { data, error, isLoading, loadMore, isFetchingNextPage, total } = usePublishedFeedback();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Danh sách đánh giá" />
      <FlatList
        data={data ?? []}
        keyExtractor={(row) => row.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          data?.length ? <Text style={styles.count}>{total} ý kiến đã công bố</Text> : undefined
        }
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.org}>{item.orgName}</Text>
            <Text style={styles.meta}>
              Số quyết định {item.decisionNo} · {dayOf(item.createdAt)}
            </Text>
            <Text style={styles.content}>{item.content}</Text>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState icon="📭" text="Chưa có ý kiến nào được công bố." />
          )
        }
      />
    </SafeAreaView>
  );
}

/**
 * `dd/mm/yyyy` ghép tay, không `toLocaleDateString`: Hermes không mang đủ dữ liệu Intl nên hàm
 * đó cho ra định dạng khác nhau giữa các máy — cùng lý do các chỗ khác trong app tự ghép.
 */
function dayOf(iso: string): string {
  const at = new Date(iso);
  const dd = String(at.getDate()).padStart(2, '0');
  const mm = String(at.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${at.getFullYear()}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xxl, gap: S.md },
  count: { fontFamily: F.ui, ...T.xs, color: C.muted, marginBottom: S.xs },

  card: { backgroundColor: C.paperWarm, borderRadius: R.lg, padding: S.lg },
  org: { fontFamily: F.uiBold, ...T.md, color: C.ink },
  meta: { fontFamily: F.ui, ...T.xs, color: C.muted, marginTop: 2 },
  content: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginTop: S.sm },
});
