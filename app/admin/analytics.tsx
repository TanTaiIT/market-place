import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { ListingReportPanels, UserReportPanels } from '@/components/ReportPanels';
import { EmptyState, Loading } from '@/components/ui';
import { useListingReport, useUserReport } from '@/queries/admin-system';
import type { ReportGranularity } from '@/api/admin-system';
import { C, F } from '@/theme';

/**
 * Thống kê — KHUNG chứa nhiều báo cáo con, master-only.
 *
 * Một màn thay vì mỗi báo cáo một mục menu: hai câu hỏi "tin đăng thế nào" và "người dùng thế
 * nào" luôn được hỏi cùng lúc và luôn cùng một khoảng thời gian. Tách ra thì người xem phải
 * đặt lại độ mịn ở mỗi màn, rồi tự nhớ mình đang so hai khoảng có khớp nhau không.
 *
 * KHÁC hai màn dễ nhầm: `/admin/reports` là ĐƠN TỐ CÁO của người dùng, `/admin/posting-stats`
 * là ảnh chụp một cửa sổ để chốt giá gói tin. Màn này là XU HƯỚNG theo thời gian.
 *
 * Ruột từng báo cáo con nằm ở `ReportPanels` — màn này chỉ giữ hai bộ chọn và ba trạng thái
 * dùng chung (đang tải / lỗi / rỗng), nên thêm báo cáo con thứ ba là thêm một nhánh, không
 * phải thêm một đoạn dài.
 */

const TABS = [
  { value: 'listings', label: '📊 Tin đăng' },
  { value: 'users', label: '👥 Người dùng' },
];

const GRAINS = [
  { value: 'day', label: 'Theo ngày' },
  { value: 'month', label: 'Theo tháng' },
  { value: 'year', label: 'Theo năm' },
];

export default function AdminAnalytics() {
  const [tab, setTab] = useState('listings');
  const [granularity, setGranularity] = useState<ReportGranularity>('day');

  /*
   * Gọi CẢ HAI hook — quy tắc hook cấm gọi có điều kiện — và tắt cái không dùng bằng `enabled`.
   * Thiếu vế thứ hai là mỗi lần đổi độ mịn có hai aggregate quét cả bảng chạy song song, một
   * trong hai không ai nhìn.
   */
  const listings = useListingReport({ granularity }, tab === 'listings');
  const users = useUserReport({ granularity }, tab === 'users');
  const active = tab === 'listings' ? listings : users;

  const meta = active.data ? (
    // Múi giờ phải nói ra: "ngày" ở đây là ngày Việt Nam, không phải ngày máy đang xem.
    <Text style={styles.tz}>
      Gộp theo giờ {active.data.timezone} · {active.data.points.length} cột
      {active.data.truncated > 0 ? ` · đã cắt ${active.data.truncated} cột cũ nhất` : ''}
    </Text>
  ) : null;

  return (
    <AdminScreen title="Thống kê" note="xu hướng theo thời gian">
      <AdminFilter options={TABS} value={tab} onChange={setTab} />
      <AdminFilter
        options={GRAINS}
        value={granularity}
        onChange={(next) => setGranularity(next as ReportGranularity)}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {active.isPending ? (
          <Loading onDark />
        ) : active.error ? (
          <EmptyState icon="📡" onDark text={(active.error as Error).message} />
        ) : tab === 'listings' && listings.data ? (
          listings.data.totals.posts === 0 ? (
            <EmptyState icon="📊" onDark text="Chưa có tin đăng nào trong khoảng này" />
          ) : (
            <ListingReportPanels
              points={listings.data.points}
              totals={listings.data.totals}
              granularity={granularity}
              meta={meta}
            />
          )
        ) : users.data ? (
          users.data.totals.total === 0 ? (
            <EmptyState icon="👥" onDark text="Chưa có tài khoản nào trong khoảng này" />
          ) : (
            <UserReportPanels
              points={users.data.points}
              totals={users.data.totals}
              granularity={granularity}
              meta={meta}
            />
          )
        ) : (
          <AdminPanel title="Không có dữ liệu">
            <Text style={styles.tz}>Thử đổi độ mịn hoặc tải lại màn hình.</Text>
          </AdminPanel>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  tz: { fontFamily: F.mono, fontSize: 9, color: C.deskTxtDim, marginTop: 8 },
});
