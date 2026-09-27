import React, { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminListingRow } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading, PagedFooter } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useRemoveModListing, useSetListingStatus } from '@/queries/admin';
import { useUserListings } from '@/queries/admin-people';
import type { ModListing, ModStatus } from '@/api/admin';

/** Bỏ trống = mọi trạng thái bàn duyệt thấy được. */
const STATUS_FILTER: { value: ModStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'active', label: 'Đang hiện' },
  { value: 'rejected', label: 'Bị từ chối' },
  { value: 'hidden', label: 'Đã ẩn' },
];

/**
 * Mọi tin một người đã đăng — mở từ Người dùng (master). Đủ trạng thái, không chỉ tin đang hiện
 * như hồ sơ công khai (`/user/[id]`): người xem ở đây đang cân nhắc khoá, quản chế hay phục hồi
 * uy tín, và bằng chứng nằm ở chính những tin bị từ chối hay bị ẩn.
 *
 * Tên + email đi theo tham số điều hướng thay vì gọi thêm một request: bảng Người dùng vừa có
 * sẵn cả hai, và đây chỉ là tiêu đề.
 */
export default function AdminUserListings() {
  const { id, name, email } = useLocalSearchParams<{ id: string; name?: string; email?: string }>();
  const toast = useToast();
  const [status, setStatus] = useState<ModStatus | 'all'>('all');
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data, error, isLoading, loadMore, isFetchingNextPage, total } = useUserListings(
    id ?? '',
    status === 'all' ? undefined : status,
  );
  const setListingStatus = useSetListingStatus();
  const remove = useRemoveModListing();

  const act = (done: string) => ({
    onSuccess: () => {
      toast(done);
      setSheet(null);
    },
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });
  const hide = (l: ModListing) =>
    setListingStatus.mutate(
      { id: l.id, status: l.status === 'hidden' ? 'active' : 'hidden' },
      act(l.status === 'hidden' ? 'Tin đã hiện lại trên bảng' : 'Đã ẩn tin khỏi bảng'),
    );

  return (
    <AdminScreen
      title={name ?? 'Tin của người dùng'}
      note={`${email ? `${email} · ` : ''}${total ?? 0} tin đã đăng`}
    >
      <AdminFilter
        options={STATUS_FILTER}
        value={status}
        onChange={(v) => setStatus(v as ModStatus | 'all')}
      />

      <FlatList
        data={data ?? []}
        keyExtractor={(l) => l.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <AdminListingRow item={item} onPress={() => setSheet(item)} />}
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState
              icon="📌"
              onDark
              text={status === 'all' ? 'Người này chưa đăng tin nào' : 'Không có tin nào ở trạng thái này'}
            />
          )
        }
      />

      <AdminListingSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onApprove={(l) =>
          setListingStatus.mutate({ id: l.id, status: 'active' }, act(`📌 Đã ghim "${l.title}" lên bảng`))
        }
        onToggleHide={hide}
        onRemove={(l, reason) => remove.mutate({ id: l.id, reason }, act(`Đã gỡ "${l.title}" khỏi bảng`))}
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10 },
});
