import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
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

export function FormSection({ step, title, hint }: { step?: number; title: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        {step !== undefined && (
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        )}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {/* Hint thẳng cột với tiêu đề, không chui xuống dưới huy hiệu — mắt đọc theo một mép. */}
      {!!hint && <Text style={[styles.sectionHint, step !== undefined && styles.hintIndent]}>{hint}</Text>}
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

/**
 * Ô CHỌN cùng hình thẻ với `BoxField` — form đăng tin không được trộn hai ngôn ngữ ô nhập.
 *
 * Tồn tại vì các field động (`AttrFields`) từng vẽ select bằng kiểu gạch chân cũ: đứng cạnh
 * các thẻ tiêu đề/giá, nó trông như một dòng kẻ bị bỏ quên. Dùng CHUNG style thẻ ở đây thay
 * vì chép sang file kia — chép là hai bản lệch nhau ngay lần chỉnh thẻ kế tiếp.
 */
export function BoxSelect({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  /** Nhãn của giá trị đang chọn — `undefined` là chưa chọn, hiện placeholder mờ. */
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.box, pressed && styles.boxOn]}>
      <Text style={styles.boxLabel}>{label}</Text>
      <View style={styles.boxLine}>
        <Text numberOfLines={1} style={[styles.boxValue, !value && { color: C.muted }]}>
          {value ?? placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </View>
    </Pressable>
  );
}

/** Công tắc trong thẻ — cả thẻ là vùng bấm, không bắt ngón tay nhắm trúng cái Switch nhỏ. */
export function BoxSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.box, styles.switchBox]}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: C.pin, false: C.lineInput }}
      />
    </Pressable>
  );
}

/** Thẻ bọc cho nội dung tuỳ ý mang cùng nhãn nhỏ — hàng chip của multiselect dùng nó. */
export function BoxGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.box}>
      <Text style={styles.boxLabel}>{label}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.corkDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: F.uiBlack, fontSize: 12, color: C.ink },
  sectionTitle: { fontFamily: F.uiBlack, fontSize: 15, color: C.ink },
  sectionHint: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 17 },
  hintIndent: { marginLeft: 30 },

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
  boxValue: { flex: 1, fontFamily: F.uiBold, fontSize: 15, color: C.ink, paddingVertical: 7 },
  chevron: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchLabel: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink },
  groupBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 9,
    paddingBottom: 5,
  },
});
