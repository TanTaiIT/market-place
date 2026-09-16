import { Pressable, StyleSheet, Text, View } from 'react-native';
import { adminFormStyles } from './AdminPicker';
import { C, R } from '@/theme';

/**
 * Bộ biểu tượng chuẩn của danh mục.
 *
 * Đây là chỗ DUY NHẤT giữ danh sách. BE cố tình không whitelist (xem `categoryIconSchema`) — nó
 * chỉ chốt "danh mục phải có icon", còn icon nào là chuẩn thì là chuyện của thiết kế, và khoá nó
 * vào schema nghĩa là thêm một emoji phải deploy BE.
 *
 * Danh sách CỐ TÌNH ngắn và không chia nhóm: 30 ô vừa đúng một lần nhìn trong panel quản trị,
 * còn hàng tab nhóm là thêm state cho một form mỗi tháng mở vài lần. Cần icon mới thì thêm vào
 * đây, giữ thứ tự theo cụm chủ đề để lưới không loạn.
 */
export const CATEGORY_ICONS = [
  // Học tập
  '📚',
  '📓',
  '✏️',
  '🎒',
  '📐',
  '🧮',
  // Điện tử
  '💻',
  '📱',
  '🎧',
  '⌨️',
  '📷',
  '🔌',
  // Xe cộ
  '🚲',
  '🛴',
  '🏍️',
  '🚗',
  // Thể thao · nhạc
  '⚽',
  '🏀',
  '🏸',
  '🎸',
  '🎹',
  // Quần áo
  '👕',
  '👟',
  '🧢',
  '🎽',
  // Nhà cửa · thú cưng
  '🪑',
  '🛏️',
  '🍳',
  '🧸',
  '🐶',
] as const;

/**
 * Lưới chọn biểu tượng cho panel thêm/sửa danh mục.
 *
 * Thay cho ô `TextInput` gõ emoji tay trước đây: bàn phím emoji mỗi máy một khác, và không có gì
 * chặn một danh mục ra đời với icon là chữ "x" hay trống hẳn — mà hàng chip bảng tin, sheet chọn
 * danh mục lúc đăng tin đều bày icon trước tên.
 *
 * Chỉ dựng cho nền tối của bàn quản trị (không có prop `onDark` như `Field`): đây là màn duy
 * nhất tạo danh mục, thêm nhánh sáng là code không ai chạy tới.
 */
export function CategoryIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  // Danh mục tạo trước tính năng này có thể đang giữ emoji ngoài bộ chuẩn. Nói ra thay vì để
  // người sửa nhìn một lưới không ô nào sáng rồi tưởng dữ liệu trống.
  const offList = !!value && !(CATEGORY_ICONS as readonly string[]).includes(value);

  return (
    <View style={styles.wrap}>
      <Text style={adminFormStyles.label}>BIỂU TƯỢNG · BẮT BUỘC</Text>

      <View style={adminFormStyles.chips}>
        {CATEGORY_ICONS.map((icon) => (
          <Pressable
            key={icon}
            onPress={() => onChange(icon)}
            style={({ pressed }) => [
              styles.cell,
              icon === value && styles.cellOn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.glyph}>{icon}</Text>
          </Pressable>
        ))}
      </View>

      {offList && (
        <Text style={adminFormStyles.hint}>
          Đang dùng {value} — ngoài bộ chuẩn. Bấm một ô để đổi, hoặc để nguyên.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  cell: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    backgroundColor: C.desk,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { backgroundColor: C.mossDeep, borderColor: C.brand, borderWidth: 2 },
  // Emoji không ăn `fontFamily`, nên ô này cố ý không đặt `F.*` — chỉ cỡ chữ.
  glyph: { fontSize: 21 },
});

