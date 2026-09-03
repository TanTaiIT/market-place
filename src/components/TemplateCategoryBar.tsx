import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AdminCategory } from '@/api/admin-content';
import type { TemplateTarget } from '@/api/templates';
import { C, F, R } from '@/theme';

/**
 * Hàng chip chọn thứ đang soạn: MẪU MẶC ĐỊNH, hoặc một danh mục.
 *
 * Nhãn là "ĐANG SOẠN CHO", không phải "áp dụng cho": một template thuộc về ĐÚNG một danh mục
 * (`CategoryTemplate.categoryId`, unique cùng `version`). Chip là radio — gọi nó là "áp dụng"
 * sẽ hứa một thứ model không làm được, và người soạn sẽ tưởng đã phủ cả bốn danh mục.
 *
 * Chip mẫu mặc định đứng ĐẦU và tách khỏi phần còn lại bằng một vạch: nó không phải một danh
 * mục, và sửa nó ăn sang mọi danh mục chưa có template riêng — đứng lẫn trong hàng thì nó trông
 * như một danh mục tên "Mẫu mặc định".
 *
 * Thay cho `AdminPickerField` (popup): chọn mục tiêu là việc làm liên tục khi soạn nhiều danh
 * mục một lượt, mà mỗi lần lại mở/đóng một ngăn trượt thì đắt hơn hẳn một cú chạm.
 */
export function TemplateCategoryBar({
  categories,
  value,
  status,
  onChange,
}: {
  categories: readonly AdminCategory[];
  value: TemplateTarget | null;
  /** Một dòng nói bản đang chạy / đang nháp / đang dùng mẫu mặc định. */
  status?: string;
  onChange: (target: TemplateTarget) => void;
}) {
  const onDefault = value?.kind === 'default';

  return (
    <View>
      <Text style={styles.label}>ĐANG SOẠN CHO</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pressable
          onPress={() => onChange({ kind: 'default' })}
          style={({ pressed }) => [
            styles.chip,
            onDefault && styles.chipOn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.chipText, onDefault && styles.chipTextOn]}>⭐ Mẫu mặc định</Text>
        </Pressable>

        <View style={styles.divider} />

        {categories.map((cat) => {
          const on = value?.kind === 'category' && value.categoryId === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onChange({ kind: 'category', categoryId: cat.id })}
              style={({ pressed }) => [
                styles.chip,
                on && styles.chipOn,
                // Danh mục đã tắt vẫn soạn được template (tin cũ vẫn trỏ vào nó), nhưng phải
                // thấy được là nó đang tắt — không thì soạn xong mới hiểu vì sao chẳng ai gặp.
                !cat.isActive && !on && { opacity: 0.45 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!!status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: C.inkSoft,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingRight: 22,
  },
  divider: { width: 1, alignSelf: 'stretch', marginHorizontal: 2, backgroundColor: C.line },
  chip: {
    borderRadius: R.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.pin, borderColor: C.pin },
  chipText: { fontFamily: F.uiSemi, fontSize: 13, color: C.ink },
  chipTextOn: { fontFamily: F.uiBold, color: C.paperWarm },
  status: {
    fontFamily: F.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.inkSoft,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
});
