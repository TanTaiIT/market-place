import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C, F, G, shadow } from '@/theme';

/**
 * Màn hình khởi động: tờ giấy rơi xuống bảng bần, đinh ghim cắm xuống, chữ ký hiện dần.
 *
 * Chỉ mount **sau khi font đã load** (xem `app/_layout.tsx`): chữ "Ghim" dùng Kalam, hiện sớm
 * hơn thì nó vẽ bằng font hệ thống rồi nhảy sang Kalam giữa chừng. Splash native che đúng
 * khoảng trống đó.
 *
 * Thoát khi **cả hai** điều kiện đủ: hết thời lượng tối thiểu, và app đã sẵn sàng. Đợi hết
 * animation là cố ý — lần khởi động nhanh mà cho vào ngay thì thành một cú nháy 200ms.
 */

/** Mốc vào của từng lớp (ms) — bám prototype, cắt phần đuôi vốn chỉ để băng keo chạy nốt. */
const T = {
  sheetA: 100,
  sheetB: 170,
  card: 260,
  letter: [480, 540, 600, 660],
  rule: 720,
  pin: 800,
  tagline: 860,
  board: 940,
  loader: 1000,
  status: 1060,
  version: 1180,
} as const;

const MIN_SHOW_MS = 1950;
const EXIT_MS = 420;

const MARK = ['G', 'h', 'i', 'm'] as const;
/** Chữ `i` là đầu đinh ghim đỏ trong chữ ký — chính là thẻ `<i>` của prototype. */
const ACCENT_INDEX = 2;

const CARD_W = 264;
const SHEET_W = 252;
const PIN_SIZE = 23;

