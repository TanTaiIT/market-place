import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { RerouteSheet } from '@/components/RerouteSheet';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useBumpListing,
  useMyGrants,
  usePublicQueue,
  useRerouteListing,
  useSetListingStatus,
} from '@/queries/admin';
import { isMaster, type ModStatus } from '@/api/admin';
import { C, F } from '@/theme';

const TABS: { value: ModStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'active', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
];

/**
 * Hàng đợi của TRỤC DANH MỤC — tin công khai, do người phụ trách (danh mục × tỉnh) duyệt.
 *
 * Tách khỏi màn "Duyệt tin": đó là hàng đợi của một tổ chức, còn đây là hàng đợi cắt theo ô
 * phụ trách. Hai trục không giao nhau, nên gộp một màn sẽ khiến người duyệt tưởng mình có
 * quyền trên tin của trục kia.
 *
 * Phạm vi không nằm trong màn hình này: BE dựng nó từ `role_grants` của chính người gọi và áp
 * ở tầng query. Ở đây không có bộ lọc danh mục/tỉnh nào để bấm nhầm.
 */
export default function PublicQueue() {
  const toast = useToast();
  const [tab, setTab] = useState<ModStatus>('pending');
  /** Tin đang chờ chọn ô đích. Giữ cả tiêu đề để ngăn chuyển ô nói rõ nó đang đụng vào tin nào. */
  const [moving, setMoving] = useState<{ id: string; title: string } | null>(null);

  const { data, error, isLoading } = usePublicQueue(tab);
  const { data: grants } = useMyGrants();
  const setStatus = useSetListingStatus();
  const reroute = useRerouteListing();
  const bump = useBumpListing();

  const rows = data ?? [];
  // Chuyển ô là quyền của master. Manager thấy nút này chỉ để bấm rồi nhận 403.
  const canReroute = isMaster(grants);

  const act = (done: string) => ({
    onSuccess: () => toast(done),
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  return (
    <AdminScreen
      title="Hàng đợi công khai"
      note="Tin của trục danh mục — duyệt là cho lên bảng tin toàn hệ thống"
    >
      <View style={styles.head}>
        <AdminFilter
          options={TABS.map((t) => ({ ...t, count: tab === t.value ? rows.length : undefined }))}
          value={tab}
          onChange={(v: string) => setTab(v as ModStatus)}
        />
        <Text style={styles.note}>
          Chỉ hiện tin trong danh mục và tỉnh bạn được phân công. Duyệt ở đây là cho tin lên
          bảng tin công khai của toàn hệ thống.
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <AdminListingRow item={item}>
            {canReroute && (
              <RowAction glyph="⇄" onPress={() => setMoving({ id: item.id, title: item.title })} />
            )}
            {/*
              Không gác bằng grant ở đây: hàng đợi này ĐÃ được BE thu về đúng ô của người gọi,
              nên mọi tin họ thấy đều nằm trong phạm vi họ phụ trách — khác `admin/listings`,
              nơi một staff nhóm cũng mở được màn.
            */}
            {item.status === 'active' && (
              <RowAction
                glyph="🔝"
                onPress={() => bump.mutate(item.id, act(`Đã đẩy "${item.title}" lên đầu bảng`))}
              />
            )}
            {item.status !== 'active' && (
              <RowAction
                glyph="✓"
                onPress={() =>
                  setStatus.mutate(
                    { id: item.id, status: 'active' },
                    act(`📌 Đã duyệt "${item.title}" lên bảng công khai`),
                  )
                }
              />
            )}
          </AdminListingRow>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState icon="✅" text="Không có tin nào trong ô bạn phụ trách" />
          )
        }
      />

      <RerouteSheet
        title={moving?.title ?? null}
        pending={reroute.isPending}
        onClose={() => setMoving(null)}
        onSubmit={(target) => {
          if (!moving) return;
          reroute.mutate(
            { id: moving.id, ...target },
            {
              onSuccess: () => {
                setMoving(null);
                toast(`⇄ Đã chuyển "${moving.title}" sang ô mới`);
              },
              onError: (e: Error) => toast(`⚠️ ${e.message}`),
            },
          );
        }}
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.deskTxtDim, lineHeight: 17 },
});
