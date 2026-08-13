import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminListings, useRemoveModListing, useSetListingStatus } from '@/queries/admin';
import { SCHOOLS } from '@/api/admin';
import type { ModListing, ModStatus } from '@/api/admin';
import { useAdminSchool, useSetAdminSchool } from '@/stores/admin';
import { C, F } from '@/theme';

const SCHOOL_OPTIONS = [
  { value: 'all', label: 'Tất cả trường' },
  ...SCHOOLS.map((s) => ({ value: s, label: s })),
];

const TABS: { value: ModStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'live', label: 'Đã ghim' },
];

/**
 * Bảng duyệt tin — soát lại cả cụm và ghim nhanh những tin đã đọc qua.
 *
 * Nút ✓ ngay trên hàng chỉ để ghim; **không** có nút từ chối vì từ chối bắt buộc kèm lý do
 * (người đăng sẽ đọc nó), mà chọn lý do thì phải đang đọc kỹ tin — đó là việc của bàn duyệt.
 */
export default function Moderation() {
  const router = useRouter();
  const toast = useToast();
  const school = useAdminSchool();
  const setSchool = useSetAdminSchool();
  const [tab, setTab] = useState<ModStatus>('pending');
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data, error, isLoading } = useAdminListings({ school, status: 'all' });
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
      <AdminFilter options={SCHOOL_OPTIONS} value={school} onChange={setSchool} />

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
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AdminListingRow item={item} onPress={() => setSheet(item)}>
            {item.status !== 'live' && (
              <RowAction
                glyph="✓"
                onPress={() =>
                  setStatus.mutate(
                    { id: item.id, status: 'live' },
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
          setStatus.mutate({ id: l.id, status: 'live' }, act(`📌 Đã ghim "${l.title}" lên bảng`))
        }
        onToggleHide={(l) =>
          setStatus.mutate(
            { id: l.id, status: l.status === 'hidden' ? 'live' : 'hidden' },
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
  deskBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.pin,
  },
  deskBtnText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.paperWarm },
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10 },
});
