import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { C, F } from '@/theme';

/**
 * Bộ dựng hình cho form đăng tin — tiêu đề nhóm + ô nhập dạng thẻ.
 *
 * Vì sao KHÔNG sửa thẳng `Field` trong `ui.tsx`: nó đang phục vụ 12 màn khác (đăng nhập, đăng
 * ký, các form quản trị) với kiểu gạch chân. Đổi ở đó là đổi giao diện toàn app trong một lượt
 * mà chỉ có form đăng tin được xem lại.
 *
 * Khác biệt so với kiểu gạch chân: nhãn nằm TRONG thẻ, ngay trên giá trị. Trên form dài, nhãn
 * gạch chân trôi khỏi mắt khi bàn phím che mất nửa màn — nhãn trong thẻ thì luôn đi kèm ô nó
 * mô tả.
 */

export function FormSection({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

export function BoxField({
  label,
  suffix,
  style,
  ...props
}: TextInputProps & {
  label: string;
  /** Đơn vị đứng cuối ô — "đ", "m²". Nằm ngoài `value` nên không lọt vào dữ liệu gửi đi. */
  suffix?: string;
}) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[styles.box, focused && styles.boxOn]}>
      <Text style={styles.boxLabel}>{label}</Text>
      <View style={styles.boxLine}>
        <TextInput
          placeholderTextColor={C.muted}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.boxInput, style]}
        />
        {!!suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontFamily: F.uiBlack, fontSize: 15, color: C.ink },
  sectionHint: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 17 },

  box: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 4,
    marginBottom: 10,
  },
  // Viền đổi màu khi gõ: trên một form toàn thẻ giống nhau, đây là tín hiệu duy nhất cho biết
  // bàn phím đang gõ vào ô nào.
  boxOn: { borderColor: C.pin, backgroundColor: C.paperWarm },
  boxLabel: { fontFamily: F.ui, fontSize: 11, color: C.inkSoft },
  boxLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boxInput: { flex: 1, fontFamily: F.uiBold, fontSize: 15, color: C.ink, paddingVertical: 7 },
  suffix: { fontFamily: F.uiBold, fontSize: 14, color: C.inkSoft },
});
