import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading, PagedFooter } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminReports, useMyGrants, useResolveReport } from '@/queries/admin';
import { canModeratePublicAxis } from '@/api/admin';
import type { Report } from '@/api/admin';
import { C, F } from '@/theme';

/**
 * Người dùng báo cáo. "Gỡ tin" ẩn luôn tin bị nhắm tới rồi đóng báo cáo; "Bỏ qua" chỉ đóng
 * báo cáo — dùng khi tin không sai, tránh để hàng đợi phình lên vì những lượt báo cáo nhầm.
 */
export default function AdminReports() {
  const toast = useToast();
  const { data, error, isLoading, loadMore, isFetchingNextPage } = useAdminReports();
  const resolve = useResolveReport();
  const publicAxis = canModeratePublicAxis(useMyGrants().data);
  const router = useRouter();

  /**
   * Xem ĐỐI TƯỢNG bị tố trước khi phán. Tin mở qua cửa bàn duyệt (`mod=1`): tin đã bị ẩn hay
   * thuộc org mình không đứng trong vẫn mở được — đường công khai trả 404 cho cả hai. Người thì
   * hồ sơ công khai là đủ: đó chính là thứ người tố đã nhìn thấy.
   */
  const open = (r: Report) =>
    router.push(r.targetType === 'listing' ? `/listing/${r.targetId}?mod=1` : `/user/${r.targetId}`);

  const close = (id: string, hideTarget: boolean) =>
    resolve.mutate(
      { id, hideTarget },
      {
        onSuccess: () =>
          toast(hideTarget ? 'Đã gỡ tin và báo cho người đăng' : 'Đã đánh dấu báo cáo là hợp lệ'),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <AdminScreen
      title="Báo cáo"
      note="xử lý trong 24 giờ"
      // Người phụ trách ô trục công khai thường không thuộc org nào — với họ màn này không đòi
      // chọn tổ chức (BE dựng ô từ grant). Quản trị org vẫn phải đứng trong org như cũ.
      org={publicAxis ? 'optional' : true}
    >
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, item.urgent && styles.cardUrgent]}>
            {/* Bấm vào tên đối tượng là mở nó — không phán một báo cáo mà chưa nhìn thứ bị tố. */}
            <Pressable
              onPress={() => open(item)}
              style={({ pressed }) => [styles.top, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.targetIcon}>{item.targetType === 'listing' ? '▤' : '◍'}</Text>
              <Text numberOfLines={1} style={styles.target}>
                {item.target}
              </Text>
              <View style={[styles.kind, item.urgent && { backgroundColor: C.badTint }]}>
                <Text style={[styles.kindText, item.urgent && { color: C.badText }]}>
                  {item.kind}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Text style={styles.openHint}>
              {item.targetType === 'listing' ? 'Chạm để xem tin bị báo cáo' : 'Chạm để xem hồ sơ người bị báo cáo'}
            </Text>

            {item.count > 1 && <Text style={styles.count}>{item.count} lượt báo cáo</Text>}

            <Text style={styles.quote}>{item.quote}</Text>
            <Text style={styles.meta}>
              {item.by.toUpperCase()} · {item.at}
            </Text>

            <View style={styles.acts}>
              {/* Báo cáo về NGƯỜI không có gì để gỡ: BE chỉ đóng báo cáo, khoá tài khoản là việc của
                  màn Người dùng — vẽ nút "Gỡ tin" ở đây là hứa một việc không xảy ra. */}
              {item.targetType === 'listing' && (
                <Pressable
                  onPress={() => close(item.id, true)}
                  style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.btnDangerText}>Gỡ tin</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => close(item.id, false)}
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.btnText}>Bỏ qua</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState icon="⚑" onDark text="Không có báo cáo nào đang mở. Cả bảng đang yên." />
          )
        }
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 11 },
  card: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    borderRadius: 10,
    padding: 15,
  },
  cardUrgent: { borderLeftColor: C.pin },
  top: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  targetIcon: { fontFamily: F.ui, fontSize: 13, color: C.deskTxtDim },
  target: { flex: 1, fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  chevron: { fontFamily: F.ui, fontSize: 18, lineHeight: 20, color: C.deskTxtDim },
  openHint: { fontFamily: F.ui, fontSize: 10.5, color: C.deskTxtDim, marginTop: 4 },
  kind: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: C.warnTint },
  kindText: { fontFamily: F.mono, fontSize: 10, color: C.amber },
  count: { fontFamily: F.mono, fontSize: 10, color: C.deskTxtDim, marginTop: 6 },
  quote: {
    fontFamily: F.ui,
    fontSize: 12.5,
    lineHeight: 20,
    fontStyle: 'italic',
    color: C.deskTxtSoft,
    borderLeftWidth: 2,
    borderLeftColor: C.deskLineStrong,
    paddingLeft: 11,
    marginTop: 9,
  },
  meta: { fontFamily: F.mono, fontSize: 10, color: C.deskTxtDim, marginTop: 9 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 13 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  btnText: { fontFamily: F.uiBold, fontSize: 12, color: C.deskTxt },
  btnDanger: { backgroundColor: C.pin, borderColor: C.pin },
  btnDangerText: { fontFamily: F.uiBold, fontSize: 12, color: C.paperWarm },
});
