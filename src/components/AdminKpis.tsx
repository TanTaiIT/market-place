import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AdminKpi } from '@/api/admin';
import { Sparkline } from './AdminChart';
import { C, F } from '@/theme';

/** Màu mép trái mỗi thẻ — cùng bảng màu với ý nghĩa của chỉ số, không phải trang trí. */
const ACCENT: Record<AdminKpi['key'], string> = {
  pending: C.pin,
  live: C.mossBright,
  users: C.cork,
  reports: C.amber,
};

/** Hermes không có Intl đầy đủ nên `toLocaleString` không tin được — chấm nghìn bằng tay. */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function AdminKpis({ data }: { data: AdminKpi[] }) {
  return (
    <View style={styles.grid}>
      {data.map((kpi) => (
        <View key={kpi.key} style={styles.card}>
          <View style={[styles.accent, { backgroundColor: ACCENT[kpi.key] }]} />
          <Text style={styles.label}>{kpi.label}</Text>
          <Text style={styles.value}>{group(kpi.value)}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.delta, { color: kpi.direction === 'up' ? C.okText : C.badText }]}>
                {kpi.delta}
              </Text>
              <Text style={styles.note}>{kpi.note}</Text>
            </View>
            <Sparkline points={kpi.trend} color={ACCENT[kpi.key]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    // Hai thẻ một hàng: `48%` chừa đúng chỗ cho `gap: 12` mà không phải đo bề rộng màn hình.
    width: '48%',
    flexGrow: 1,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 13,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, opacity: 0.75 },
  label: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.deskTxtDim,
  },
  value: { fontFamily: F.monoBold, fontSize: 27, color: C.paper, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 7 },
  delta: { fontFamily: F.monoBold, fontSize: 11 },
  note: { fontFamily: F.ui, fontSize: 10, color: C.deskTxtDim, marginTop: 2 },
});
