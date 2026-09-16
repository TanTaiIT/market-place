import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BANNERS, GUIDE_STEPS, PERKS, PROMOS, type Banner } from '@/api/placeholders';
import { SectionHead } from './SectionHead';
import { C, F, R, S, T, shadow } from '@/theme';

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
      <SectionHead title="Đang diễn ra" />
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
      <SectionHead title="Dành cho bạn" />
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
    <View style={[styles.block, grid && styles.inset, { marginTop: S.md }]}>
      <SectionHead title="Ghim hoạt động thế nào" />
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
    <View style={[styles.block, grid && styles.inset, { marginTop: S.md }]}>
      <SectionHead title="Vì sao chọn Ghim" />
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
  /* Ba dòng đầu KHỚP TỪNG SỐ với `FeedHighlights`: hai file cùng vẽ 'một mục của bảng tin', lệch
     nhau vài pixel là mắt đọc ra hai nhịp khác nhau trên cùng một màn cuộn. */
  block: { marginBottom: S.xl },
  inset: { paddingHorizontal: S.lg },
  /* Dải cuộn ngang tràn ra ngoài lề của danh sách, nên tự bù lề bằng `paddingRight`. */
  row: { gap: S.md, paddingRight: S.xs },

  promo: {
    width: 268,
    height: 132,
    borderRadius: R.md,
    padding: S.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  promoTitle: { fontFamily: F.uiBold, ...T.md, color: '#fff', maxWidth: 150 },
  promoNote: { fontFamily: F.ui, ...T.xs, color: C.glassTx, marginTop: S.xs },
  /* Con số lớn của thẻ khuyến mãi — HÌNH, không phải chữ, nên đứng ngoài thang `T` như
     `circleIcon`. Đây là dòng duy nhất mỗi màn được phép to thế này. */
  promoBig: { fontFamily: F.uiBold, fontSize: 30, color: '#fff' },

  banner: { borderRadius: R.lg, padding: S.lg, flexDirection: 'row', alignItems: 'flex-start', ...shadow },
  bannerTitle: { fontFamily: F.uiBold, ...T.lg, color: '#fff' },
  bannerBody: { fontFamily: F.ui, ...T.sm, color: C.glassTx, marginTop: S.sm },
  /** Nút thật để bấm cả banner cũng vào — nhưng thiếu một hình dạng nút thì banner chỉ là ảnh. */
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: C.glassRaise,
    borderWidth: 1,
    borderColor: C.glassLine,
    borderRadius: R.pill,
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    marginTop: S.md,
  },
  bannerCtaText: { fontFamily: F.uiBold, ...T.sm, color: '#fff' },
  bannerIcon: { fontSize: 34, marginLeft: S.md },

  guide: { width: 236, backgroundColor: C.paperWarm, borderRadius: R.lg, padding: S.lg, ...shadow },
  guideHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: S.md,
  },
  guideNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.brandLt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideNumText: { fontFamily: F.uiBold, ...T.sm, color: C.brandTx },
  guideIcon: { fontSize: 24 },
  guideTitle: { fontFamily: F.uiBold, ...T.md, color: C.ink, marginBottom: S.xs },
  guideBody: { fontFamily: F.ui, ...T.sm, color: C.inkSoft },

  perk: { width: 280, backgroundColor: C.brandLt, borderRadius: R.lg, padding: S.lg, ...shadow },
  perkTitle: { fontFamily: F.uiBold, ...T.md, color: C.ink, marginBottom: S.sm },
  perkBody: { fontFamily: F.ui, ...T.sm, color: C.inkSoft },
});
