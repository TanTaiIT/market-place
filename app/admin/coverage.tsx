import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useCoverage } from '@/queries/admin';
import { C, F } from '@/theme';

/**
 * Ma trận phủ sóng (danh mục × tỉnh) của master.
 *
 * Mỗi ô KHÔNG có người phụ trách là một dòng tin chảy thẳng vào hàng đợi của master. Với 34
 * tỉnh × N danh mục thì số ô trống lớn hơn trực giác rất nhiều, và master chỉ phát hiện khi
 * đã ngập. Màn này tồn tại để nhìn thấy trước lúc đó.
 *
 * BE chỉ trả các ô ĐÁNG CHÚ Ý — ô có người và không tồn đọng bị lược đi, nên danh sách rỗng ở
 * đây là tin tốt, không phải lỗi tải.
 */
export default function Coverage() {
  const { data, error, isLoading } = useCoverage();

  return (
    <AdminScreen title="Phủ sóng" note="Ô nào chưa có người, ô nào đang tồn đọng">
      {data ? (
        <View style={styles.kpis}>
          <Kpi label="Tổng số ô" value={String(data.totalCells)} />
          <Kpi label="Chưa có người" value={String(data.uncovered)} warn={data.uncovered > 0} />
          <Kpi label="Tin tồn đọng" value={String(data.backlog)} warn={data.backlog > 0} />
        </View>
      ) : null}

      <FlatList
        data={data?.cells ?? []}
        keyExtractor={(c) => `${c.categoryId}-${c.provinceCode}`}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.hasModerator && styles.rowGap]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cell}>
                {item.categoryName} · {item.provinceCode}
              </Text>
              <Text style={styles.meta}>
                {item.hasModerator ? 'Đã có người phụ trách' : 'CHƯA có ai phụ trách'}
                {item.pending > 0 ? ` · ${item.pending} tin chờ` : ''}
              </Text>
            </View>
            {item.pending > 0 ? <Text style={styles.count}>{item.pending}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState icon="✅" text="Mọi ô đều có người phụ trách và không tồn đọng" />
          )
        }
      />
    </AdminScreen>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, warn && { color: C.badText }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  kpi: { flex: 1, backgroundColor: C.deskRaise, borderRadius: 8, padding: 12 },
  kpiValue: { fontFamily: F.monoBold, fontSize: 20, color: C.deskTxt },
  kpiLabel: { fontFamily: F.ui, fontSize: 10.5, color: C.deskTxtDim, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.deskRaise,
    borderRadius: 8,
    padding: 12,
  },
  // Ô trống là thứ phải nhảy ra khỏi danh sách — nó mới là lý do màn này tồn tại.
  rowGap: { borderLeftWidth: 3, borderLeftColor: C.badText },
  cell: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxt },
  meta: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 2 },
  count: { fontFamily: F.monoBold, fontSize: 16, color: C.tape },
});
