import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G } from '@/theme';

/**
 * Mặt kính đặt TRÊN nền màu — không phải blur.
 *
 * Repo không có `expo-blur`, và ở đây blur cũng không giúp gì: phía sau những mặt này là gradient
 * đặc (hero bảng tin, thẻ danh mục), mà làm mờ một màu đặc thì ra đúng màu đó. Cảm giác kính trên
 * nền đặc đến từ BA lớp xếp lên nhau — thiếu lớp nào cũng chỉ còn là "một mảng trắng mờ":
 *
 *   1. độ đục của tấm kính — `C.glassRaise`
 *   2. vệt sáng chéo — `G.sheen`, lớp làm mắt đọc ra bề mặt bóng
 *   3. cạnh vát — viền 1px `C.glassLine`, tách tấm kính khỏi nền
 *
 * Dùng thành CẶP: trộn `glassFace` vào style của khối, rồi đặt `<GlassSheen />` làm con ĐẦU TIÊN
 * của nó. Tách đôi thay vì gói thành một component bọc vì hai trong ba chỗ dùng là `Pressable`
 * (nút biểu tượng và viên chip nhóm trên hero) — một component bọc sẽ phải lồng thêm một lớp
 * View chỉ để giữ nền.
 *
 * Không nằm trong `ui.tsx` như luật barrel của folder.convention §3: file đó đã 388 dòng, vượt
 * trần 350 của component chia sẻ — thêm vào đó là đẩy nó xa trần hơn nữa.
 */
/**
 * Mặt kính SÁNG — cho khối mang chữ TỐI đặt trên nền màu.
 *
 * `glassFace` không dùng được ở đó: trắng 30% trên nền xanh vẫn còn rất xanh, mà chữ
 * `C.ink` trên nền xanh là hỏng tương phản. Bản này lấy `glassLift` (trắng 92%) làm tấm,
 * nên vẫn đọc được như giấy trắng nhưng để lọt một chút nền qua ở rìa.
 *
 * Cảm giác kính ở đây KHÔNG đến từ độ đục — 92% thì gần như đục hẳn — mà đến từ hai lớp
 * còn lại: cạnh vát `glassLine` và vệt sáng `GlassSheen`. Đó cũng là lý do phải dùng cả cặp.
 */
export const glassPane = {
  backgroundColor: C.glassLift,
  borderWidth: 1,
  borderColor: C.glassLine,
  overflow: 'hidden',
} as const;

export const glassFace = {
  backgroundColor: C.glassRaise,
  borderWidth: 1,
  borderColor: C.glassLine,
  // Để vệt sáng bị cắt theo đúng `borderRadius` của khối chứ không tràn ra góc vuông.
  overflow: 'hidden',
} as const;

/** Lớp 2 của `glassFace`. Phải là con đầu tiên, nếu không nó phủ lên nội dung. */
export function GlassSheen() {
  return (
    <LinearGradient
      colors={G.sheen}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
