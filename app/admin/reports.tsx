import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminReports, useResolveReport } from '@/queries/admin';
import { C, F } from '@/theme';

/**
 * Người dùng báo cáo. "Gỡ tin" ẩn luôn tin bị nhắm tới rồi đóng báo cáo; "Bỏ qua" chỉ đóng
 * báo cáo — dùng khi tin không sai, tránh để hàng đợi phình lên vì những lượt báo cáo nhầm.
 */
export default function AdminReports() {
  const toast = useToast();
  const { data, error, isLoading } = useAdminReports();
  const resolve = useResolveReport();

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
    <AdminScreen title="Báo cáo" note="xử lý trong 24 giờ" org>
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, item.urgent && styles.cardUrgent]}>
            <View style={styles.top}>
              <Text numberOfLines={1} style={styles.target}>
                {item.target}
              </Text>
              <View style={[styles.kind, item.urgent && { backgroundColor: C.badTint }]}>
                <Text style={[styles.kindText, item.urgent && { color: C.badText }]}>
                  {item.kind}
                </Text>
              </View>
            </View>

            {item.count > 1 && <Text style={styles.count}>{item.count} lượt báo cáo</Text>}

            <Text style={styles.quote}>{item.quote}</Text>
            <Text style={styles.meta}>
              {item.by.toUpperCase()} · {item.at}
            </Text>

            <View style={styles.acts}>
              <Pressable
                onPress={() => close(item.id, true)}
                style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.btnDangerText}>Gỡ tin</Text>
              </Pressable>
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
  target: { flex: 1, fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
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
