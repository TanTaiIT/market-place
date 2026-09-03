import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
// `runOnJS` đã deprecated từ worklets 0.5 — cùng đường vào như `AdminReviewDesk`.
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassSheen, glassFace } from './GlassSurface';
import { Surface } from './Surface';
import { EmptyState, Loading, ScreenHeader } from './ui';
import type { Category } from '@/api/db';
import { C, F, R, type Grad } from '@/theme';

/** Danh mục tạo trước khi icon thành bắt buộc: ô vẫn phải có hình, không để trơ một chỗ trống. */
const NO_ICON = '▩';

/**
 * Màu thẻ, lấy theo THỨ TỰ danh mục.
 *
 * Không sinh màu từ tên hay từ `id`: hash một chuỗi ObjectId ra màu nghĩa là thêm một danh mục ở
 * giữa danh sách thì cả bảng đổi màu, mà người dùng nhớ danh mục theo màu trước khi đọc chữ. Theo
 * index thì màu chỉ dịch khi master đổi `order` — đúng lúc đáng đổi. Cùng luật với `TILTS`:
 * biến thể thị giác suy ra từ index qua mảng hằng, không random trong render.
 *
 * Dải chạy DỌC (chặng sáng ở trên, chặng tối ở dưới) và tên nằm ở đáy thẻ: chữ trắng đặt trên
 * chặng tối đạt ≥4.5:1 ở cả tám cặp, còn nếu để dải chạy chéo thì bốn cặp rơi xuống ~3:1.
 */
const CATEGORY_GRADS: readonly Grad[] = [
  ['#2FB56D', '#177F4C'],
  ['#4A7FE0', '#2A55B0'],
  ['#F2683C', '#C7461F'],
  ['#7C5CE0', '#5533B5'],
  ['#2BAFA8', '#127E79'],
  ['#E85D8A', '#B93463'],
  ['#B07A4B', '#85552C'],
  ['#5A6A80', '#374559'],
];

/** Nhịp bấm: đủ để thấy thẻ nảy lên rồi mới rời màn, chưa đủ để cảm thấy máy treo. */
const POP_MS = 130;

/** Nhịp so le giữa hai thẻ liền nhau khi lưới mở ra. */
const RISE_STEP_MS = 55;

/**
 * Màn chọn danh mục — bước ĐẦU TIÊN của luồng đăng tin, chiếm TRỌN màn hình.
 *
 * Không phải ngăn trượt: đây là một câu hỏi bắt buộc phải trả lời mới đi tiếp được, mà một ngăn
 * trượt luôn ngụ ý "đóng lại thì vẫn còn màn phía dưới" — phía dưới đây là một form rỗng, không
 * có gì để làm. Chiếm trọn màn thì không còn hứa hẹn gì sai.
 *
 * Dựng bằng `Modal` chứ không phải một route riêng: form đăng tin giữ state của nó (`categoryId`
 * quyết định template, tức là quyết định luôn bộ field) — tách màn chọn thành route là phải đẩy
 * lựa chọn qua param rồi dựng lại form từ đầu. Vỏ ngoài vẫn là `Surface` + `SafeAreaView` +
 * `ScreenHeader` giống mọi route khác nên người dùng không phân biệt được.
 *
 * `onSelect` KHÔNG kèm nghĩa đóng màn, và `onDismiss` là đường ra DUY NHẤT khi chưa chọn: người
 * gọi cần phân biệt hai ca đó (xem `CategoryField` — thoát mà chưa chọn thì rời luôn việc đăng).
 */
