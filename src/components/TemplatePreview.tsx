import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttrFields } from './AttrFields';
import { Surface } from './Surface';
import { EmptyState, ScreenHeader } from './ui';
import { draftToResolved } from '@/api/templates';
import type { DraftField, FieldDefinition } from '@/api/templates';
import type { ListingAttributes } from '@/api/db';
import { C, F, R, shadow } from '@/theme';

/**
 * Xem trước bản NHÁP bằng chính renderer của form đăng tin.
 *
 * Không có API xem trước, và cũng không cần: `AttrFields` chỉ đọc hình `TemplateField`, nên
 * `draftToResolved` ghép nháp thành hình đó ngay tại client. Quan trọng là dùng ĐÚNG renderer
 * của form thật — dựng một bản xem trước riêng nghĩa là hai renderer, và cái xem trước sẽ nói
 * dối ngay lần đầu ai đó sửa cái kia.
 *
 * Giá trị người ta gõ vào đây là state cục bộ và mất khi đóng — đúng ý: đây là bản thử, không
 * phải một tin đăng dở.
 */
export function TemplatePreview({
  visible,
  fields,
  dictionary,
  onClose,
}: {
  visible: boolean;
  fields: DraftField[];
  dictionary: FieldDefinition[];
  onClose: () => void;
}) {
  const [values, setValues] = useState<ListingAttributes>({});
  const resolved = useMemo(() => draftToResolved(fields, dictionary), [fields, dictionary]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Surface>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <ScreenHeader title="Xem trước" onBack={onClose} />

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.lead}>
              Đúng phần thuộc tính người đăng tin sẽ thấy. Đây là bản nháp — chưa ai ngoài bạn
              gặp nó.
            </Text>

            <View style={styles.sheet}>
              {resolved.length === 0 ? (
                <EmptyState icon="🗂" text="Chưa có thuộc tính nào để xem" />
              ) : (
                <AttrFields fields={resolved} values={values} onChange={setValues} />
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: 18, paddingBottom: 28 },
  lead: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 18, color: C.inkSoft, paddingTop: 8 },
  // Cùng ẩn dụ tờ giấy với `ListingForm`: xem trước mà đặt trên nền khác thì màu chữ đã chọn
  // cho nền giấy sẽ không nói được gì về form thật.
  sheet: {
    backgroundColor: C.paperWarm,
    borderRadius: R.lg,
    padding: 16,
    marginTop: 14,
    ...shadow,
  },
});
