import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { shortDong } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Kéo chọn khoảng giá, hai đầu.
 *
 * **Thang bậc, không tuyến tính.** Giá trên chợ trải từ 0 tới hàng tỷ; chia đều 0→5 tỷ trên một
 * thanh rộng 300px thì mỗi pixel là ~17 triệu — không ai chọn nổi mức 2 triệu. Thanh này chạy
 * trên CHỈ SỐ của `STOPS`, nên các mốc cách đều trên màn hình nhưng dày ở khoảng giá thật sự
 * có nhiều tin. Đây cũng là cách các trang bất động sản làm.
 *
 * Hai đầu mút mang nghĩa "không giới hạn": chỉ số 0 → `minPrice: null`, chỉ số cuối →
 * `maxPrice: null`. Nhờ vậy kéo hết sang hai bên là bỏ lọc giá, không phải một khoảng khổng lồ.
 *
 * `Gesture.Pan().runOnJS(true)` chứ không chạy trên UI thread như `PhotoViewer`: ở đây mỗi lần
 * kéo là một lần đổi state React (nhãn + nhả ra bộ lọc), mà thanh trượt không cần 60fps mượt
 * như pinch-zoom ảnh. Chạy JS đổi lấy việc bỏ được cả `useSharedValue` + `runOnJS` thủ công.
 */

/** Mốc giá, đơn vị đồng. Phần tử cuối là "trở lên" — không phải một con số thật. */
const STOPS = [
  0, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000,
  20_000_000, 50_000_000, 100_000_000, 200_000_000, 500_000_000, 1_000_000_000, 2_000_000_000,
  5_000_000_000,
];
const LAST = STOPS.length - 1;
const THUMB = 26;

/** Mốc gần nhất với một giá trị — dùng khi nạp lại bộ lọc đã lưu. */
function indexOf(value: number | null, fallback: number): number {
  if (value === null) return fallback;
  let best = 0;
  for (let i = 1; i < STOPS.length; i += 1) {
    if (Math.abs(STOPS[i] - value) < Math.abs(STOPS[best] - value)) best = i;
  }
  return best;
}

