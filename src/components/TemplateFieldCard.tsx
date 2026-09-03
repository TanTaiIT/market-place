import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';
import { formatOptions, parseOptions } from '@/api/templates';
import type { DraftField, FieldType } from '@/api/templates';
import { C, F, R, shadow } from '@/theme';

/** Bảy kiểu của BE, nhãn tiếng Việt. Xếp theo mức hay dùng, không theo thứ tự enum. */
const TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Văn bản' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'number', label: 'Số' },
  { value: 'year', label: 'Năm' },
  { value: 'select', label: 'Chọn 1' },
  { value: 'multiselect', label: 'Chọn nhiều' },
  { value: 'boolean', label: 'Bật/tắt' },
];

const WITH_OPTIONS = new Set<FieldType>(['select', 'multiselect']);

/**
 * Một thuộc tính trong template — thẻ giấy sửa được tại chỗ.
 *
 * Kéo để đổi thứ tự, và CHỈ từ tay kéo bên trái: thẻ này chứa ba ô nhập, bắt cả thẻ nhận cử chỉ
 * kéo là mỗi lần đặt con trỏ vào ô tên lại có nguy cơ nhấc cả thẻ lên.
 *
 * `useReorderableDrag` phải gọi trong cây của `renderItem` — component này chỉ dựng được bên
 * trong `ReorderableList` của `TemplateFieldList`, không đứng một mình được.
 */
export function TemplateFieldCard({
  field,
  onPatch,
  onRemove,
}: {
  field: DraftField;
  onPatch: (next: Partial<DraftField>) => void;
  onRemove: () => void;
}) {
  const drag = useReorderableDrag();

  // Khoá đã nằm trong từ điển dùng chung → kiểu của nó là kiểu của MỌI danh mục đang dùng khoá
  // đó. BE từ chối "một khoá không được mang hai kiểu"; khoá chip ở đây để người soạn biết
  // trước, thay vì nhận 400 sau khi đã soạn xong cả template.
  const locked = !field.isNew;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        {/* `delayLongPress` ngắn hơn mặc định (500ms): tay kéo không làm gì khác ngoài kéo, nên
            không có thao tác nào để phân biệt — chờ nửa giây chỉ khiến nó tưởng như bị kẹt. */}
        <Pressable onLongPress={drag} delayLongPress={140} hitSlop={8} style={styles.grip}>
          <Text style={styles.gripGlyph}>⣿</Text>
        </Pressable>

        <TextInput
          value={field.label}
          onChangeText={(label) => onPatch({ label })}
          placeholder="Tên thuộc tính"
          placeholderTextColor={C.muted}
          style={styles.name}
        />

        <Pressable
          onPress={onRemove}
          hitSlop={6}
          style={({ pressed }) => [styles.trash, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.trashGlyph}>🗑</Text>
        </Pressable>
      </View>

      {/* Khoá gửi lên BE, hiện ra chứ KHÔNG sinh âm thầm: tin đăng lưu thuộc tính theo key, nên
          một khoá đã ra đời là nằm lại trong DB vĩnh viễn. */}
      <Text style={styles.key}>
        {field.key || '—'}
        {locked ? ' · dùng lại từ từ điển' : ''}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {TYPES.map((t) => (
          <Pressable
            key={t.value}
            disabled={locked}
            onPress={() => onPatch({ type: t.value })}
            style={({ pressed }) => [
              styles.chip,
              field.type === t.value && styles.chipOn,
              locked && field.type !== t.value && styles.chipOff,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.chipText, field.type === t.value && styles.chipTextOn]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {locked && (
        <Text style={styles.note}>
          Kiểu không đổi được — khoá này đang dùng chung với danh mục khác.
        </Text>
      )}

      {WITH_OPTIONS.has(field.type) && (
        <TextInput
          value={formatOptions(field.options)}
          // `parseOptions` giữ `value` cũ của nhãn đã có: `value` là thứ tin đăng lưu, sinh lại
          // nó khi sửa chính tả một nhãn là làm mọi tin cũ hoá không hợp lệ.
          onChangeText={(text) => onPatch({ options: parseOptions(text, field.options) })}
          placeholder="4GB, 6GB, 8GB, 12GB"
          placeholderTextColor={C.muted}
          style={styles.options}
        />
      )}

      <Toggle
        label="Bắt buộc nhập"
        value={field.required}
        onChange={() => onPatch({ required: !field.required })}
      />
      <Toggle
        label="Cho lọc"
        value={field.filterable}
        onChange={() => onPatch({ filterable: !field.filterable })}
      />

      {!!field.showIf && (
        <Text style={styles.note}>
          Chỉ hiện khi `{field.showIf.key}` có giá trị — điều kiện giữ nguyên, màn này không sửa.
        </Text>
      )}
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <Pressable style={styles.toggle} onPress={onChange}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {/* `Switch` gốc nhuộm theo token, cùng cách `AdminSwitch` làm — nhưng không dùng lại nó:
          nó nhuộm cho nền `desk` tối, còn thẻ này là giấy sáng. */}
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.lineInput, true: C.brand }}
        thumbColor={value ? C.paperWarm : C.sand}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: R.lg,
    padding: 14,
    marginBottom: 12,
    ...shadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grip: { paddingVertical: 6, paddingRight: 2 },
  gripGlyph: { fontSize: 15, color: C.muted },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: F.uiBold,
    fontSize: 15,
    color: C.ink,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.lineInput,
  },
  trash: {
    width: 30,
    height: 30,
    borderRadius: R.sm,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashGlyph: { fontSize: 13 },
  key: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6, color: C.muted, marginTop: 7 },
  chips: { flexDirection: 'row', gap: 7, paddingTop: 11, paddingRight: 4 },
  chip: {
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.chipIdle,
  },
  chipOn: { backgroundColor: C.moss },
  /** Kiểu không chọn được: nhạt đi thay vì biến mất — người soạn vẫn cần thấy có những kiểu nào. */
  chipOff: { opacity: 0.4 },
  chipText: { fontFamily: F.uiSemi, fontSize: 12, color: C.inkSoft },
  chipTextOn: { fontFamily: F.uiBold, color: C.paperWarm },
  options: {
    fontFamily: F.ui,
    fontSize: 13.5,
    color: C.ink,
    paddingVertical: 7,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.lineInput,
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 9 },
  toggleLabel: { flex: 1, fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  note: { fontFamily: F.ui, fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 8 },
});
