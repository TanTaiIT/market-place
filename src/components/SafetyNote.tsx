import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/theme';

/**
 * Nhắc giao dịch an toàn ở chân trang chi tiết.
 *
 * Chữ TĨNH, không gọi gì — và đó là lý do nó đáng có: lừa đặt cọc là kiểu lừa phổ biến nhất
 * trên chợ đăng tin, mà nó không để lại dấu vết nào cho hệ thống bắt được. Thứ duy nhất can
 * thiệp được là nói đúng câu đó, đúng lúc người ta sắp nhắn cho người lạ.
 *
 * Đặt SAU mô tả và TRƯỚC nút liên hệ: đọc xong mới tới lúc quyết định, và đó cũng là chỗ mắt
 * dừng lại trước khi ngón tay chạm thanh hành động.
 *
 * Giọng NHẮC chứ không CẢNH BÁO: nền cát nhạt, không phải nền đỏ. Mỗi tin đều hiện, nên tô đỏ
 * là dạy người dùng bỏ qua nó — và rồi nó cũng vô hình ở đúng những tin thật sự đáng ngờ.
 */
export function SafetyNote() {
  return (
    <View style={styles.box}>
      <Text style={styles.head}>🛡 Giao dịch an toàn</Text>
      <Text style={styles.line}>• Xem hàng tận nơi, kiểm tra kỹ trước khi trả tiền.</Text>
      <Text style={styles.line}>• Không chuyển khoản đặt cọc cho người bạn chưa gặp mặt.</Text>
      <Text style={styles.line}>• Hẹn ở nơi đông người — căng tin, thư viện, sảnh ký túc xá.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * KHÔNG có nền riêng: trang chi tiết đã chia thành các khối rời trên nền xám, nên chính khối
   * là tấm thẻ — thêm một hộp màu cát ở đây là hộp lồng trong thẻ.
   */
  box: { gap: 5 },
  head: { fontFamily: F.uiBold, fontSize: 12.5, color: C.ink, marginBottom: 2 },
  line: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, lineHeight: 17 },
});
