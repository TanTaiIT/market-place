import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassSheen, glassFace } from './GlassSurface';
import type { Category } from '@/api/db';
import { C, CATEGORY_TINTS, R, shadow, type CategoryTint } from '@/theme';

/**
 * Logo của một danh mục — chỗ DUY NHẤT biết một danh mục trông như thế nào.
 *
 * Trước file này có tám chỗ tự vẽ, và ba trong số đó vẽ ra ba thứ khác hẳn nhau cho cùng một
 * danh mục: vòng tròn gradient 74px ở bảng tin, thẻ 132px có đĩa kính ở màn đăng tin, và emoji
 * nối thẳng vào chuỗi tên (`${icon} ${name}`) ở năm hàng chip. Chuỗi nối là thứ khoá chặt vấn
 * đề: emoji nằm trong `<Text>` thì không đặt được nền, không chỉnh được cỡ rời khỏi cỡ chữ, và
 * không có chỗ nào để treo màu nhận dạng.
 *
 * Fallback cũng gom về đây. Trước đó `CategoryPicker` rơi về `▩` còn `SearchCrumbBar` rơi về
 * `🏷️`, sáu chỗ còn lại bỏ hẳn icon đi — nên một danh mục thiếu icon trông khác nhau ở mọi màn.
 */

/** Danh mục chưa đặt icon. `🏷️` chứ không phải một ô trống: nó vẫn đọc ra "một loại hàng". */
export const CATEGORY_FALLBACK = '🏷️';

/**
 * `sm` viên chip · `md` thẻ chọn danh mục · `lg` vòng tròn bảng tin.
 *
 * Ba cỡ chứ không phải một prop `size: number`: ba nơi này là ba ngữ cảnh có sẵn trong app, và
 * để mỗi call-site tự chọn số là cách chắc chắn nhất để có 26, 28 và 27px cạnh nhau.
 */
type Size = 'sm' | 'md' | 'lg';

const BOX: Record<Size, { size: number; radius: number; glyph: number }> = {
  sm: { size: 26, radius: R.sm, glyph: 14 },
  md: { size: 46, radius: 23, glyph: 23 },
  lg: { size: 74, radius: 37, glyph: 32 },
};

/**
 * Sắc của một danh mục, tra bằng `slug`.
 *
 * `slug` chứ không phải `id`, và đó là toàn bộ điểm của hàm này: `id` là ObjectId sinh lúc seed
 * nên cùng một danh mục đổi màu giữa dev và prod (xem `CATEGORY_TINTS`). `slug` do người tạo
 * danh mục đặt và đi theo nó qua mọi môi trường.
 *
 * Băm nhân-cộng chứ không cộng mã ký tự như `gradOf`: tổng mã ký tự cho `sach-vo` và `vo-sach`
 * ra đúng một số, mà slug của cùng một hệ thống thì hay dùng chung một bộ chữ.
 */
export function categoryTint(slug: string): CategoryTint {
  let hash = 5381;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 33 + slug.charCodeAt(i)) % 1_000_003;
  return CATEGORY_TINTS[hash % CATEGORY_TINTS.length];
}

export function CategoryLogo({
  category,
  size = 'sm',
  tone = 'tint',
}: {
  /** `null` = "Tất cả danh mục" — vẫn vẽ một ô, để hàng chip không nhấp nhô. */
  category: Pick<Category, 'slug' | 'icon'> | null;
  size?: Size;
  /**
   * `glass` cho logo đặt TRÊN nền đã mang sắc của chính danh mục đó — mặt thẻ 132px ở màn chọn
   * danh mục là chỗ duy nhất. Ở đó nền `tint.bg` sẽ là sắc thứ hai của cùng một danh mục chồng
   * lên nhau, mà mắt đọc ra là hai thứ khác nhau; tấm kính trắng thì để nền dưới nói.
   */
  tone?: 'tint' | 'glass';
}) {
  const box = BOX[size];
  const tint = category ? categoryTint(category.slug) : null;
  const glyph = category ? category.icon || CATEGORY_FALLBACK : '🔖';

  const frame = {
    width: box.size,
    height: box.size,
    borderRadius: box.radius,
  };

  if (tone === 'glass') {
    return (
      <View style={[frame, styles.center, glassFace]}>
        {/* Lớp 2 của tấm kính — phải là con ĐẦU TIÊN, nếu không nó phủ lên emoji. */}
        <GlassSheen />
        <Text style={{ fontSize: box.glyph }}>{glyph}</Text>
      </View>
    );
  }

  // Vòng tròn lớn giữ gradient + bóng đổ: dải "Nhóm quanh bạn" nằm ngay dưới nó trên cùng một
  // màn cũng là vòng tròn gradient, và hai dải cạnh nhau phải nói cùng một thứ tiếng.
  if (size === 'lg') {
    return (
      <LinearGradient
        colors={tint ? [tint.bg, tint.deep] : [C.tintIdle, C.tintIdle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[frame, styles.center, shadow]}
      >
        <Text style={{ fontSize: box.glyph }}>{glyph}</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={[frame, styles.center, { backgroundColor: tint?.bg ?? C.tintIdle }]}>
      <Text style={{ fontSize: box.glyph }}>{glyph}</Text>
    </View>
  );
}

/**
 * Tên danh mục kèm icon, dạng CHUỖI.
 *
 * Chỉ cho hai chỗ mà logo không vào được: ô tóm tắt của `CategoryField` và danh sách lựa chọn
 * của `PickerSheet` — cả hai nhận `label: string`, và mở chúng ra cho `ReactNode` là kéo theo
 * hai component dùng chung chẳng liên quan gì tới danh mục.
 *
 * Vẫn đi qua đây chứ không nối tay tại chỗ, để fallback chỉ có một bản.
 */
export function categoryLabel(category: Pick<Category, 'name' | 'icon'>): string {
  return `${category.icon || CATEGORY_FALLBACK} ${category.name}`;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
