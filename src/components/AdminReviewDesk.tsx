import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
// `runOnJS` của Reanimated đã deprecated từ worklets 0.5 — đường chính thức giờ là hàm này.
import { scheduleOnRN } from 'react-native-worklets';
import type { ModListing } from '@/api/admin';
import { ListingPhoto } from './ListingPhoto';
import { PinButton } from './ui';
import { C, F, shadow } from '@/theme';

/**
 * Bàn duyệt — nơi quản trị ngồi lâu nhất, nên nó là thẻ giấy thật chứ không phải một hàng bảng:
 * mỗi lượt đúng một tin, đủ chỗ đọc mô tả, quyết xong thì tờ giấy bay khỏi xấp.
 *
 * Component **không** gọi mutation (folder.convention §6) — nó báo lên qua `onApprove`/`onReject`
 * và tự giấu tin vừa xử lý cho tới khi refetch trả về, nếu không tờ vừa bay ra sẽ nảy lại.
 */

const REJECT_REASONS = [
  'Ảnh không rõ món đồ',
  'Sai danh mục',
  'Thiếu thông tin liên hệ',
  'Nghi ngờ lừa đảo',
  'Món đồ không được phép bán',
];

/** Đủ dài để tờ giấy ra khỏi khung, đủ ngắn để duyệt liên tục không thấy chờ. */
const FLY_MS = 320;

