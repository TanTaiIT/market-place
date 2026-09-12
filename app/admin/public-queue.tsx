import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { AdminListingRow, RowAction } from '@/components/AdminListingRow';
import { AdminListingSheet } from '@/components/AdminListingSheet';
import { RerouteSheet } from '@/components/RerouteSheet';
import { EmptyState, Loading, PagedFooter } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useBumpListing,
  useMyGrants,
  usePublicQueue,
  useRemoveModListing,
  useRerouteListing,
  useSetListingStatus,
} from '@/queries/admin';
import { isMaster, type ModListing, type ModStatus } from '@/api/admin';
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
  /**
   * Tin đang mở chi tiết. Giữ CẢ object chứ không chỉ id: `AdminListingSheet` nhận `item` và
   * tự đóng khi `null`, nên không có trạng thái 'mở mà không có tin' nào dựng được.
   */
  const [sheet, setSheet] = useState<ModListing | null>(null);

  const { data, error, isLoading, loadMore, isFetchingNextPage } = usePublicQueue(tab);
  const { data: grants } = useMyGrants();
  const setStatus = useSetListingStatus();
  const reroute = useRerouteListing();
  const remove = useRemoveModListing();
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          /*
            Bấm vào HÀNG mở chi tiết; các nút bên trong vẫn ăn cú chạm của riêng chúng —
            `Pressable` lồng nhau trong RN không cho sự kiện nổi lên như DOM, nên nút ✓ không
            kéo theo một lượt mở ngăn. Cùng cách màn 'Duyệt tin' đang làm.
          */
          <AdminListingRow item={item} onPress={() => setSheet(item)}>
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

      {/*
        Ngăn chi tiết ĐÓNG sau mọi hành động, khác màn 'Duyệt tin' vốn để nó mở.

        `sheet` giữ một BẢN CHỤP của tin. Đổi trạng thái xong thì bản chụp đó sai ngay: nhãn
        vẫn ghi 'chờ duyệt' và footer vẫn mời ghim lại một tin vừa ghim. Tệ hơn, tin thường
        rời khỏi tab đang xem — ngăn còn mở là còn hiện một tin không còn trong danh sách phía
        sau. Toast đã nói kết quả nên không mất thông tin nào khi đóng.
      */}
      <AdminListingSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onApprove={(l) => {
          setSheet(null);
          setStatus.mutate(
            { id: l.id, status: 'active' },
            act(`📌 Đã duyệt "${l.title}" lên bảng công khai`),
          );
        }}
        onToggleHide={(l) => {
          setSheet(null);
          setStatus.mutate(
            { id: l.id, status: l.status === 'hidden' ? 'active' : 'hidden' },
            act(l.status === 'hidden' ? 'Tin đã hiện lại trên bảng' : 'Đã ẩn tin khỏi bảng'),
          );
        }}
        onRemove={(l) => {
          setSheet(null);
          remove.mutate(l.id, act(`Đã gỡ "${l.title}" khỏi bảng`));
        }}
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
