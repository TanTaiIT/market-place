import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminListings, useRemoveModListing, useSetListingStatus } from '@/queries/admin';
import { MOD_CATEGORIES, SCHOOLS } from '@/api/admin';
import type { ModListing } from '@/api/admin';
import { useAdminSchool, useSetAdminSchool } from '@/stores/admin';
import { C, F } from '@/theme';

const SCHOOL_OPTIONS = [
  { value: 'all', label: 'Tất cả trường' },
  ...SCHOOLS.map((s) => ({ value: s, label: s })),
];

/**
 * Toàn bộ tin trên bảng, mọi trạng thái. Khác màn Duyệt tin ở chỗ đây là nơi xử tin **đã** lên
 * bảng: ẩn tạm khi đang thương lượng, gỡ hẳn khi tin sai phạm.
 *
 * Dùng chung đúng một entry cache với màn Duyệt tin (cùng `qk.adminListings(school, 'all')`);
 * tìm kiếm và lọc danh mục cắt tại chỗ vì còn phải đếm số tin cho từng viên lọc.
 */
export default function AdminListings() {
  const toast = useToast();
  const school = useAdminSchool();
  const setSchool = useSetAdminSchool();
  const [cat, setCat] = useState('all');
  const [term, setTerm] = useState('');
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data, error, isLoading } = useAdminListings({ school, status: 'all' });
  const setStatus = useSetListingStatus();
  const remove = useRemoveModListing();

  const all = data ?? [];
  const q = term.trim().toLowerCase();
  const rows = all.filter(
    (l) =>
      (cat === 'all' || l.cat === cat) &&
      // Tìm cả tên người đăng: quản trị thường lần theo một người bán đáng ngờ chứ không nhớ
      // chính xác tiêu đề của tin.
      (!q ||
        l.title.toLowerCase().includes(q) ||
        l.seller.toLowerCase().includes(q) ||
        l.cat.toLowerCase().includes(q)),
  );
  const catOptions = [
    { value: 'all', label: 'Mọi danh mục', count: all.length },
    ...MOD_CATEGORIES.map((c) => ({
      value: c,
      label: c,
      count: all.filter((l) => l.cat === c).length,
    })),
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
      { id: l.id, status: l.status === 'hidden' ? 'live' : 'hidden' },
      act(l.status === 'hidden' ? 'Tin đã hiện lại trên bảng' : 'Đã ẩn tin khỏi bảng'),
    );

  return (
    <AdminScreen title="Tin đăng" note="tất cả những gì trên bảng">
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
        {!!q && <Text style={styles.searchCount}>{rows.length}</Text>}
      </View>

      <AdminFilter options={SCHOOL_OPTIONS} value={school} onChange={setSchool} />
      <AdminFilter options={catOptions} value={cat} onChange={setCat} />

      <FlatList
        data={rows}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <AdminListingRow item={item} onPress={() => setSheet(item)}>
            {item.status !== 'pending' && (
              <RowAction glyph={item.status === 'hidden' ? '▲' : '▼'} onPress={() => hide(item)} />
            )}
            <RowAction
              glyph="🗑"
              tone="danger"
              onPress={() => remove.mutate(item.id, act(`Đã gỡ "${item.title}" khỏi bảng`))}
            />
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
              text={q ? `Không tìm thấy "${term.trim()}"` : 'Chưa có tin nào khớp bộ lọc'}
            />
          )
        }
      />

      <AdminListingSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onApprove={(l) =>
          setStatus.mutate({ id: l.id, status: 'live' }, act(`📌 Đã ghim "${l.title}" lên bảng`))
        }
        onToggleHide={hide}
        onRemove={(l) => remove.mutate(l.id, act(`Đã gỡ "${l.title}" khỏi bảng`))}
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
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: F.ui,
    fontSize: 13,
    color: C.deskTxt,
  },
  searchCount: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10 },
});
