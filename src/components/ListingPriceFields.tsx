import { StyleSheet, Text } from 'react-native';
import { BoxField, BoxSwitch } from './FormSection';
import { C, F, S } from '@/theme';

/**
 * Giá tiền và cách giao — hai câu hỏi về GIAO DỊCH, tách khỏi phần mô tả món hàng.
 *
 * Đứng riêng khỏi `ListingForm` vì file đó đã quá trần LOC và không được phình thêm; nhưng
 * ranh giới này không phải cắt bừa cho vừa số dòng: ba ô ở đây cùng trả lời "mua bán thế nào",
 * còn tiêu đề/mô tả/thuộc tính trả lời "món này là gì".
 */
export function ListingPriceFields({
  price,
  onPrice,
  canDeliver,
  onCanDeliver,
}: {
  price: string;
  onPrice: (next: string) => void;
  canDeliver: boolean;
  onCanDeliver: (next: boolean) => void;
}) {
  // Đọc cùng cách `toEditableBody` đọc — bỏ mọi ký tự không phải số, vì người ta gõ cả dấu chấm.
  const isFree = Number(price.replace(/\D/g, '') || 0) === 0;

  return (
    <>
      <BoxField
        label="Mức giá"
        value={price}
        onChangeText={onPrice}
        placeholder="0"
        keyboardType="number-pad"
        suffix="đ"
      />

      {/*
        Gợi ý CHO TẶNG chỉ hiện khi ô giá còn trống hoặc đang là 0 — đúng lúc duy nhất nó có
        ích. Hiện thường trực là một dòng chữ người ta học cách không đọc.
      */}
      {isFree && (
        <Text style={styles.hint}>
          Để trống hoặc ghi 0 nếu bạn CHO TẶNG — tin sẽ mang nhãn “Miễn phí”.
        </Text>
      )}

      {/*
        Giao tận nơi là LỜI HỨA CỦA NGƯỜI BÁN, không phải dịch vụ của sàn — nên nó là một ô họ
        tự bật. Bản trước viên "🚚 Giao tận nơi" trên thẻ tin được suy từ HASH CỦA ID
        (`placeholders.listingShips`), tức là nói dối người mua về mọi tin.
      */}
      <BoxSwitch label="Tôi nhận giao tận nơi" value={canDeliver} onChange={onCanDeliver} />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.inkSoft, marginTop: S.xs },
});
