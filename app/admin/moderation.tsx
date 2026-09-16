import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading, PagedFooter } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminListings, useRemoveModListing, useSetListingStatus } from '@/queries/admin';
import type { ModListing, ModStatus } from '@/api/admin';
import { C, F } from '@/theme';

const TABS: { value: ModStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'pending_unverified', label: 'Người ngoài' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'active', label: 'Đã ghim' },
];

/**
 * Bảng duyệt tin — dữ liệu thật từ `GET /moderation/listings`.
 *
 * Không có bộ lọc trường: BE scope theo organization trong JWT, quản trị chỉ có đúng một
 * trường để xem. Muốn nhìn cả hệ thống thì cần route cấp chain, chưa dựng.
 *
 * Mỗi tab là MỘT danh sách trang riêng, lọc `status` ở server. Bản trước lấy mọi trạng thái
 * rồi cắt tại chỗ để đếm cho từng tab — với phân trang, cắt tại chỗ trên 10 dòng vừa về là danh
 * sách ngắn hơn màn hình, `onEndReached` bắn liên tiếp và kéo hết 12 trang về ngay lúc mở màn.
 * Số đếm chỉ còn cho tab đang mở (`total` của BE), cùng cách `public-queue` làm.
 */
export default function Moderation() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<ModStatus>('pending');
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data, error, isLoading, loadMore, isFetchingNextPage, total } = useAdminListings(tab);
  const setStatus = useSetListingStatus();
  const remove = useRemoveModListing();

  const rows = data ?? [];
  const tabs = TABS.map((t) => ({ ...t, count: tab === t.value ? total : undefined }));

  const act = (done: string) => ({
    onSuccess: () => {
      toast(done);
      setSheet(null);
    },
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  return (
    <AdminScreen title="Duyệt tin" note="giữ bảng tin sạch" org masterReadsAll>
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <AdminFilter options={tabs} value={tab} onChange={(v) => setTab(v as ModStatus)} />
        </View>
        <Pressable
          onPress={() => router.replace('/admin')}
          style={({ pressed }) => [styles.deskBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.deskBtnText}>Mở bàn duyệt</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(l) => l.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AdminListingRow item={item} onPress={() => setSheet(item)}>
            {item.status !== 'active' && (
              <RowAction
                glyph="✓"
                onPress={() =>
                  setStatus.mutate(
                    { id: item.id, status: 'active' },
                    act(`📌 Đã ghim "${item.title}" lên bảng`),
                  )
                }
              />
            )}
          </AdminListingRow>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState icon="🗂" onDark text="Không có tin nào ở mục này" />
          )
        }
      />

      <AdminListingSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onApprove={(l) =>
          setStatus.mutate({ id: l.id, status: 'active' }, act(`📌 Đã ghim "${l.title}" lên bảng`))
        }
        onToggleHide={(l) =>
          setStatus.mutate(
            { id: l.id, status: l.status === 'hidden' ? 'active' : 'hidden' },
            act(l.status === 'hidden' ? 'Tin đã hiện lại trên bảng' : 'Đã ẩn tin khỏi bảng'),
          )
        }
        onRemove={(l) => remove.mutate(l.id, act(`Đã gỡ "${l.title}" khỏi bảng`))}
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 18 },
  deskBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.pin },
  deskBtnText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.paperWarm },
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10 },
});
