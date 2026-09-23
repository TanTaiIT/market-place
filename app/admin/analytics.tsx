import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { ListingReportPanels, UserReportPanels } from '@/components/ReportPanels';
import { EmptyState, Loading } from '@/components/ui';
import { useListingReport, useUserReport } from '@/queries/admin-system';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
import type { ReportGranularity } from '@/api/admin-system';
import { useOrgId } from '@/stores/auth';
import { C, F } from '@/theme';

/**
 * Thống kê — KHUNG chứa nhiều báo cáo con. Master không chọn org thấy cả sàn; quản trị nhóm
 * (hoặc master đang đứng trong một org) thấy bản CỦA NHÓM — BE scope theo `X-Org-Id`, màn này
 * chỉ đổi nhãn cho đúng thứ đang đếm (thành viên vào nhóm, không phải tài khoản mới của sàn).
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
  const master = isMaster(useMyGrants().data);
  const orgScoped = Boolean(useOrgId());

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
    <AdminScreen
      title="Thống kê"
      note={orgScoped ? 'xu hướng của nhóm theo thời gian' : 'xu hướng theo thời gian'}
      // Quản trị nhóm phải đứng trong một org (BE 403 nếu không); master thì tuỳ — không chọn là
      // toàn sàn, chọn một org là xem bản của nhóm đó.
      org={master ? 'optional' : true}
      masterReadsAll
    >
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
            <EmptyState
              icon="👥"
              onDark
              text={
                orgScoped
                  ? 'Chưa có thành viên nào vào nhóm trong khoảng này'
                  : 'Chưa có tài khoản nào trong khoảng này'
              }
            />
          ) : (
            <UserReportPanels
              points={users.data.points}
              totals={users.data.totals}
              granularity={granularity}
              meta={meta}
              orgScoped={orgScoped}
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
