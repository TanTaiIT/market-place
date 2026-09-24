import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { CategoryBars, TrendChart } from '@/components/AdminChart';
import { AdminKpis } from '@/components/AdminKpis';
import { AdminReviewDesk } from '@/components/AdminReviewDesk';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminSystemOverview } from '@/components/AdminSystemOverview';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { canModerateOrg, canModeratePublicAxis, isMaster } from '@/api/admin';
import {
  useAdminActivity,
  useAdminActivityStream,
  useAdminListings,
  useAdminOverview,
  useMyGrants,
  useSetListingStatus,
} from '@/queries/admin';
import type { AdminEvent, ModListing } from '@/api/admin';
import { C, F } from '@/theme';

const EVENT_TONE: Record<AdminEvent['tone'], string> = {
  ok: C.mossBright,
  alert: C.pin,
  note: C.tape,
  info: C.cork,
  muted: C.deskTxtDim,
};

/**
 * `/admin` là MỘT route nhưng HAI bàn khác nhau, rẽ theo vai — không phải hai đường dẫn.
 *
 * Giữ một route vì ngăn kéo trỏ vào đó cho cả hai loại người dùng, và vì 'trang chủ của bàn
 * quản trị' là một khái niệm chung: chỉ nội dung của nó mới đổi theo việc bạn làm gì ở đây.
 * Tách thành `/admin` + `/admin/system` sẽ để lại một câu hỏi không có câu trả lời đúng —
 * master vào `/admin` thì thấy gì?
 *
 * `useMyGrants` là nguồn duy nhất phân biệt, KHÔNG phải `memberships.role`: master cố ý không
 * thuộc tổ chức nào (xem `canAdminOrg` bên `api/admin.ts`).
 */
export default function AdminOverview() {
  const { data: grants } = useMyGrants();

  /*
   * Bàn hệ thống dựng SafeArea/header riêng của nó qua `AdminScreen` ở đây, nhưng KHÔNG nhận
   * prop `org`: nó không đọc `X-Org-Id` một dòng nào. Truyền `org` vào sẽ dựng lại đúng cái
   * cửa 'chọn tổ chức để mở' mà cả thay đổi này sinh ra để bỏ đi.
   */
  if (isMaster(grants)) {
    return (
      <AdminScreen title="Bàn quản trị" note="toàn hệ thống">
        <AdminSystemOverview />
      </AdminScreen>
    );
  }

  /*
   * Người phụ trách DANH MỤC mà không quản trị nhóm nào — bàn của họ là TRỤC CÔNG KHAI.
   *
   * Không có nhánh này thì họ rơi vào `OrgOverview`, một màn khai `org` và vì thế dựng cửa
   * 'chọn tổ chức' chắn ngang. Mà họ KHÔNG thuộc tổ chức nào, cũng không cần thuộc: phạm vi
   * của họ đến từ `role_grants`, BE không đọc `X-Org-Id` ở một màn nào của trục này. Cửa đó
   * bảo họ đi tìm một tổ chức để tham gia — một việc vô nghĩa với vai của họ, và làm xong
   * cũng không mở ra được gì.
   *
   * Kẹp `!canModerateOrg` chứ không chỉ hỏi `canModeratePublicAxis`: người vừa phụ trách danh
   * mục vừa quản trị một nhóm thì bàn org mới là trang chủ đúng — ngăn kéo của họ có cả hai
   * nhóm mục, và trục công khai chỉ cách một cú chạm.
   *
   * `grants` chưa về là cả hai vị từ đều `false`, nên không có cú nhảy nào bắn ra lúc đang tải.
   */
  if (canModeratePublicAxis(grants) && !canModerateOrg(grants)) {
    return <Redirect href="/admin/public-overview" />;
  }

  return <OrgOverview />;
}

/** Bàn của MỘT tổ chức — 'việc hôm nay': hàng đợi duyệt nằm ngay trên màn. */
function OrgOverview() {
  const toast = useToast();
  const { data: overview, error, isLoading } = useAdminOverview();
  const { data: events } = useAdminActivity();
  const { data: queue, total: queueTotal } = useAdminListings('pending');
  const setStatus = useSetListingStatus();

  // Vào phòng quản trị: thao tác của người khác hiện lên ngay ở "Vừa diễn ra".
  useAdminActivityStream();

  const decide = (item: ModListing, status: 'active' | 'rejected', reason?: string) =>
    setStatus.mutate(
      { id: item.id, status, reason },
      {
        onSuccess: () =>
          toast(status === 'active' ? `📌 Đã ghim "${item.title}" lên bảng` : `Đã từ chối · ${reason}`),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <AdminScreen title="Bàn quản trị" note="việc hôm nay" org>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Loading onDark />
        ) : error || !overview ? (
          <EmptyState
            icon="📡"
            onDark
            text={(error as Error | null)?.message ?? 'Không tải được số liệu'}
          />
        ) : (
          <View style={styles.stack}>
            <AdminKpis data={overview.kpis} />

            <View>
              <SectionTitle title="Bàn duyệt" note="duyệt xong rồi hãy đi ngủ" />
              <AdminPanel title="Tin chờ lên bảng" note={`còn ${queueTotal} tin`}>
                <AdminReviewDesk
                  queue={queue ?? []}
                  busy={setStatus.isPending}
                  onApprove={(item) => decide(item, 'active')}
                  onReject={(item, reason) => decide(item, 'rejected', reason)}
                />
              </AdminPanel>
            </View>

            <AdminPanel title="Vừa diễn ra" note="trực tiếp">
              {(events ?? []).length === 0 ? (
                <Text style={styles.evEmpty}>Chưa có thao tác quản trị nào được ghi lại.</Text>
              ) : (
                (events ?? []).map((ev, i) => (
                  <View key={ev.id} style={[styles.ev, i > 0 && styles.evDivider]}>
                    <View style={[styles.evDot, { backgroundColor: EVENT_TONE[ev.tone] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.evText}>{ev.text}</Text>
                      <Text style={styles.evTime}>{ev.time}</Text>
                    </View>
                  </View>
                ))
              )}
            </AdminPanel>

            <View>
              <SectionTitle title="Nhịp hoạt động" note="14 ngày gần nhất" />
              <AdminPanel title="Tin đăng mỗi ngày" note="liền: đã duyệt · đứt: chờ duyệt">
                <TrendChart data={overview.trend} />
              </AdminPanel>
            </View>

            <AdminPanel title="Danh mục sôi động">
              <CategoryBars data={overview.cats} />
            </AdminPanel>
          </View>
        )}
      </ScrollView>
    </AdminScreen>
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

  ev: { flexDirection: 'row', gap: 11, paddingVertical: 11 },
  evDivider: { borderTopWidth: 1, borderTopColor: C.deskLine },
  evDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  evText: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.deskTxtSoft },
  evTime: { fontFamily: F.mono, fontSize: 10, color: C.deskTxtDim, marginTop: 4 },
  evEmpty: { fontFamily: F.ui, fontSize: 12.5, color: C.deskTxtDim },
});
