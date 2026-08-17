import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from './ui';
import { useSlugAvailability } from '@/queries/org-admin';
import { slugReasonText } from '@/api/org-admin';
import { C, F } from '@/theme';

/**
 * Ô nhập slug kèm câu trả lời "dùng được chưa" ngay dưới ô.
 *
 * Hỏi TRƯỚC khi submit chứ không để 409 nói hộ: tạo tổ chức là form dài, bắt điền lại từ đầu vì
 * một chữ trùng là cách chắc chắn nhất để người ta bỏ giữa chừng. BE còn trả sẵn gợi ý hậu tố —
 * chạm một cái là điền luôn, khỏi tự nghĩ biến thể.
 *
 * Không tự sinh slug từ tên tổ chức: slug là địa chỉ công khai sống lâu hơn cái tên, đoán hộ rồi
 * ghi thẳng vào ô là kiểu quyết định người dùng chỉ phát hiện ra khi đã muộn.
 */
export function SlugField({
  value,
  onChange,
  label = 'Slug',
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const { result, checking } = useSlugAvailability(value);

  return (
    <View>
      <Field
        onDark
        label={label}
        value={value}
        // Chuẩn hoá ngay lúc gõ: BE chỉ nhận chữ thường, và để người dùng gõ hoa rồi báo lỗi
        // "slug không hợp lệ" là bắt họ đoán ra luật thay vì cho họ thấy nó.
        onChangeText={(next) => onChange(next.toLowerCase().replace(/\s+/g, '-'))}
        placeholder="vi-du-truong-hung-vuong"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {checking ? (
        <Text style={styles.note}>Đang kiểm tra...</Text>
      ) : result ? (
        <Text style={[styles.note, result.available ? styles.ok : styles.bad]}>
          {result.available ? '✓ ' : '✕ '}
          {slugReasonText(result)}
        </Text>
      ) : (
        <Text style={styles.note}>Chỉ dùng chữ thường, số và dấu gạch ngang.</Text>
      )}

      {!!result?.suggestions?.length && (
        <View style={styles.suggestions}>
          {result.suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Kéo lên sát ô nhập: `Field` đã có đệm dưới của riêng nó, để nguyên thì câu trả lời trôi
  // xuống xa tới mức không còn dính vào ô nó đang nói về.
  note: {
    fontFamily: F.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.deskTxtDim,
    marginTop: -8,
  },
  ok: { color: C.mossBright },
  bad: { color: C.pinLight },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  suggestion: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  suggestionText: { fontFamily: F.mono, fontSize: 11.5, color: C.deskTxt },
});
