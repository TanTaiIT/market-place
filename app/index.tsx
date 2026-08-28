import { Redirect } from 'expo-router';

/**
 * Ai vào app cũng rơi vào bảng tin — kể cả khách chưa đăng nhập.
 *
 * Trước đây khách bị đẩy thẳng sang `/login`: đăng nhập là BỨC TƯỜNG trước khi thấy được bất cứ
 * thứ gì. Giờ nó là một lựa chọn, và chỉ hiện ra đúng lúc người ta chạm vào việc cần tài khoản —
 * lưu tin, nhắn người bán, đăng tin (xem `GuestGate` và `useRequireAuth`).
 *
 * Không cần đọc trạng thái đăng nhập ở đây nữa: người đã đăng nhập cũng vào đúng bảng tin này.
 */
export default function Index() {
  return <Redirect href="/(tabs)/feed" />;
}