export function PriceRange({
  min,
  max,
  onChange,
  onDragChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  /**
   * Đang kéo hay không. Màn chứa dùng nó để TẠM KHOÁ cuộn dọc: khai `activeOffsetX` mới chỉ giúp
   * thanh trượt giành được cú kéo ngang, còn cú kéo chéo vẫn có thể tuột về cho danh sách cha.
   */
  onDragChange?: (dragging: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState(() => ({ lo: indexOf(min, 0), hi: indexOf(max, LAST) }));

  // "Xoá lọc" ở màn tìm kiếm đặt cả hai prop về null, nhưng thanh giữ state riêng nên thumb
  // đứng nguyên chỗ cũ — bộ lọc giá đã tắt mà người dùng vẫn đọc "500k — 2tr". Chỉnh ngay
  // trong lúc render (React dựng lại luôn, không nháy một nhịp như `useEffect`), và CHỈ khi
  // cả hai về null: mọi giá trị khác đều do chính thanh này vừa nhả ra.
  if (min === null && max === null && (range.lo !== 0 || range.hi !== LAST)) {
    setRange({ lo: 0, hi: LAST });
  }

  const { lo, hi } = range;

  /**
   * Bản ref của `range` + chỉ số lúc BẮT ĐẦU kéo.
   *
   * Đây là chỗ bản trước sai: `translationX` của gesture-handler là độ dịch **tích luỹ từ lúc
   * đặt ngón tay**, nhưng `onUpdate` lại lấy mốc là `lo` HIỆN TẠI — vốn vừa bị chính frame
   * trước cập nhật. Mỗi frame cộng lại toàn bộ độ dịch lên một mốc đã dời, nên thumb tăng tốc
   * vọt đi. Mốc phải là vị trí lúc bắt đầu, và nó chỉ đọc được từ ref.
   */
  const live = useRef(range);
  live.current = range;
  const startIdx = useRef(0);

  /**
   * Bản ref của `onChange`.
   *
   * Gesture nằm trong `useMemo([usable])`, nên nó đóng băng luôn `onChange` của lần render dựng
   * gesture — và `onChange` đó mang theo snapshot của cả `SearchFilter` tại thời điểm ấy. Gọi
   * trực tiếp thì lúc thả tay sẽ ghi đè danh mục / tỉnh / từ khoá người dùng chọn SAU đó về giá
   * trị cũ (đúng triệu chứng "đổi khoảng giá thì danh mục nhảy về Tất cả"). Đọc qua ref để
   * gesture vẫn ổn định mà callback luôn là bản mới nhất.
   */
  const emit = useRef(onChange);
  emit.current = onChange;

  /** Cùng lý do với `emit`: gesture bị `useMemo` đóng băng, đọc qua ref mới luôn là bản mới nhất. */
  const drag = useRef(onDragChange);
  drag.current = onDragChange;
  const usable = Math.max(width - THUMB, 1);
  const xOf = (i: number) => (i / LAST) * usable;
  const idxAt = (x: number) => Math.round((Math.max(0, Math.min(usable, x)) / usable) * LAST);

  /**
   * Một thumb không được vượt thumb kia. Chặn bằng `Math.min/max` thay vì cho phép đổi vai:
   * đổi vai giữa lúc ngón tay còn trên màn hình làm thanh nhảy, và người dùng mất dấu mình
   * đang kéo đầu nào.
   *
   * `useMemo` chứ không dựng lại mỗi lần render: kéo là đổi state liên tục, mà thay đối tượng
   * gesture giữa lúc ngón tay còn trên màn hình là đường dẫn tới đúng loại lỗi vừa sửa ở trên.
   * Nhờ đọc mọi thứ qua ref, gesture không còn phụ thuộc state nào.
   */
  const drags = useMemo(
    () =>
      (['lo', 'hi'] as const).map((side) =>
        Gesture.Pan()
          .runOnJS(true)
          // 6px ngang là đủ để tách khỏi ý định cuộn dọc của màn: dưới ngưỡng này cú chạm còn
          // thuộc về danh sách cha, quá ngưỡng thì thanh trượt giành và cha nhả ra.
          .activeOffsetX([-6, 6])
          .onBegin(() => {
            drag.current?.(true);
            startIdx.current = side === 'lo' ? live.current.lo : live.current.hi;
          })
          .onUpdate((e) => {
            const next = idxAt(xOf(startIdx.current) + e.translationX);
            setRange((r) =>
              side === 'lo'
                ? { ...r, lo: Math.min(next, r.hi) }
                : { ...r, hi: Math.max(next, r.lo) },
            );
          })
          // `onFinalize` chứ không `onEnd`: cú kéo bị huỷ (nhấc tay ngoài vùng, gesture khác
          // giành) cũng phải trả quyền cuộn lại cho màn, nếu không màn đứng cứng.
          .onFinalize(() => {
            drag.current?.(false);
          })
          // Nhả bộ lọc ra ngoài KHI THẢ TAY, không phải mỗi frame: mỗi lần nhả là một lần đổi
          // query key và một lượt gọi mạng. Hai đầu mút thành `null` để "kéo hết biên" = bỏ lọc giá.
          .onEnd(() => {
            const { lo: l, hi: h } = live.current;
            emit.current({ min: l === 0 ? null : STOPS[l], max: h === LAST ? null : STOPS[h] });
          }),
      ),
    // `usable` là thứ duy nhất gesture cần biết từ ngoài — nó đổi đúng một lần lúc đo layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usable],
  );

  return (
    <View>
      <Text style={styles.readout}>
        {lo === 0 && hi === LAST
          ? 'Mọi mức giá'
          : `${lo === 0 ? '0' : shortDong(STOPS[lo])} — ${
              hi === LAST ? `${shortDong(STOPS[LAST])} trở lên` : shortDong(STOPS[hi])
            }`}
      </Text>

      <View
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { left: xOf(lo) + THUMB / 2, width: xOf(hi) - xOf(lo) }]} />

        {(['lo', 'hi'] as const).map((side, i) => (
          <GestureDetector key={side} gesture={drags[i]}>
            <View
              // `hitSlop` dọc rộng cho dễ chạm, NGANG hẹp: hai thumb sát nhau lúc khoảng giá hẹp,
              // nới ngang là vùng chạm chồng lên và bắt nhầm đầu.
              hitSlop={{ top: 16, bottom: 16, left: 4, right: 4 }}
              style={[styles.thumb, { left: xOf(side === 'lo' ? lo : hi) }]}
            />
          </GestureDetector>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink, marginBottom: 12 },
  track: { height: THUMB, justifyContent: 'center' },
  rail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.lineInput,
    marginHorizontal: THUMB / 2,
  },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: C.moss },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: C.paperWarm,
    borderWidth: 2.5,
    borderColor: C.moss,
  },
});
