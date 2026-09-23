import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CategoryBars, TrendChart } from '@/components/AdminChart';
import { AdminPanel } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useSystemMetrics } from '@/queries/admin-metrics';
import { C, F } from '@/theme';

/**
 * Bàn tổng quan của MASTER — số của cả nền tảng, không của tổ chức nào.
 *
 * Khác bàn org ở chỗ căn bản: bàn kia là "việc hôm nay" (hàng đợi duyệt ngay trên màn, duyệt
 * xong là xong), còn bàn này là "hệ thống đang thế nào". Master không còn duyệt tin hằng ngày
 * nên ở đây không có ngăn duyệt — thay vào đó là khối CẦN CHÚ Ý ở trên cùng.
 *
 * Khối đó đứng TRƯỚC các con số quy mô là có chủ ý. Quy mô (bao nhiêu tổ chức, bao nhiêu người)
 * là thứ đọc mỗi tuần một lần; còn ô chưa có người phụ trách, org mất manager, tin chờ 40 ngày
 * là thứ phải đập vào mắt ngay lúc mở màn. Sau khi bỏ hai nhóm menu của master, đây là đường
 * DUY NHẤT còn lại để họ biết những chuyện đó đang xảy ra.
 */

/** Hermes không có Intl đầy đủ nên `toLocaleString` không tin được — chấm nghìn bằng tay. */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Tin chờ quá số ngày này là hàng tồn, không phải hàng đang chạy. */
const STALE_PENDING_DAYS = 7;

type Alert = { key: string; text: string; note: string; href: string; cta: string };