export function AdminReviewDesk({
  queue,
  busy,
  onApprove,
  onReject,
}: {
  queue: ModListing[];
  busy?: boolean;
  onApprove: (item: ModListing) => void;
  onReject: (item: ModListing, reason: string) => void;
}) {
  const [handled, setHandled] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [showReasons, setShowReasons] = useState(false);

  const left = queue.filter((l) => !handled.includes(l.id));
  // "Để sau" đẩy tin xuống cuối thay vì bỏ hẳn: sắp lại thứ tự chứ không đổi tập hợp, nên
  // refetch về vẫn khớp và tin không biến mất khỏi hàng đợi.
  const ordered = [
    ...left.filter((l) => !deferred.includes(l.id)),
    ...left.filter((l) => deferred.includes(l.id)),
  ];
  const current = ordered[0];

  const flight = useSharedValue(0);
  const up = useSharedValue(1);
  const slipStyle = useAnimatedStyle(() => ({
    opacity: 1 - flight.value,
    transform: [
      { translateY: flight.value * (up.value ? -150 : 96) },
      { translateX: flight.value * (up.value ? -44 : 0) },
      { rotate: `${-0.7 + flight.value * (up.value ? -16 : 9)}deg` },
      { scale: 1 - flight.value * 0.14 },
    ],
  }));

  /*
   * Quyết định chờ animation xong mới gửi đi, và nó nằm trong `ref` chứ không đi qua tham số
   * của `runOnJS`: callback của `withTiming` chạy trên luồng UI, mà đẩy một closure JS qua ranh
   * giới luồng thì Reanimated phải serialize — ref thì luồng JS đọc trực tiếp, không phải gửi gì.
   */
  const decided = useRef<{ id: string; send: () => void } | null>(null);

  /** Chạy sau khi animation xong: giấu tin, trả tờ giấy về vị trí cho tin kế tiếp. */
  const settle = () => {
    const job = decided.current;
    if (!job) return;
    decided.current = null;
    setHandled((list) => [...list, job.id]);
    flight.value = 0;
    job.send();
  };

  const decide = (goUp: boolean, send: () => void) => {
    if (!current || busy || decided.current) return;
    decided.current = { id: current.id, send };
    up.value = goUp ? 1 : 0;
    flight.value = withTiming(1, { duration: FLY_MS }, (done) => {
      if (done) scheduleOnRN(settle);
    });
  };

  const approve = () => {
    const item = current;
    if (item) decide(true, () => onApprove(item));
  };

  const reject = (reason: string) => {
    const item = current;
    setShowReasons(false);
    if (item) decide(false, () => onReject(item, reason));
  };

  const skip = () => {
    if (!current) return;
    setDeferred((list) => [...list.filter((id) => id !== current.id), current.id]);
  };

  if (!current) {
    return (
      <View style={styles.deskEmpty}>
        <View style={styles.donePin} />
        <Text style={styles.doneTitle}>Hết tin chờ rồi</Text>
        <Text style={styles.doneBody}>
          Bảng tin đang sạch. Tin mới gửi lên sẽ xuất hiện ngay tại đây.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.stack}>
        {/* Hai tờ lệch phía sau cho cảm giác xấp hồ sơ — thuần trang trí, không nhận chạm */}
        <View pointerEvents="none" style={[styles.ghost, styles.ghostBack]} />
        <View pointerEvents="none" style={[styles.ghost, styles.ghostFront]} />

        <Animated.View key={current.id} entering={FadeInDown.duration(280).springify().damping(16)}>
          <Animated.View style={[styles.slip, slipStyle]}>
            <View style={styles.slipPin} />
            <View style={styles.slipTop}>
              <ListingPhoto photo={current.photo} style={styles.slipPhoto} imageStyle={styles.slipPhotoRadius} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.slipCat}>{current.cat}</Text>
                <Text style={styles.slipTitle}>{current.title}</Text>
                <Text style={styles.slipPrice}>{current.price}</Text>
              </View>
            </View>

            <Text style={styles.slipDesc}>{current.desc}</Text>

            <View style={styles.slipMeta}>
              <Text style={styles.slipMetaText}>
                <Text style={styles.slipMetaStrong}>{current.seller}</Text> · {current.cat}
              </Text>
              <Text style={styles.slipMetaText}>gửi {current.at}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {showReasons && (
        <Animated.View entering={FadeInDown.duration(160)} style={styles.reasons}>
          <Text style={styles.reasonsTitle}>Từ chối vì lý do gì?</Text>
          <View style={styles.reasonRow}>
            {REJECT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                onPress={() => reject(reason)}
                style={({ pressed }) => [styles.tag, pressed && { borderColor: C.pin }]}
              >
                <Text style={styles.tagText}>{reason}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      <View style={styles.acts}>
        <PinButton label="📌 Ghim lên bảng" tone="ok" depth={5} style={{ flex: 1 }} onPress={approve} />
        <Pressable
          onPress={() => setShowReasons((v) => !v)}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.secondaryText}>Từ chối</Text>
        </Pressable>
        <Pressable onPress={skip} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.ghostBtnText}>Để sau</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { paddingTop: 14, paddingBottom: 18, alignItems: 'center' },
  ghost: {
    position: 'absolute',
    top: 22,
    left: '6%',
    right: '6%',
    bottom: 30,
    backgroundColor: C.paper,
    borderRadius: 8,
  },
  ghostBack: { opacity: 0.2, transform: [{ rotate: '-2.2deg' }] },
  ghostFront: { opacity: 0.36, transform: [{ rotate: '1.5deg' }] },

  slip: {
    width: '100%',
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: 16,
    transform: [{ rotate: '-0.7deg' }],
    ...shadow,
  },
  slipPin: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.pin,
    borderTopWidth: 4,
    borderTopColor: C.pinLight,
    ...shadow,
  },
  slipTop: { flexDirection: 'row', gap: 13 },
  slipPhoto: { width: 74, height: 74, borderRadius: 5 },
  slipPhotoRadius: { borderRadius: 5 },
  slipCat: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.inkSoft,
  },
  slipTitle: { fontFamily: F.uiBlack, fontSize: 16, color: C.ink, lineHeight: 21, marginTop: 4 },
  slipPrice: { fontFamily: F.monoBold, fontSize: 15, color: C.pinDark, marginTop: 5 },
  slipDesc: {
    fontFamily: F.ui,
    fontSize: 12.5,
    lineHeight: 20,
    color: C.inkSoft,
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: C.lineInput,
    borderStyle: 'dashed',
  },
  slipMeta: { gap: 4, marginTop: 12 },
  slipMetaText: { fontFamily: F.mono, fontSize: 10.5, color: C.muted },
  slipMetaStrong: { fontFamily: F.monoBold, color: C.inkSoft },

  reasons: {
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },
  reasonsTitle: { fontFamily: F.uiBold, fontSize: 12.5, color: C.paper, marginBottom: 9 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  tagText: { fontFamily: F.uiSemi, fontSize: 11.5, color: C.deskTxtSoft },

  acts: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  secondary: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  secondaryText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.deskTxt },
  ghostBtn: { paddingHorizontal: 12, paddingVertical: 14 },
  ghostBtnText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.deskTxtSoft },

  deskEmpty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 20 },
  donePin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.pin,
    borderTopWidth: 6,
    borderTopColor: C.pinLight,
    marginBottom: 14,
    ...shadow,
  },
  doneTitle: { fontFamily: F.hand, fontSize: 21, color: C.paper, marginBottom: 6 },
  doneBody: {
    fontFamily: F.ui,
    fontSize: 12.5,
    lineHeight: 20,
    color: C.deskTxtSoft,
    textAlign: 'center',
    maxWidth: 280,
  },
});