export function CategoryPicker({
  visible,
  categories,
  value,
  loading,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  categories: readonly Category[];
  value: string | null;
  loading: boolean;
  onSelect: (categoryId: string) => void;
  onDismiss: () => void;
}) {
  /*
   * Một lượt mở = một lượt chọn. Thiếu chốt này thì trong 130ms chờ animation, ngón thứ hai bấm
   * được thẻ khác: cả hai gọi `onSelect`, thẻ bấm sau ghi đè lựa chọn mà người dùng vừa thấy nảy
   * lên, rồi form mở ra với danh mục họ không chọn.
   */
  const picked = useRef(false);
  useEffect(() => {
    if (visible) picked.current = false;
  }, [visible]);

  const claim = () => {
    if (picked.current) return false;
    picked.current = true;
    return true;
  };

  /*
   * `statusBarTranslucent` như `PhotoViewer`: thiếu nó thì trên Android cửa sổ Modal không trùm
   * lên thanh trạng thái, mà `SafeAreaView` bên trong vẫn báo inset của CẢ màn — thành ra cộng
   * thêm một khoảng trống bằng thanh trạng thái ở đỉnh.
   */
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Surface>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <ScreenHeader title="Đăng tin gì?" onBack={onDismiss} />

          {loading ? (
            <Loading />
          ) : categories.length === 0 ? (
            <EmptyState icon={NO_ICON} text="Chưa có danh mục nào để đăng" />
          ) : (
            <>
              <Text style={styles.lead}>
                Chọn loại món đồ — mỗi loại hỏi những thông tin khác nhau ở bước sau.
              </Text>

              <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
                {categories.map((cat, i) => (
                  <CategoryTile
                    key={cat.id}
                    cat={cat}
                    index={i}
                    grad={CATEGORY_GRADS[i % CATEGORY_GRADS.length]}
                    selected={cat.id === value}
                    claim={claim}
                    onDone={onSelect}
                  />
                ))}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}

/**
 * Một thẻ danh mục. Tách ra vì mỗi thẻ cần shared value RIÊNG cho cú nảy lúc bấm — để chung ở
 * màn thì cả lưới nảy một lượt.
 */
function CategoryTile({
  cat,
  index,
  grad,
  selected,
  claim,
  onDone,
}: {
  cat: Category;
  index: number;
  grad: Grad;
  selected: boolean;
  claim: () => boolean;
  onDone: (categoryId: string) => void;
}) {
  const rise = useSharedValue(0);
  const pop = useSharedValue(0);

  /*
   * Hiệu ứng vào-màn chạy bằng shared value chứ KHÔNG bằng preset `entering` như
   * component.convention §4 mặc định — cố ý lệch, có lý do:
   *
   * Preset `entering` là layout animation, và cả repo chưa có chỗ nào chạy layout animation bên
   * TRONG `Modal` (`PhotoViewer` cũng ở trong Modal nhưng dùng shared value). Layout animation
   * không chạy thì im lặng, không báo lỗi — mà đây là hiệu ứng được đặt hàng, không phải trang
   * trí thừa. Shared value + `withDelay` thì chắc chắn chạy ở cùng chỗ đó.
   *
   * Đo trên máy thật thấy `entering` chạy tốt trong Modal thì đổi lại được, ngắn hơn 6 dòng.
   */
  useEffect(() => {
    // Trần `index` ở 5 như `FeedCard`: danh mục thứ 20 mà chờ hơn một giây mới hiện thì lưới
    // trông như đang tải chậm, không phải như đang mở ra.
    rise.value = withDelay(Math.min(index, 5) * RISE_STEP_MS, withTiming(1, { duration: 320 }));
  }, [index, rise]);

  const cellStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 14 }, { scale: 1 + pop.value * 0.06 }],
  }));

  const press = () => {
    if (!claim()) return;
    // Nảy xong mới rời màn: bấm rồi màn biến mất ngay thì không có gì xác nhận là máy đã nhận
    // đúng thẻ mình chỉ vào.
    const done = () => onDone(cat.id);
    pop.value = withTiming(1, { duration: POP_MS }, (finished) => {
      if (finished) scheduleOnRN(done);
    });
  };

  return (
    <Animated.View style={[styles.cell, cellStyle]}>
      <Pressable
        onPress={press}
        style={({ pressed }) => [styles.hit, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      >
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.tile}>
          {/* Quầng gương ở góc trên — cùng thủ pháp với hero bảng tin, để mặt thẻ không phẳng. */}
          <View pointerEvents="none" style={styles.gloss} />

          {/* Viền là lớp phủ tuyệt đối, không phải `borderWidth` trên chính thẻ: đặt border lên
              thẻ thì nó ăn vào hộp nội dung, icon và tên dịch 2px mỗi lần mở lại màn. */}
          {selected && <View pointerEvents="none" style={styles.ring} />}

          <View style={styles.disc}>
            <GlassSheen />
            <Text style={styles.glyph}>{cat.icon || NO_ICON}</Text>
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {cat.name}
          </Text>

          {selected && (
            <View style={styles.badge}>
              <Text style={styles.badgeGlyph}>✓</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  lead: {
    fontFamily: F.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: C.inkSoft,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
  },
  // 48% × 2 + một `gap` vừa đúng một hàng hai thẻ; để `flexGrow` thì hàng cuối lẻ ô sẽ phình
  // rộng gấp đôi và lưới mất trục dọc.
  cell: { width: '48%' },
  hit: { borderRadius: R.lg },
  // Không `...shadow`: thẻ gradient của app cố ý phẳng (xem `FeedStrips.promo`) — mặt thẻ là màu
  // đặc, tự tách khỏi nền giấy. Thêm bóng ở đây còn vướng `overflow: 'hidden'` cắt bóng trên iOS.
  tile: {
    height: 132,
    borderRadius: R.lg,
    padding: 13,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  // Viền trắng chứ không phải `C.brand`: mặt thẻ đã là màu, thêm một màu nữa để đánh dấu thì hai
  // màu tranh nhau. (`'#fff'` là ngoại lệ được tha trong style.convention §1.)
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: R.lg,
  },
  gloss: {
    position: 'absolute',
    top: -34,
    right: -26,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.glass,
  },
  disc: {
    width: 46,
    height: 46,
    borderRadius: 23,
    ...glassFace,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Emoji không ăn `fontFamily`, nên ô này cố ý chỉ đặt cỡ chữ.
  glyph: { fontSize: 23 },
  name: { fontFamily: F.uiBold, fontSize: 14, lineHeight: 18, color: '#fff' },
  badge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.glassLift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontFamily: F.uiBold, fontSize: 12, color: C.brandTx },
});
