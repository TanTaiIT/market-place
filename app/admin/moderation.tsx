import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminListings, useRemoveModListing, useSetListingStatus } from '@/queries/admin';
import type { ModListing, ModStatus } from '@/api/admin';
import { C, F } from '@/theme';

const TABS: { value: ModStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'active', label: 'Đã ghim' },
];

/**
 * Bảng duyệt tin — dữ liệu thật từ `GET /moderation/listings`.
 *
 * Không có bộ lọc trường: BE scope theo organization trong JWT, quản trị chỉ có đúng một
 * trường để xem. Muốn nhìn cả hệ thống thì cần route cấp chain, chưa dựng.
 *
 * Lấy **một** lượt mọi trạng thái rồi cắt tại chỗ: cần đếm cho từng tab, mà đếm thì phải có
 * cả tập. Đổi tab không tốn thêm lượt gọi nào.
 */
export default function Moderation() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<ModStatus>('pending');
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data, error, isLoading } = useAdminListings();
  const setStatus = useSetListingStatus();
  const remove = useRemoveModListing();

  const all = data ?? [];
  const rows = all.filter((l) => l.status === tab);
  const tabs = TABS.map((t) => ({ ...t, count: all.filter((l) => l.status === t.value).length }));

  const act = (done: string) => ({
    onSuccess: () => {
      toast(done);
      setSheet(null);
    },
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  return (
    <AdminScreen title="Duyệt tin" note="giữ bảng tin sạch">
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
