import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen, AdminSwitch, SettingRow } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminSchools, useSchoolLinks, useToggleSchoolLink } from '@/queries/admin-people';
import { C, F } from '@/theme';

/**
 * Trường và liên kết giữa các trường. Bật liên kết = học sinh hai trường thấy tin của nhau,
 * nên đây là công tắc đổi phạm vi hiển thị của cả bảng tin, không phải một tuỳ chọn hiển thị.
 */
export default function AdminSchools() {
  const toast = useToast();
  const { data: schools, error, isLoading } = useAdminSchools();
  const { data: links } = useSchoolLinks();
  const toggle = useToggleSchoolLink();

  return (
    <AdminScreen title="Trường & hệ thống" note="ai nối với ai">
      <ScrollView contentContainerStyle={styles.body}>
        {isLoading ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : (
          <View style={{ gap: 12 }}>
            {(schools ?? []).map((school) => (
              <View key={school.name} style={styles.card}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Trường {school.name}</Text>
                </View>

                <View style={styles.figures}>
                  <View>
                    <Text style={styles.figureLabel}>HỌC SINH</Text>
                    <Text style={styles.figureValue}>{school.students}</Text>
                  </View>
                  <View>
                    <Text style={styles.figureLabel}>TIN ĐĂNG</Text>
                    <Text style={styles.figureValue}>{school.listings}</Text>
                  </View>
                </View>

                <Text style={styles.meta}>
                  QUẢN TRỊ: {school.admin.toUpperCase()} · THAM GIA {school.since}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liên kết hệ thống</Text>
          <Text style={styles.sectionNote}>cho phép xem tin chéo</Text>
          <View style={styles.sectionRule} />
        </View>

        <AdminPanel flush title="Phạm vi giữa hai trường">
          {(links ?? []).map((link) => (
            <SettingRow key={link.id} title={link.title} desc={link.desc}>
              <AdminSwitch
                value={link.on}
                onChange={() =>
                  toggle.mutate(link.id, {
                    onSuccess: (next) =>
                      toast(next.on ? `Đã bật · ${next.title}` : `Đã tắt · ${next.title}`),
                    onError: (e: Error) => toast(`⚠️ ${e.message}`),
                  })
                }
              />
            </SettingRow>
          ))}
        </AdminPanel>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  card: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 14,
    padding: 16,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
    backgroundColor: C.cork,
  },
  chipText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.desk },
  figures: { flexDirection: 'row', gap: 28, marginTop: 14 },
  figureLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.deskTxtDim },
  figureValue: { fontFamily: F.monoBold, fontSize: 20, color: C.paper, marginTop: 3 },
  meta: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim, marginTop: 14 },

  section: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 26, marginBottom: 11 },
  sectionTitle: { fontFamily: F.uiBold, fontSize: 15, color: C.paper },
  sectionNote: { fontFamily: F.hand, fontSize: 13.5, color: C.cork },
  sectionRule: { flex: 1, height: 1, backgroundColor: C.deskLine },
});
