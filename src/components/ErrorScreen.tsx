import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinButton } from './ui';
import { C, F } from '@/theme';

/**
 * Màn thay thế khi một nhánh cây component vỡ lúc render.
 *
 * Chỉ cứu lỗi **render/lifecycle** — đúng phạm vi của React Error Boundary. Lỗi API không đi
 * qua đây: TanStack đưa chúng vào `error` state và từng màn đã tự hiện `EmptyState` (HARD#6).
 * Đây là lưới cho lỗi lập trình: đọc field BE vừa bỏ, `.map` trên `undefined`.
 *
 * Vì sao cần: ở dev một lỗi như vậy chỉ hiện red box, nhưng **release build thì đóng app về
 * màn hình chính** — người dùng chỉ thấy "app tự tắt", không có đường quay lại. Đã có ca thật:
 * `profile.role.trim()` nổ khi BE bỏ cột `role` mà OpenAPI vẫn khai `role: string`.
 *
 * Hiện CẢ thông điệp kỹ thuật, không giấu: nó không phải dữ liệu riêng tư, và là thứ duy nhất
 * người dùng chụp lại gửi được để mình lần ra chỗ hỏng. Đặt ở cỡ chữ phụ để nó không tranh
 * chỗ với câu giải thích.
 */
export function ErrorScreen({
  error,
  onRetry,
  onDark,
}: {
  error: Error;
  onRetry: () => void;
  /** Bàn quản trị dùng nền tối — cùng quy ước `onDark` của `EmptyState`/`Loading`. */
  onDark?: boolean;
}) {
  const fg = onDark ? C.paper : C.ink;
  const dim = onDark ? C.deskTxtDim : C.inkSoft;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: onDark ? C.desk : C.paper }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.icon}>📌</Text>
        <Text style={[styles.title, { color: fg }]}>Màn này vừa gặp sự cố</Text>
        <Text style={[styles.lead, { color: dim }]}>
          Lỗi nằm ở phía ứng dụng, không phải do bạn làm sai. Thử lại thường là xong; nếu vẫn
          vậy, chụp lại dòng dưới đây giúp mình.
        </Text>

        <View style={[styles.detail, { borderColor: onDark ? C.deskLineStrong : C.line }]}>
          <Text style={[styles.detailText, { color: dim }]}>{error.message || String(error)}</Text>
        </View>

        <PinButton label="Thử lại" onPress={onRetry} style={styles.action} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  icon: { fontSize: 34, marginBottom: 14 },
  title: { fontFamily: F.uiBlack, fontSize: 19, lineHeight: 26, marginBottom: 10 },
  lead: { fontFamily: F.ui, fontSize: 13.5, lineHeight: 21, marginBottom: 20 },
  detail: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 24 },
  detailText: { fontFamily: F.mono, fontSize: 11.5, lineHeight: 18 },
  action: { alignSelf: 'flex-start' },
});