export function BootSplash({
  ready,
  boardLabel,
  onFinish,
}: {
  /** Font + phiên đăng nhập đã hydrate xong chưa. */
  ready: boolean;
  /** Nhãn băng dính: mã trường của phiên hiện tại. Bỏ trống thì giấu hẳn mẩu băng. */
  boardLabel?: string;
  onFinish: () => void;
}) {
  const still = useReducedMotion();
  const [minDone, setMinDone] = useState(false);

  const sheetA = useSharedValue(still ? 1 : 0);
  const sheetB = useSharedValue(still ? 1 : 0);
  const card = useSharedValue(still ? 1 : 0);
  const jolt = useSharedValue(0);
  const pin = useSharedValue(still ? 1 : 0);
  const rule = useSharedValue(still ? 1 : 0);
  const fill = useSharedValue(still ? 1 : 0);
  const exit = useSharedValue(0);

  // ── Vào ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), still ? 0 : MIN_SHOW_MS);
    if (still) return () => clearTimeout(timer);

    sheetA.value = withDelay(T.sheetA, withTiming(1, { duration: 500 }));
    sheetB.value = withDelay(T.sheetB, withTiming(1, { duration: 500 }));
    card.value = withDelay(T.card, withSpring(1, { damping: 14, stiffness: 150 }));
    rule.value = withDelay(T.rule, withTiming(1, { duration: 420 }));
    fill.value = withDelay(T.loader, withTiming(1, { duration: MIN_SHOW_MS - T.loader }));

    // Tờ giấy giật xuống đúng lúc đinh cắm tới nơi — cú đóng ghim của prototype.
    pin.value = withDelay(
      T.pin,
      withTiming(1, { duration: 440 }, (done) => {
        if (done) jolt.value = withSequence(withTiming(1, { duration: 110 }), withSpring(0));
      }),
    );

    return () => clearTimeout(timer);
  }, [card, fill, jolt, pin, rule, sheetA, sheetB, still]);

  // ── Ra ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!minDone || !ready) return;

    // Ai bật "giảm chuyển động" thì bỏ hẳn màn này thay vì cho nó loé lên 0,4s rồi tắt —
    // giữ lại một tấm thẻ đứng im chẳng để làm gì, mà bar băng keo đầy sẵn lại trông như treo.
    const ms = still ? 0 : EXIT_MS;
    exit.value = withTiming(1, { duration: ms });
    const timer = setTimeout(onFinish, ms);
    return () => clearTimeout(timer);
  }, [exit, minDone, onFinish, ready, still]);

  const sheetAStyle = useAnimatedStyle(() => ({
    opacity: sheetA.value * 0.18,
    transform: [{ translateX: -SHEET_W / 2 }, { rotate: `${sheetA.value * -2.6}deg` }],
  }));

  const sheetBStyle = useAnimatedStyle(() => ({
    opacity: sheetB.value * 0.34,
    transform: [{ translateX: -SHEET_W / 2 }, { rotate: `${sheetB.value * 1.7}deg` }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value * (1 - exit.value),
    transform: [
      { translateY: (1 - card.value) * -26 + jolt.value * 3 },
      { rotate: `${-0.8 - (1 - card.value) * 2.8}deg` },
      { scale: (0.95 + card.value * 0.05) * (1 + exit.value * 2.4) },
    ],
  }));

  const pinStyle = useAnimatedStyle(() => ({
    opacity: pin.value,
    transform: [
      { translateX: -PIN_SIZE / 2 },
      { translateY: (1 - pin.value) * -58 },
      { scale: 1 + (1 - pin.value) * 0.5 },
    ],
  }));

  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  // Mũ ba: mặt bàn đứng yên lúc đầu để kịp thấy tờ giấy nở ra, rồi mới tắt gấp ở cuối.
  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value ** 3 }));

  const version = Constants.expoConfig?.version;

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      {/* Quầng đèn hắt từ trên. RN không có radial-gradient, linear dọc là đủ gần. */}
      <LinearGradient
        colors={G.glow}
        style={[StyleSheet.absoluteFill, styles.glow]}
        pointerEvents="none"
      />

      <View style={styles.stack}>
        <Animated.View style={[styles.sheet, sheetAStyle]} pointerEvents="none" />
        <Animated.View style={[styles.sheet, sheetBStyle]} pointerEvents="none" />

        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.pin, pinStyle]} />

          <View style={styles.markRow}>
            {MARK.map((char, i) => (
              <Rise key={char} delay={T.letter[i]} still={still} rise={11} tilt={-4}>
                <Text style={[styles.mark, i === ACCENT_INDEX ? styles.markAccent : null]}>
                  {char}
                </Text>
              </Rise>
            ))}
          </View>

          <View style={styles.ruleWrap}>
            <Animated.View style={[styles.rule, ruleStyle]} />
          </View>

          <Rise delay={T.tagline} still={still}>
            <Text style={styles.tagline}>Bảng tin mua bán{'\n'}trong trường bạn</Text>
          </Rise>

          {!!boardLabel && (
            <Rise delay={T.board} still={still}>
              <View style={styles.board}>
                <Text style={styles.boardText}>{boardLabel}</Text>
              </View>
            </Rise>
          )}
        </Animated.View>
      </View>

      <View style={styles.footer} pointerEvents="none">
        <Rise delay={T.loader} still={still}>
          <View style={styles.loader}>
            <Animated.View style={[styles.loaderFill, fillStyle]} />
          </View>
        </Rise>

        <Rise delay={T.status} still={still}>
          {/* Dòng chữ chỉ đổi khi thật sự còn phải chờ — không bịa tiến trình cho vui. */}
          <Text style={styles.status}>
            {minDone && !ready ? 'ĐANG CHỜ MÁY CHỦ' : 'ĐANG MỞ BẢNG'}
          </Text>
        </Rise>

        {!!version && (
          <Rise delay={T.version} still={still}>
            <Text style={styles.version}>{version}</Text>
          </Rise>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Hiện dần sau `delay`, kèm trượt lên `rise` px và ngả `tilt` độ. Sáu khối trong màn này
 * vào theo đúng một kiểu, chỉ khác biên độ — từng chữ ngả rồi dựng, phần còn lại trượt thẳng.
 */
function Rise({
  delay,
  still,
  rise = 7,
  tilt = 0,
  children,
}: {
  delay: number;
  still: boolean;
  rise?: number;
  tilt?: number;
  children: React.ReactNode;
}) {
  const v = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (!still) v.value = withDelay(delay, withTiming(1, { duration: 390 }));
  }, [delay, still, v]);

  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * rise }, { rotate: `${(1 - v.value) * tilt}deg` }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: C.desk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: { opacity: 0.16 },

  stack: { alignItems: 'center', justifyContent: 'center' },
  sheet: {
    position: 'absolute',
    top: 14,
    bottom: 12,
    left: '50%',
    width: SHEET_W,
    backgroundColor: C.paper,
    borderRadius: 9,
  },
  card: {
    width: CARD_W,
    backgroundColor: C.paperWarm,
    borderRadius: 9,
    paddingTop: 38,
    paddingHorizontal: 26,
    paddingBottom: 24,
    alignItems: 'center',
    ...shadow,
  },
  pin: {
    position: 'absolute',
    top: -11,
    left: '50%',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: C.pin,
    // RN không có radial-gradient: vệt sáng trên đầu ghim làm bằng viền trên, như NoteCard.
    borderTopWidth: 6,
    borderTopColor: C.pinLight,
    ...shadow,
  },

  markRow: { flexDirection: 'row' },
  mark: { fontFamily: F.hand, fontSize: 58, lineHeight: 66, color: C.ink },
  markAccent: { color: C.pin },

  ruleWrap: { width: 132, marginTop: 15, marginBottom: 13 },
  rule: { borderTopWidth: 1, borderTopColor: C.lineInput, borderStyle: 'dashed' },

  tagline: {
    fontFamily: F.uiSemi,
    fontSize: 12.5,
    lineHeight: 19,
    color: C.inkSoft,
    textAlign: 'center',
  },
  board: {
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.tape,
    transform: [{ rotate: '-1.4deg' }],
    ...shadow,
  },
  boardText: {
    fontFamily: F.monoBold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.tapeInk,
  },

  footer: { position: 'absolute', bottom: 40, alignItems: 'center', gap: 14 },
  loader: {
    width: 148,
    height: 9,
    backgroundColor: C.mutedTint,
    borderRadius: 1,
    overflow: 'hidden',
    transform: [{ rotate: '-1.2deg' }],
  },
  loaderFill: { height: '100%', backgroundColor: C.tape },
  status: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.3, color: C.deskTxtDim },
  version: {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: C.deskTxtDim,
    opacity: 0.7,
    textAlign: 'center',
  },
});
