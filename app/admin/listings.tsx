import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading, PagedFooter } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAdminListings,
  useBumpListing,
  useMyGrants,
  useRemoveModListing,
  useSetListingStatus,
} from '@/queries/admin';
import { canAdminOrg } from '@/api/admin';
import { useAdminOrgId } from '@/components/AdminOrgScope';
import { useCategories } from '@/queries/listings';
import type { ModListing } from '@/api/admin';
import { C, F } from '@/theme';

/**
 * Toàn bộ tin trên bảng, mọi trạng thái. Khác màn Duyệt tin ở chỗ đây là nơi xử tin **đã** lên
 * bảng: ẩn tạm khi đang thương lượng, gỡ hẳn khi tin sai phạm.
 *
 * Dùng chung đúng một entry cache với màn Duyệt tin; lọc danh mục và tìm kiếm cắt tại chỗ vì
 * còn phải đếm số tin cho từng viên lọc.
 */
export default function AdminListings() {
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [term, setTerm] = useState('');
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data: categories } = useCategories();
  const { data, error, isLoading, loadMore, isFetchingNextPage, total } = useAdminListings(
    undefined,
    { category: cat === 'all' ? undefined : cat, q: term },
  );
  const setStatus = useSetListingStatus();
  const remove = useRemoveModListing();
  const bump = useBumpListing();

  /*
   * Đẩy tin là quyền của QUẢN TRỊ nhóm, không phải người duyệt tin — staff mở được màn này
   * (`requireOrgReadOrMaster`) nhưng BE sẽ từ chối cú bấm. Ẩn nút thay vì để họ bấm rồi ăn
   * 403, cùng cách `public-queue` ẩn nút chuyển ô khỏi manager.
   */
  const { data: grants } = useMyGrants();
  const canBump = canAdminOrg(grants, useAdminOrgId());

  /*
   * Lọc ở SERVER (danh mục + từ khoá, BE khớp cả tên người đăng). Danh sách đã phân trang: lọc ở
   * client trên 10 dòng vừa về là danh sách ngắn hơn màn hình → `onEndReached` bắn liên tiếp, kéo
   * hết mọi trang về chỉ để tìm vài dòng. Đếm theo danh mục cũng bỏ — đếm phần đã tải là số sai.
   */
  const rows = data ?? [];
  const catOptions = [
    { value: 'all', label: 'Mọi danh mục' },
    ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  const act = (done: string) => ({
    onSuccess: () => {
      toast(done);
      setSheet(null);
    },
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  const hide = (l: ModListing) =>
    setStatus.mutate(
      { id: l.id, status: l.status === 'hidden' ? 'active' : 'hidden' },
      act(l.status === 'hidden' ? 'Tin đã hiện lại trên bảng' : 'Đã ẩn tin khỏi bảng'),
    );

  return (
    <AdminScreen title="Tin đăng" note="tất cả những gì trên bảng" org>
      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Tìm tin đăng, người đăng…"
          placeholderTextColor={C.deskTxtDim}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!term.trim() && <Text style={styles.searchCount}>{total}</Text>}
      </View>

      <AdminFilter options={catOptions} value={cat} onChange={setCat} />

      <FlatList
        data={rows}
        keyExtractor={(l) => l.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <AdminListingRow item={item} onPress={() => setSheet(item)}>
            {item.status !== 'pending' && (
              <RowAction glyph={item.status === 'hidden' ? '▲' : '▼'} onPress={() => hide(item)} />
            )}
            {/* Chỉ tin ĐANG hiển thị: đẩy tin ẩn/chờ duyệt không dịch được gì, BE trả 400. */}
            {canBump && item.status === 'active' && (
              <RowAction
                glyph="🔝"
                onPress={() => bump.mutate(item.id, act(`Đã đẩy "${item.title}" lên đầu bảng`))}
              />
            )}
            {/* Gỡ là thao tác không rút lại được: đi qua ngăn chi tiết để có nhịp chọn lý do,
                thay vì một chạm lặng lẽ xoá tin ngay trên hàng. */}
            <RowAction glyph="🗑" tone="danger" onPress={() => setSheet(item)} />
          </AdminListingRow>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState
              icon="📌"
              onDark
              text={term.trim() ? `Không tìm thấy "${term.trim()}"` : 'Chưa có tin nào khớp bộ lọc'}
            />
          )
        }
      />

      <AdminListingSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onApprove={(l) =>
          setStatus.mutate({ id: l.id, status: 'active' }, act(`📌 Đã ghim "${l.title}" lên bảng`))
        }
        onToggleHide={hide}
        onRemove={(l, reason) =>
          remove.mutate({ id: l.id, reason }, act(`Đã gỡ "${l.title}" khỏi bảng`))
        }
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  searchIcon: { fontSize: 13, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: F.ui, fontSize: 13, color: C.deskTxt },
  searchCount: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10 },
});
