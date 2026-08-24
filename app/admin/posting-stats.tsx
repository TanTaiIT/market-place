import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { adminFormStyles } from '@/components/AdminPicker';
import { EmptyState, Loading } from '@/components/ui';
import { usePostingStats } from '@/queries/admin-system';
import { useCategories } from '@/queries/listings';
import { C, F } from '@/theme';

/**
 * Số liệu định giá gói tin.
 *
 * Đây là màn ĐỌC, và nó tồn tại vì một lý do hẹp: `DEFAULT_LISTING_PRODUCTS` để `price: null`
 * với chú thích "chốt bằng số liệu posting-stats, không đoán". Không có màn này thì câu đó là
 * lời hứa suông — master vẫn phải đoán giá, chỉ khác là đoán trong một form đẹp hơn.
 *
 * Ba con số cần cho một quyết định giá: bao nhiêu tin (cầu), bao nhiêu người đăng (ai trả), và
 * phân bố tin-trên-đầu-người (ai sẽ trả NHIỀU — người đăng 20 tin/tháng mới là khách của gói,
 * không phải người đăng một tin rồi thôi).
 */

const WINDOWS = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
];

/** Hermes không có Intl đầy đủ — chấm nghìn bằng tay, cùng cách với `formatPrice`. */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function AdminPostingStats() {
  const [days, setDays] = useState('30');
  const { data, error, isPending } = usePostingStats(Number(days));
  const { data: categories } = useCategories();

  const nameOf = (id: string) => categories?.find((c) => c.id === id)?.name ?? 'Khác';

  const perPoster = data && data.distinctPosters > 0 ? data.totalPosts / data.distinctPosters : 0;
  const byCategory = data?.byCategory ?? [];
  // Mốc để vẽ thanh là danh mục ĐỨNG ĐẦU, tính một lần ở đây thay vì trong mỗi lượt render hàng.
  const topCount = byCategory.reduce((max, row) => Math.max(max, row.count), 0);
  const topCategory = byCategory.find((row) => row.count === topCount);

  return (
    <AdminScreen title="Số liệu đăng tin" note="chốt giá bằng số, không đoán">
      <AdminFilter options={WINDOWS} value={days} onChange={setDays} />

      <ScrollView contentContainerStyle={styles.body}>
        {isPending ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : !data ? (
          <EmptyState icon="◰" onDark text="Chưa có số liệu trong cửa sổ này" />
        ) : (
          <View style={{ gap: 16 }}>
            <View style={styles.tiles}>
              <Tile label="Tin đã đăng" value={group(data.totalPosts)} />
              <Tile label="Người đăng" value={group(data.distinctPosters)} />
              <Tile label="Tin / người" value={perPoster ? perPoster.toFixed(1) : '—'} />
            </View>

            <AdminPanel
              title="Phân bố theo danh mục"
              note={topCategory ? `dẫn đầu: ${nameOf(topCategory._id)}` : 'chưa có tin nào'}
            >
              {byCategory.length === 0 ? (
                <Text style={styles.empty}>Không có tin nào trong cửa sổ này.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {byCategory.map((row) => (
                    <View key={row._id} style={styles.barRow}>
                      <Text numberOfLines={1} style={styles.barLabel}>
                        {nameOf(row._id)}
                      </Text>
                      {/* Thanh so với danh mục ĐỨNG ĐẦU, không phải so với tổng: chia cho tổng
                          thì mọi thanh đều ngắn tũn khi có nhiều danh mục, mà thứ cần nhìn ở
                          đây là chênh lệch giữa các danh mục với nhau. */}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${topCount > 0 ? Math.max(4, (row.count / topCount) * 100) : 0}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.barValue}>{group(row.count)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </AdminPanel>

            <AdminPanel title="Tin trên mỗi người đăng" note="ai là khách của gói tin">
              {data.posterHistogram.length === 0 ? (
                <Text style={styles.empty}>Chưa đủ dữ liệu để dựng phân bố.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {data.posterHistogram.map((bucket) => (
                    <View key={String(bucket._id)} style={styles.histRow}>
                      <Text style={styles.histBucket}>{bucket._id} tin</Text>
                      <Text style={styles.histUsers}>{group(bucket.users)} người</Text>
                    </View>
                  ))}
                </View>
              )}
            </AdminPanel>
          </View>
        )}

        <Text style={adminFormStyles.limit}>
          Đây là lượng tin ĐÃ đăng khi mọi thứ còn miễn phí. Nó nói được ai đăng nhiều, không nói
          được ai chịu trả — đặt giá xong vẫn phải nhìn lại chính bảng này ở cửa sổ kế tiếp.
        </Text>
      </ScrollView>
    </AdminScreen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  tileLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.8, color: C.deskTxtDim },
  tileValue: { fontFamily: F.uiBlack, fontSize: 20, color: C.paper, marginTop: 7 },
  empty: { fontFamily: F.ui, fontSize: 12, color: C.deskTxtDim },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontFamily: F.ui, fontSize: 12, color: C.deskTxtSoft, width: 96 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.deskRaise },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.mossBright },
  barValue: { fontFamily: F.monoBold, fontSize: 11, color: C.paper, width: 44, textAlign: 'right' },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  histBucket: { fontFamily: F.mono, fontSize: 11, color: C.deskTxtSoft },
  histUsers: { fontFamily: F.uiBold, fontSize: 12, color: C.paper },
});
