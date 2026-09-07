import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BANNERS, GUIDE_STEPS, PERKS, PROMOS, type Banner } from '@/api/placeholders';
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

/**
 * Khối banner lớn giữa trang chủ — thế chỗ danh sách tin. Xếp DỌC chứ không cuộn ngang:
 * đây là mảng chính của trang, banner phải đập vào mắt khi lướt qua chứ không nấp sau
 * một cú vuốt mà không ai biết để vuốt.
 */
export function BannerBoard({ onPress }: { onPress: (banner: Banner) => void }) {
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>Dành cho bạn</Text>
      <View style={{ gap: 12 }}>
        {BANNERS.map((b) => (
          <Pressable key={b.id} onPress={() => onPress(b)} style={({ pressed }) => pressed && { opacity: 0.88 }}>
            <LinearGradient
              colors={[b.grad[0], b.grad[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                <Text style={styles.bannerBody}>{b.body}</Text>
                <View style={styles.bannerCta}>
                  <Text style={styles.bannerCtaText}>{b.cta}</Text>
                </View>
              </View>
              <Text style={styles.bannerIcon}>{b.icon}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * "Ghim hoạt động thế nào" — các bước từ đăng tin đến chốt kèo cho người mới. Số bước
 * là chỗ dựa thị giác: người lướt nhanh chỉ cần đọc 1→4 là nắm được vòng đời một tin.
 */
export function GuideStrip({ grid }: { grid?: boolean }) {
  return (
    <View style={[styles.block, grid && styles.inset, { marginTop: 18 }]}>
      <Text style={styles.heading}>Ghim hoạt động thế nào</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {GUIDE_STEPS.map((step, i) => (
          <View key={step.id} style={styles.guide}>
            <View style={styles.guideHead}>
              <View style={styles.guideNum}>
                <Text style={styles.guideNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.guideIcon}>{step.icon}</Text>
            </View>
            <Text style={styles.guideTitle}>{step.title}</Text>
            <Text style={styles.guideBody}>{step.body}</Text>
          </View>
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

  banner: { borderRadius: R.lg, padding: 20, flexDirection: 'row', alignItems: 'flex-start', ...shadow },
  bannerTitle: { fontFamily: F.uiBold, fontSize: 18, lineHeight: 24, color: '#fff' },
  bannerBody: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.glassTx, marginTop: 6 },
  /** Nút thật để bấm cả banner cũng vào — nhưng thiếu một hình dạng nút thì banner chỉ là ảnh. */
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: C.glassRaise,
    borderWidth: 1,
    borderColor: C.glassLine,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 12,
  },
  bannerCtaText: { fontFamily: F.uiBold, fontSize: 12.5, color: '#fff' },
  bannerIcon: { fontSize: 34, marginLeft: 12 },

  guide: { width: 236, backgroundColor: C.paperWarm, borderRadius: R.lg, padding: 17, ...shadow },
  guideHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  guideNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.brandLt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideNumText: { fontFamily: F.uiBold, fontSize: 14, color: C.brandTx },
  guideIcon: { fontSize: 24 },
  guideTitle: { fontFamily: F.uiBold, fontSize: 15, color: C.ink, marginBottom: 6 },
  guideBody: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.inkSoft },

  perk: { width: 280, backgroundColor: C.brandLt, borderRadius: R.lg, padding: 17, ...shadow },
  perkTitle: { fontFamily: F.uiBold, fontSize: 15.5, color: C.ink, marginBottom: 7 },
  perkBody: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 20, color: C.inkSoft },
});