export function AdminSystemOverview() {
  const router = useRouter();
  const { data, error, isLoading, refetch } = useSystemMetrics();

  if (isLoading) return <Loading onDark />;
  if (error || !data) {
    return (
      <EmptyState
        icon="📡"
        onDark
        text={(error as Error | null)?.message ?? 'Không tải được số liệu hệ thống'}
        onRetry={() => void refetch()}
      />
    );
  }

  const { organizations: orgs, users, listings, moderation: mod } = data;

  /*
   * Cảnh báo chỉ hiện khi CÓ chuyện — không có thẻ "0 vấn đề" nào.
   *
   * Một khối cảnh báo lúc nào cũng hiện là một khối lúc nào cũng bị bỏ qua. Màn này để trống chỗ
   * đó khi hệ thống lành, nên lúc nó xuất hiện thì bản thân sự xuất hiện đã là tín hiệu.
   */
  const alerts = [
    mod.uncoveredCells > 0 && {
      key: 'coverage',
      text: `${mod.uncoveredCells}/${mod.totalCells} ô (danh mục × tỉnh) chưa có người phụ trách`,
      note:
        mod.coverageBacklog > 0
          ? `${mod.coverageBacklog} tin đang chờ trong những ô đó — chúng rơi về master`
          : 'Chưa có tin nào chờ, nhưng tin mới ở đó sẽ rơi về master',
      href: '/admin/coverage',
      cta: 'Mở ma trận phủ sóng',
    },
    orgs.withoutManager > 0 && {
      key: 'manager',
      text: `${orgs.withoutManager} tổ chức đang mở mà không còn manager nào`,
      note: 'Hàng đợi duyệt tin, báo cáo và đơn gia nhập của họ không còn ai xử lý',
      href: '/admin/role-grants',
      cta: 'Cấp lại quyền',
    },
    mod.oldestPendingDays >= STALE_PENDING_DAYS && {
      key: 'stale',
      text: `Có tin đã chờ duyệt ${mod.oldestPendingDays} ngày`,
      note: `${mod.pendingPublicAxis} tin chờ ở trục công khai · ${mod.pendingOrgAxis} tin ở trục tổ chức`,
      href: '/admin/public-queue',
      cta: 'Mở hàng đợi công khai',
    },
  ].filter(Boolean) as Alert[];

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.stack}>
        {alerts.length > 0 && (
          <View>
            <SectionTitle title="Cần chú ý" note="không tự hết được" />
            {alerts.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => router.push(a.href)}
                style={({ pressed }) => [styles.alert, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.alertText}>{a.text}</Text>
                <Text style={styles.alertNote}>{a.note}</Text>
                <Text style={styles.alertCta}>{a.cta} ›</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View>
          <SectionTitle title="Quy mô" note="toàn hệ thống" />
          <View style={styles.grid}>
            <Tile
              label="TỔ CHỨC"
              value={orgs.active}
              sub={`+${orgs.new30d} trong 30 ngày`}
              accent={C.cork}
            />
            <Tile
              label="NGƯỜI DÙNG"
              value={users.active}
              sub={`+${users.new30d} trong 30 ngày`}
              accent={C.mossBright}
            />
            <Tile
              label="TIN ĐANG HIỂN THỊ"
              value={listings.active}
              sub={`${group(listings.total)} tin tất cả`}
              accent={C.tape}
            />
            <Tile
              label="TIN CHỜ DUYỆT"
              value={listings.pending}
              sub={`${mod.openReports} báo cáo đang mở`}
              accent={C.pin}
            />
          </View>
        </View>

        {/*
          BA bậc, không còn hai trục. BE đã thay `visibility` (công khai / nội bộ) bằng `reach`,
          và bậc giữa — `group_open`: nằm trong nhóm nhưng ai cũng đọc được — chính là thứ mô
          hình cũ không diễn đạt nổi. Gộp nó vào một trong hai cột cũ là giấu mất bậc đó khỏi
          người đang nhìn số liệu để ra quyết định.
        */}
        <AdminPanel title="Chia theo bậc phủ sóng" note="tin đăng">
          <Split
            rows={[
              { label: 'Lên sàn', value: listings.marketplace },
              { label: 'Nhóm mở', value: listings.groupOpen },
              { label: 'Chỉ thành viên', value: listings.members },
            ]}
          />
        </AdminPanel>

        <AdminPanel title="Trạng thái tổ chức">
          <Split
            rows={[
              { label: 'Đang mở', value: orgs.active },
              { label: 'Chờ trao quyền', value: orgs.pendingAdmin },
              { label: 'Đang khoá', value: orgs.suspended },
            ]}
          />
        </AdminPanel>

        <View>
          <SectionTitle title="Nhịp hoạt động" note="14 ngày gần nhất" />
          <AdminPanel title="Tin đăng mỗi ngày" note="liền: đã duyệt · đứt: chờ duyệt">
            <TrendChart
              data={listings.trend.map((d) => ({ approved: d.approved, pending: d.pending }))}
            />
          </AdminPanel>
        </View>

        <AdminPanel title="Danh mục sôi động">
          <CategoryBars
            data={listings.topCategories.map((c) => ({ cat: c.name, count: c.count }))}
          />
        </AdminPanel>

        {/*
          Nói thẳng hai điều thay vì hiện một ô "0 lượt truy cập" trông như số thật: mốc chụp số
          liệu, và việc số liệu truy cập chưa được ghi ở đâu cả.
        */}
        <Text style={styles.foot}>
          Số liệu chụp lúc {clockOf(data.generatedAt)}. Lượt truy cập theo ngày/tháng/năm chưa
          được ghi nhận — sẽ có từ khi bật thu thập, và không dựng lại được cho quá khứ.
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Giờ:phút của mốc chụp. Cắt từ chuỗi ISO chứ không qua `toLocaleTimeString`: Hermes không mang
 * đủ dữ liệu Intl nên hàm đó trả về định dạng khác nhau giữa máy — cùng lý do `group()` ở trên
 * tự chấm nghìn thay vì gọi `toLocaleString`.
 */
function clockOf(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileAccent, { backgroundColor: accent }]} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{group(value)}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

/** Thanh tỉ lệ trong MỘT nhóm — mẫu số là tổng của chính các dòng truyền vào, không phải tổng hệ thống. */
function Split({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.label}>
          <View style={styles.splitHead}>
            <Text style={styles.splitLabel}>{r.label}</Text>
            <Text style={styles.splitValue}>{group(r.value)}</Text>
          </View>
          <View style={styles.splitTrack}>
            <View style={[styles.splitFill, { width: `${(r.value / total) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionNote}>{note}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 32 },
  stack: { gap: 18, paddingHorizontal: 18 },

  section: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 11 },
  sectionTitle: { fontFamily: F.uiBold, fontSize: 15, color: C.paper },
  sectionNote: { fontFamily: F.hand, fontSize: 13.5, color: C.cork },
  sectionRule: { flex: 1, height: 1, backgroundColor: C.deskLine },

  alert: {
    backgroundColor: C.deskPanel,
    borderLeftWidth: 3,
    borderLeftColor: C.pin,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 9,
  },
  alertText: { fontFamily: F.uiBold, fontSize: 13.5, lineHeight: 20, color: C.paper },
  alertNote: { fontFamily: F.ui, fontSize: 12, lineHeight: 18, color: C.deskTxtSoft, marginTop: 3 },
  alertCta: { fontFamily: F.uiSemi, fontSize: 12, color: C.pinLight, marginTop: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: C.deskPanel,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  tileAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  tileLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.8, color: C.deskTxtDim },
  tileValue: { fontFamily: F.uiBold, fontSize: 24, color: C.paper, marginTop: 5 },
  tileSub: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtSoft, marginTop: 2 },

  splitHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 },
  splitLabel: { flex: 1, fontFamily: F.ui, fontSize: 12.5, color: C.deskTxtSoft },
  splitValue: { fontFamily: F.monoBold, fontSize: 12.5, color: C.paper },
  splitTrack: { height: 6, borderRadius: 3, backgroundColor: C.deskHi, overflow: 'hidden' },
  splitFill: { height: 6, borderRadius: 3, backgroundColor: C.mossBright },

  foot: { fontFamily: F.ui, fontSize: 11, lineHeight: 17, color: C.deskTxtDim },
});
