import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AdminPanel } from './AdminScreen';
import { ReportColumns } from './AdminChart';
import type {
  ListingReportPoint,
  ReportGranularity,
  UserReportPoint,
} from '@/api/admin-system';
import { C, F } from '@/theme';

/**
 * Ruột của từng báo cáo con. Thuần trình bày — mọi dữ liệu vào qua props, không hook, không
 * query (`component.convention`).
 *
 * Tách khỏi màn Thống kê vì màn đó chỉ còn là KHUNG: bộ chọn báo cáo con, bộ chọn độ mịn, và
 * hai trạng thái loading/error dùng chung. Nhồi cả hai bộ panel vào đó thì mỗi báo cáo con
 * thêm vào là màn phình thêm một đoạn, và trần 250 dòng vỡ ở cái thứ ba.
 *
 * Hai bộ panel ở CHUNG một file vì chúng là cùng một thứ ở hai hình dạng — sửa cách hiển thị
 * cột thì sửa cả hai cùng lúc, và để hai file cạnh nhau chỉ tổ lệch nhau dần.
 */

/** Hermes không có Intl đầy đủ — chấm nghìn bằng tay, cùng cách với `formatPrice`. */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const UNIT: Record<ReportGranularity, string> = {
  day: 'ngày',
  month: 'tháng',
  year: 'năm',
};

/**
 * Nhãn cột rút gọn cho trục x: `2026-09-08` → `08/09`, `2026-09` → `09/26`, `2026` → `2026`.
 *
 * Cắt chuỗi chứ không `new Date()`: nhãn BE trả về đã là ngày theo giờ Việt Nam, mà dựng lại
 * `Date` rồi format sẽ quy đổi thêm một lần theo múi giờ của MÁY người xem — một người mở app
 * ở Nhật sẽ thấy trục lệch một ngày so với chính con số bên cạnh.
 */
export function tickLabel(bucket: string): string {
  const [y, m, d] = bucket.split('-');
  if (d) return `${d}/${m}`;
  if (m) return `${m}/${y!.slice(2)}`;
  return y!;
}

/** Mới nhất trước. Nhãn cột là ISO đã đệm số 0 nên thứ tự chữ trùng thứ tự thời gian. */
const newestFirst = <T extends { bucket: string }>(rows: readonly T[]) =>
  rows.slice().sort((a, b) => (a.bucket < b.bucket ? 1 : -1));

export function ListingReportPanels({
  points,
  totals,
  granularity,
  meta,
}: {
  points: readonly ListingReportPoint[];
  totals: { posts: number; active: number; pending: number; rejected: number };
  granularity: ReportGranularity;
  meta: React.ReactNode;
}) {
  const perBucket = points.length > 0 ? totals.posts / points.length : 0;

  return (
    <>
      <AdminPanel title="Tin đăng theo thời gian">
        <ReportColumns points={points.map((p) => ({ bucket: p.bucket, value: p.posts }))} labelOf={tickLabel} />
        {meta}
      </AdminPanel>

      <AdminPanel title="Tổng trong kỳ">
        <View style={styles.kpis}>
          <Kpi label="Tin đăng" value={group(totals.posts)} tone={C.deskTxt} />
          <Kpi label="Đang hiển thị" value={group(totals.active)} tone={C.mossBright} />
          <Kpi label="Chờ duyệt" value={group(totals.pending)} tone={C.tape} />
          <Kpi label="Bị từ chối" value={group(totals.rejected)} tone={C.pinLight} />
        </View>
        <Text style={styles.note}>
          Trung bình {perBucket.toFixed(1)} tin mỗi {UNIT[granularity]}
        </Text>
      </AdminPanel>

      <AdminPanel title="Chi tiết từng cột">
        {/*
          Bảng số đi kèm biểu đồ, không thay thế nó: hình cho thấy xu hướng, số cho phép đối
          chiếu một cột cụ thể. Chỉ hiện cột CÓ tin — cột rỗng cần cho hình dạng của biểu đồ,
          nhưng một danh sách toàn số 0 thì chỉ tổ phải cuộn.
        */}
        {newestFirst(points.filter((p) => p.posts > 0)).map((p) => (
          <Row key={p.bucket} bucket={p.bucket} left={`${group(p.posts)} tin`} right={`${group(p.sellers)} người`} />
        ))}
      </AdminPanel>
    </>
  );
}

export function UserReportPanels({
  points,
  totals,
  granularity,
  meta,
}: {
  points: readonly UserReportPoint[];
  totals: { users: number; total: number };
  granularity: ReportGranularity;
  meta: React.ReactNode;
}) {
  const perBucket = points.length > 0 ? totals.users / points.length : 0;
  // Người có đăng tin ở cột CUỐI — chỉ số "đang sống" gần nhất, không cộng dồn được vì cùng
  // một người hoạt động ở nhiều cột.
  const activeNow = points.at(-1)?.active ?? 0;

  return (
    <>
      <AdminPanel title="Người dùng mới theo thời gian">
        {/* `unit` phải truyền: mặc định là "tin", để nguyên thì nhãn đỉnh ghi "đỉnh 12 tin"
            trên một biểu đồ đang đếm người. */}
        <ReportColumns
          points={points.map((p) => ({ bucket: p.bucket, value: p.users }))}
          labelOf={tickLabel}
          unit="người"
        />
        {meta}
      </AdminPanel>

      <AdminPanel title="Tổng trong kỳ">
        <View style={styles.kpis}>
          <Kpi label="Người dùng mới" value={group(totals.users)} tone={C.mossBright} />
          <Kpi label="Tổng tài khoản" value={group(totals.total)} tone={C.deskTxt} />
          <Kpi label={`Có đăng tin (${UNIT[granularity]} cuối)`} value={group(activeNow)} tone={C.sky} />
        </View>
        <Text style={styles.note}>
          Trung bình {perBucket.toFixed(1)} người mới mỗi {UNIT[granularity]}
        </Text>
        {/*
          Nói thẳng vì đây là chỗ dễ mừng hụt nhất của mọi báo cáo tăng trưởng: tài khoản mới
          không phải người dùng thật cho tới khi họ làm gì đó.
        */}
        <Text style={styles.note}>
          &quot;Có đăng tin&quot; đếm người ĐĂNG ít nhất một tin trong cột — không nhất thiết là
          người mới.
        </Text>
      </AdminPanel>

      <AdminPanel title="Chi tiết từng cột">
        {newestFirst(points.filter((p) => p.users > 0 || p.active > 0)).map((p) => (
          <Row
            key={p.bucket}
            bucket={p.bucket}
            left={`+${group(p.users)} mới`}
            right={`${group(p.active)} đăng tin`}
          />
        ))}
      </AdminPanel>
    </>
  );
}

function Row({ bucket, left, right }: { bucket: string; left: string; right: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.bucket}>{bucket}</Text>
      <Text style={styles.cell}>{left}</Text>
      <Text style={[styles.cell, { color: C.deskTxtDim }]}>{right}</Text>
    </View>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, { color: tone }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { minWidth: '44%', flexGrow: 1, gap: 2 },
  kpiValue: { fontFamily: F.monoBold, fontSize: 22 },
  kpiLabel: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtSoft },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.deskTxtSoft, marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  bucket: { flex: 1, fontFamily: F.mono, fontSize: 11.5, color: C.deskTxt },
  cell: { fontFamily: F.mono, fontSize: 11.5, color: C.deskTxtSoft, minWidth: 78, textAlign: 'right' },
});
