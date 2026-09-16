import { useState } from 'react';
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

/**
 * Thanh đầu nổi: phần trên cuộn đi như nội dung, phần dưới ở lại cố định.
 *
 * KHÔNG có cơ chế trốn/hiện theo hướng cuộn (bản trước có, đã bỏ): một thanh tự ẩn rồi tự hiện
 * làm hàng công cụ nhấp nháy giữa lúc đang cuộn, và người dùng phải cuộn ngược lên mới lấy lại
 * được ô tìm kiếm. Hàng công cụ nay ở lại vĩnh viễn — muốn dùng là có, không phải đi tìm.
 *
 * Chuyển động duy nhất còn lại bám ĐÚNG vị trí cuộn, nên nó không có hướng và không có ngưỡng:
 * khối trên đi lên đúng bằng số pixel nội dung đã đi, hết khối thì dừng. Không cần lọc rung tay
 * vì không có quyết định nào để rung.
 *
 * Giá trị sống trên UI THREAD (`useSharedValue`), không phải state của React: handler cuộn chạy
 * mỗi khung hình, mà mỗi `setState` là một vòng render — thanh sẽ giật và trễ sau ngón tay. Đó
 * là lý do dùng `useAnimatedScrollHandler` chứ không phải `onScroll` thường.
 */
export function useCollapsingHeader() {
  /**
   * Chiều cao phần CUỘN ĐI của thanh, và phần của nó đã bị cuộn qua.
   *
   * Phần đó là nội dung, nó cuộn đi một lần rồi thôi. Những hàng công cụ còn lại thì ở lại.
   */
  const titleH = useSharedValue(0);
  const collapse = useSharedValue(0);
  /** Bản dành cho React: `paddingTop` của danh sách là style thường, không đọc được shared value. */
  const [height, setHeight] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      // Bám ĐÚNG vị trí cuộn (không phải delta): mép dưới thanh luôn khớp mép trên nội dung cho
      // tới khi khối trên khuất hẳn. `clamp` hai đầu để cú kéo quá đà (bounce) ở iOS không đẩy
      // thanh ra ngoài khoảng của nó.
      collapse.value = Math.min(Math.max(e.contentOffset.y, 0), titleH.value);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -collapse.value }],
  }));

  return {
    onScroll,
    style,
    /** Chiều cao thanh, để danh sách chừa chỗ (`paddingTop`) và kéo-để-tải lùi xuống đúng chỗ. */
    height,
    /** Đo thay vì đóng cứng: chiều cao đổi theo cỡ chữ hệ thống và theo việc có hàng chip hay không. */
    measure: (h: number) => {
      if (h === height) return;
      setHeight(h);
    },
    /** Chiều cao phần cuộn-đi, do chính khối đó báo lên. */
    onTitleLayout: (h: number) => {
      titleH.value = h;
    },
  };
}
