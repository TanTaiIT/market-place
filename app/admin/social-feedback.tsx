import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn } from '@/components/AdminPicker';
import { EmptyState, Loading, PagedFooter, nearEnd } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useFeedbackQueue, useReviewFeedback } from '@/queries/social-feedback';
import type { ReviewStatus } from '@/api/social-feedback';
import { C, F } from '@/theme';

/**
 * Bàn duyệt ý kiến của tổ chức xã hội — cụm tạm thời, gỡ theo `@/api/legal`.
 *
 * Màn này tồn tại vì cửa gửi KHÔNG đăng nhập: không có nó thì mọi ý kiến nằm mãi ở `pending`
 * và trang công bố rỗng vĩnh viễn. Đây là nửa còn lại của quyết định "có duyệt", không phải
 * một tiện nghi thêm vào.
 *
 * Không có nút xoá, và đó là chủ ý: đã tiếp nhận thì phải còn vết. `rejected` là "không công
 * bố", không phải "chưa từng nhận" — BE cũng không mở đường xoá.
 */

const TABS: { value: ReviewStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'published', label: 'Đã công bố' },
  { value: 'rejected', label: 'Từ chối' },
];

export default function AdminSocialFeedback() {
  const toast = useToast();
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const { data, error, isPending, loadMore, isFetchingNextPage, total } = useFeedbackQueue(tab);
  const review = useReviewFeedback();

  const act = (id: string, status: 'published' | 'rejected') =>
    review.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast(status === 'published' ? '✓ Đã công bố' : '✓ Đã từ chối, bản ghi vẫn còn'),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <AdminScreen title="Ý kiến tổ chức xã hội" note="nghĩa vụ công bố, duyệt trước khi hiện">
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setTab(t.value)}
            style={[styles.tab, tab === t.value && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t.value && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(row) => row.id}
        onScroll={(e) => nearEnd(e) && loadMore()}
        scrollEventThrottle={160}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          data?.length ? <Text style={styles.count}>{total} ý kiến</Text> : undefined
        }
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.org}>{item.orgName}</Text>
            <Text style={styles.meta}>
              QĐ {item.decisionNo} · GỬI {dayOf(item.createdAt).toUpperCase()}
            </Text>
            <Text style={styles.content}>{item.content}</Text>

            {tab === 'pending' && (
              <View style={styles.acts}>
                <AdminSmallBtn label="Công bố" onPress={() => act(item.id, 'published')} />
                <AdminSmallBtn label="Từ chối" onPress={() => act(item.id, 'rejected')} />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          isPending ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState icon="📭" onDark text="Không có ý kiến nào ở mục này" />
          )
        }
      />
    </AdminScreen>
  );
}

/** `dd/mm/yyyy` ghép tay — Hermes không mang đủ dữ liệu Intl, cùng lý do các màn khác tự ghép. */
function dayOf(iso: string): string {
  const at = new Date(iso);
  const dd = String(at.getDate()).padStart(2, '0');
  const mm = String(at.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${at.getFullYear()}`;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  tabOn: { backgroundColor: C.deskHi, borderColor: C.deskLineStrong },
  tabText: { fontFamily: F.ui, fontSize: 12, color: C.deskTxtDim },
  tabTextOn: { fontFamily: F.uiBold, color: C.paper },

  body: { paddingHorizontal: 18, paddingBottom: 32, gap: 10 },
  count: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim },

  card: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  org: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  meta: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim, marginTop: 4 },
  content: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.deskTxtSoft, marginTop: 8 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
