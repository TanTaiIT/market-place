import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CategoryBars, TrendChart } from '@/components/AdminChart';
import { AdminKpis } from '@/components/AdminKpis';
import { AdminReviewDesk } from '@/components/AdminReviewDesk';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAdminActivity,
  useAdminActivityStream,
  useAdminListings,
  useAdminOverview,
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

export default function AdminOverview() {
  const toast = useToast();
  const { data: overview, error, isLoading } = useAdminOverview();
  const { data: events } = useAdminActivity();
  const { data: queue } = useAdminListings('pending');
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
    <AdminScreen title="Bàn quản trị" note="việc hôm nay">
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
              <AdminPanel title="Tin chờ lên bảng" note={`còn ${queue?.length ?? 0} tin`}>
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
                  <View key={`${ev.time}-${ev.text}`} style={[styles.ev, i > 0 && styles.evDivider]}>
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
