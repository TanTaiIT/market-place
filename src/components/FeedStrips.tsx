import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PERKS, PROMOS } from '@/api/placeholders';
import { C, F, R, shadow } from '@/theme';

/**
 * Hai dải ngang của màn Khám phá trong prototype: "Đang diễn ra" (banner khuyến mãi) và "Vì sao
 * chọn Ghim" (khối lợi ích).
 *
 * Nội dung là HARDCODE — hệ thống chưa có khuyến mãi, và khối lợi ích là chữ tiếp thị chứ không
 * phải dữ liệu. Cả hai nằm ở `@/api/placeholders` cùng chỗ với các số tạm khác để gỡ một lượt.
 *
 * Tách khỏi `feed.tsx` vì màn đó đã chạm trần LOC của route, và hai dải này là trang trí thuần —
 * không đọc query nào, không nhận sự kiện nào.
 */
export function PromoStrip({ grid }: { grid?: boolean }) {
  return (
    <View style={[styles.block, grid && styles.inset]}>
      <Text style={styles.heading}>Đang diễn ra</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PROMOS.map((p) => (
          <LinearGradient
            key={p.id}
            colors={[p.grad[0], p.grad[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promo}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>{p.title}</Text>
              <Text style={styles.promoNote}>{p.note}</Text>
            </View>
            <Text style={styles.promoBig}>{p.big}</Text>
          </LinearGradient>
        ))}
      </ScrollView>
    </View>
  );
}

export function PerkStrip({ grid }: { grid?: boolean }) {
  return (
    <View style={[styles.block, grid && styles.inset, { marginTop: 18 }]}>
      <Text style={styles.heading}>Vì sao chọn Ghim</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PERKS.map((k) => (
          <View key={k.id} style={styles.perk}>
            <Text style={styles.perkTitle}>{k.title}</Text>
            <Text style={styles.perkBody}>{k.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 18 },
  /** Chế độ LƯỚI không có lề ngang ở container của danh sách nên dải phải tự bù. */
  inset: { paddingHorizontal: 16 },
  heading: { fontFamily: F.uiBold, fontSize: 21, color: C.ink, marginBottom: 12, letterSpacing: -0.3 },
  /* Dải cuộn ngang tràn ra ngoài lề của danh sách, nên tự bù lề bằng `paddingRight`. */
  row: { gap: 11, paddingRight: 4 },

  promo: {
    width: 268,
    height: 132,
    borderRadius: R.md,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  promoTitle: { fontFamily: F.uiBold, fontSize: 17, lineHeight: 22, color: '#fff', maxWidth: 150 },
  promoNote: { fontFamily: F.ui, fontSize: 11.5, color: C.glassTx, marginTop: 5 },
  promoBig: { fontFamily: F.uiBold, fontSize: 30, color: '#fff' },

  perk: { width: 280, backgroundColor: C.brandLt, borderRadius: R.lg, padding: 17, ...shadow },
  perkTitle: { fontFamily: F.uiBold, fontSize: 15.5, color: C.ink, marginBottom: 7 },
  perkBody: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 20, color: C.inkSoft },
});
