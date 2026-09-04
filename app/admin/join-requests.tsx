import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { RowAction } from '@/components/AdminListingRow';
import { RejectReasonSheet } from '@/components/RejectReasonSheet';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useApproveJoinRequest,
  useBulkApproveJoinRequests,
  useJoinRequestQueue,
  useRejectJoinRequest,
} from '@/queries/org';
import type { JoinRequestRow, JoinRequestStatus } from '@/api/org';
import { C, F } from '@/theme';

const TABS: { value: JoinRequestStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
];

/**
 * Hàng đợi đơn xin gia nhập của tổ chức đang hoạt động.
 *
 * Duyệt một đơn = tạo membership, nên nó nằm ở nhóm "Cộng đồng" chứ không phải "Duyệt tin":
 * hai thứ khác hẳn nhau về hệ quả, gộp một màn là mời người duyệt bấm nhầm.
 */
export default function JoinRequests() {
  const toast = useToast();
  const [tab, setTab] = useState<JoinRequestStatus>('pending');
  const [picked, setPicked] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<JoinRequestRow | null>(null);

  const { data, error, isLoading } = useJoinRequestQueue(tab);
  const approve = useApproveJoinRequest();
  const reject = useRejectJoinRequest();
  const bulk = useBulkApproveJoinRequests();

  const rows = data ?? [];
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const approveOne = (row: JoinRequestRow) =>
    approve.mutate(
      { id: row.id, unitId: null },
      { onSuccess: () => toast(`✓ ${row.claimedName} đã vào tổ chức`), onError: fail },
    );

  const approvePicked = () =>
    bulk.mutate(
      { ids: picked, unitId: null },
      {
        onSuccess: (r) => {
          setPicked([]);
          // Báo cả số hỏng: BE duyệt từng đơn nên một lô "thành công" vẫn có thể sót đơn hết hạn.
          toast(r.failed > 0 ? `✓ ${r.approved} đơn · ${r.failed} đơn lỗi` : `✓ Đã duyệt ${r.approved} đơn`);
        },
        onError: fail,
      },
    );

  return (
    <AdminScreen title="Đơn xin gia nhập" note="Ai muốn vào tổ chức, và họ khai mình là ai" org>
      <View style={styles.head}>
        <AdminFilter
          options={TABS.map((t) => ({ ...t, count: tab === t.value ? rows.length : undefined }))}
          value={tab}
          onChange={(v: string) => {
            setTab(v as JoinRequestStatus);
            setPicked([]);
          }}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            disabled={tab !== 'pending'}
            onPress={() => toggle(item.id)}
            style={({ pressed }) => [
              styles.row,
              picked.includes(item.id) && styles.rowOn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name}>{item.claimedName}</Text>
              <Text style={styles.meta}>
                {item.claimedUnit ?? 'Không khai nhóm'} · gửi {item.sentAt}
                {item.expiresIn ? ` · còn ${item.expiresIn}` : ' · ĐÃ QUÁ HẠN'}
              </Text>
              {!!item.note && <Text style={styles.note}>“{item.note}”</Text>}
            </View>

            {tab === 'pending' && (
              <View style={styles.acts}>
                <RowAction glyph="✓" onPress={() => approveOne(item)} />
                <RowAction glyph="✕" tone="danger" onPress={() => setRejecting(item)} />
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState icon="📭" text="Không có đơn nào ở mục này" />
          )
        }
      />

      {picked.length > 0 && (
        <Pressable
          disabled={bulk.isPending}
          onPress={approvePicked}
          style={({ pressed }) => [styles.bulk, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.bulkText}>
            {bulk.isPending ? 'Đang duyệt...' : `✓ Duyệt ${picked.length} đơn đã chọn`}
          </Text>
        </Pressable>
      )}

      <RejectReasonSheet
        name={rejecting?.claimedName ?? null}
        pending={reject.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => {
          if (!rejecting) return;
          const name = rejecting.claimedName;
          reject.mutate(
            { id: rejecting.id, reason },
            {
              onSuccess: () => {
                setRejecting(null);
                toast(`✕ Đã từ chối đơn của ${name}`);
              },
              onError: fail,
            },
          );
        }}
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 12,
  },
  rowOn: { borderColor: C.mossBright, backgroundColor: C.okTint },
  name: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  meta: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 3 },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.deskTxtSoft, marginTop: 6, lineHeight: 16 },
  acts: { flexDirection: 'row', gap: 6 },

  bulk: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: C.mossDeep,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  bulkText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paperWarm },
});
