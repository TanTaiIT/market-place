import { useState } from 'react';
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Phải cuộn liên tục chừng này pixel theo một hướng thì thanh mới đổi trạng thái. */
const SCROLL_SLOP = 12;
/** Thời gian thanh trốn đi hoặc quay lại. Đủ ngắn để không cảm thấy chờ, đủ dài để thấy nó trôi. */
const HIDE_MS = 220;

/**
 * Thanh đầu nổi: phần trên cuộn đi như nội dung, phần dưới trốn khi cuộn xuống và hiện lại khi
 * cuộn lên.
 *
 * Mọi giá trị ở đây sống trên UI THREAD (`useSharedValue`), không phải state của React: handler
 * cuộn chạy mỗi khung hình, mà mỗi `setState` là một vòng render — thanh sẽ giật và trễ sau ngón
 * tay. Đó là lý do dùng `useAnimatedScrollHandler` chứ không phải `onScroll` thường.
 *
 * Tách khỏi màn hình vì `feed.tsx` đã vượt trần 250 dòng (HARD#11), và vì logic này không biết gì
 * về bảng tin: màn nào có thanh đầu nổi cũng dùng được.
 */
export function useHideOnScroll() {
  /** Vị trí cuộn của khung hình TRƯỚC — chỉ để tính được đi lên hay đi xuống bao nhiêu. */
  const lastY = useSharedValue(0);
  /**
   * Chiều cao phần CUỘN ĐI của thanh, và phần của nó đã bị cuộn qua.
   *
   * Đây là chuyển động THỨ HAI, độc lập với việc trốn/hiện: phần đó là nội dung, nó cuộn đi một
   * lần rồi thôi. Những hàng công cụ còn lại thì ở lại.
   */
  const titleH = useSharedValue(0);
  const collapse = useSharedValue(0);
  /** Thanh đang bị đẩy lên bao nhiêu pixel: `0` = hiện hẳn, `barH` = trốn hẳn. */
  const shift = useSharedValue(0);
  /**
   * Đã cuộn liên tục bao nhiêu pixel theo MỘT hướng. Đổi hướng là đếm lại từ 0.
   *
   * Đây là thứ lọc rung tay: cuộn chậm thì ngón tay không đi một chiều, nó đi `+2 −1 +3 −1`.
   * Bản trước bám delta 1:1 nên nó phản chiếu y nguyên cái rung đó — trông đúng như giật.
   */
  const run = useSharedValue(0);
  /** Thanh đang ở trạng thái trốn hay không — để không bắn lại animation mỗi khung hình. */
  const hidden = useSharedValue(false);
  /** Chiều cao thật của thanh, đo bằng `onLayout` — xem `measure`. */
  const barH = useSharedValue(0);
  /** Bản dành cho React: `paddingTop` của danh sách là style thường, không đọc được shared value. */
  const [height, setHeight] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;

      // Bám ĐÚNG vị trí cuộn (không phải delta): phần trên đi lên đúng bằng số pixel nội dung đã
      // đi, nên mép dưới thanh luôn khớp mép trên nội dung cho tới khi nó khuất hẳn.
      collapse.value = Math.min(Math.max(y, 0), titleH.value);

      // Sát đỉnh thì LUÔN mở. Không có nhánh này, cú kéo quá đà (bounce) ở iOS cho `dy` âm liên
      // tục và thanh sẽ nhảy ra giữa lúc người dùng còn đang thả tay.
      if (y <= 0) {
        run.value = 0;
        if (hidden.value) {
          hidden.value = false;
          shift.value = withTiming(0, { duration: HIDE_MS });
        }
        return;
      }
      if (dy === 0) return;

      // Đổi hướng thì đếm lại: rung tay không bao giờ tích đủ `SCROLL_SLOP` để nhả.
      if (dy > 0 !== run.value > 0) run.value = 0;
      run.value += dy;
      if (Math.abs(run.value) < SCROLL_SLOP) return;

      /*
       * Chạy MỘT animation trọn vẹn tới đầu hoặc cuối, không bám delta nữa.
       *
       * Bám 1:1 chỉ mượt bằng đúng dòng sự kiện cuộn, mà ở tốc độ thấp dòng đó không đều —
       * Android bắn thưa hơn 60Hz, nên thanh đứng vài khung rồi nhảy 3px. Giao cho `withTiming`
       * thì đường đi do reanimated nội suy mỗi khung hình, độc lập hoàn toàn với việc sự kiện
       * cuộn tới lúc nào.
       */
      const wantHidden = run.value > 0;
      run.value = 0;
      if (wantHidden === hidden.value) return;
      hidden.value = wantHidden;
      shift.value = withTiming(wantHidden ? barH.value : 0, { duration: HIDE_MS });
    },
  });

  /*
   * `max` chứ không phải cộng dồn: hai chuyển động cùng đẩy thanh lên, lấy cái xa hơn.
   *
   * Cộng lại thì lúc trốn hẳn thanh bị đẩy quá đà thêm một đoạn bằng phần cuộn đi — vô hình lúc
   * đó, nhưng khi cuộn lên nó phải bò ngược qua đoạn thừa đó trước khi ló ra.
   */
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(collapse.value, shift.value) }],
  }));

  return {
    onScroll,
    style,
    /** Chiều cao thanh, để danh sách chừa chỗ (`paddingTop`) và kéo-để-tải lùi xuống đúng chỗ. */
    height,
    /** Đo thay vì đóng cứng: chiều cao đổi theo cỡ chữ hệ thống và theo việc có hàng chip hay không. */
    measure: (h: number) => {
      if (h === height) return;
      barH.value = h;
      setHeight(h);
    },
    /** Chiều cao phần cuộn-đi, do chính khối đó báo lên. */
    onTitleLayout: (h: number) => {
      titleH.value = h;
    },
  };
}
