import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReorderableList, { type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { TemplateFieldCard } from './TemplateFieldCard';
import { MAX_FIELDS, MAX_FILTERABLE } from '@/api/templates';
import type { DraftField } from '@/api/templates';
import { C, F, R } from '@/theme';

/**
 * Danh sách thuộc tính của template — kéo thả để đổi thứ tự.
 *
 * `ReorderableList` là FlatList nên nó phải là VÙNG CUỘN của màn, không nằm trong `ScrollView`
 * nào: hai lớp cuộn lồng nhau thì kéo một thẻ tới mép danh sách sẽ cuộn lớp ngoài chứ không
 * cuộn danh sách. Nhãn đếm và nút thêm vì thế đi vào header/footer của chính nó.
 *
 * Tách khỏi route vì `app/admin/category-templates.tsx` chạm trần 250 dòng (HARD#11).
 *
 * Handler nhận `index` chứ không nhận `uid`: mọi thao tác ở đây là thao tác trên MẢNG (đổi chỗ,
 * xoá, sửa một phần tử), mà tra `uid` ra index rồi mới sửa thì thêm một bước để sai.
 */
export function TemplateFieldList({
  fields,
  onPatch,
  onRemove,
  onReorder,
  onAdd,
}: {
  fields: DraftField[];
  onPatch: (index: number, next: Partial<DraftField>) => void;
  onRemove: (index: number) => void;
  onReorder: (event: ReorderableListReorderEvent) => void;
  onAdd: () => void;
}) {
  const filterable = fields.filter((f) => f.filterable).length;

  return (
    <ReorderableList
      data={fields}
      onReorder={onReorder}
      // `uid` của dòng, không phải `f.key`: khoá sinh lại theo từng ký tự người soạn gõ vào tên,
      // dùng nó thì ô nhập bị dựng lại và mất tiêu điểm sau mỗi ký tự.
      keyExtractor={(f) => f.uid}
      renderItem={({ item, index }) => (
        <TemplateFieldCard
          field={item}
          onPatch={(next) => onPatch(index, next)}
          onRemove={() => onRemove(index)}
        />
      )}
      // Dựng hết ngay từ đầu: BE chặn ở 40 field nên danh sách không thể dài hơn thế, mà để
      // FlatList tháo bớt dòng ngoài màn thì ô nhập đang gõ dở bị huỷ khi cuộn qua nó.
      initialNumToRender={MAX_FIELDS}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.body}
      ListHeaderComponent={
        <Text style={styles.label}>
          THUỘC TÍNH ĐẶC THÙ · {fields.length} field · {filterable}/{MAX_FILTERABLE} mở lọc
        </Text>
      }
      ListFooterComponent={
        <View>
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.addText}>+ Thêm thuộc tính</Text>
          </Pressable>
          <Text style={styles.hint}>Giữ vào ⣿ rồi kéo để đổi thứ tự hiện trên form đăng tin.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  label: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: C.inkSoft,
    marginBottom: 10,
  },
  add: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: R.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.lineInput,
  },
  addText: { fontFamily: F.uiBold, fontSize: 13, color: C.inkSoft },
  hint: {
    fontFamily: F.ui,
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
    textAlign: 'center',
    marginTop: 10,
  },
});
