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
import { C, F, S } from '@/theme';

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

export function FormSection({
  step,
  title,
  hint,
  flush,
}: {
  step?: number;
  title: string;
  hint?: string;
  /**
   * Bỏ lề trên. Dùng khi mục đã nằm trong một THẺ riêng — lúc đó đệm của thẻ đã tạo khoảng
   * cách, và lề 22px mặc định chồng thêm thành một mảng trống ở đầu mỗi thẻ.
   *
   * Lề mặc định giữ nguyên cho form cũ (`org/[slug]/edit`) vốn xếp mọi mục trong một tờ liền —
   * ở đó lề chính là thứ duy nhất tách hai mục ra.
   */
  flush?: boolean;
}) {
  return (
    <View style={[styles.section, flush && styles.sectionFlush]}>
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
  counter,
  style,
  ...props
}: TextInputProps & {
  label: string;
  /** Đơn vị đứng cuối ô — "đ", "m²". Nằm ngoài `value` nên không lọt vào dữ liệu gửi đi. */
  suffix?: string;
  /**
   * Bật bộ đếm "đã gõ / tối đa" dưới ô. Chỉ có nghĩa khi đã truyền `maxLength` — nó đọc chính
   * con số đó, nên không có cách nào để đếm và trần thực tế nói hai điều khác nhau.
   *
   * Không bật mặc định: ô ngắn như giá thì trần là chuyện của máy, người gõ không cần biết.
   * Đáng bật ở ô mà người ta thật sự viết dài và có thể đụng trần — tiêu đề, mô tả.
   */
  counter?: boolean;
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
      {counter && !!props.maxLength && (
        <Text style={styles.counter}>
          {String(props.value ?? '').length} / {props.maxLength}
        </Text>
      )}
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
  /*
   * Mọi khoảng cách dưới đây bám thang `S` của theme, không còn số tự chọn.
   *
   * Bản trước dùng 13 / 9 / 4 / 10 / 22 / 7 / 5 — mỗi con số đều hợp lý khi nhìn riêng, nhưng
   * không cái nào là bội của cái nào, nên không có nhịp dọc nào để mắt bám vào. Đó là lý do
   * form đọc ra 'chật và lộn xộn' chứ không phải vì thiếu chỗ ở một ô cụ thể.
   */
  section: { marginTop: S.xl, marginBottom: S.md },
  sectionFlush: { marginTop: 0 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
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
  sectionHint: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: S.sm, lineHeight: 18 },
  hintIndent: { marginLeft: 30 },

  box: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: S.md,
    paddingTop: S.md,
    /*
     * Đáy 8 chứ không 4. Bản trước đỉnh 9 / đáy 4 — lệch hơn gấp đôi, nên chữ trong ô luôn
     * trông như tụt xuống sát mép dưới, và bộ đếm ký tự mới thêm chỉ cách viền đúng 4px.
     */
    paddingBottom: S.sm,
    marginBottom: S.md,
  },
  // Viền đổi màu khi gõ: trên một form toàn thẻ giống nhau, đây là tín hiệu duy nhất cho biết
  // bàn phím đang gõ vào ô nào.
  boxOn: { borderColor: C.pin, backgroundColor: C.paperWarm },
  boxLabel: { fontFamily: F.ui, fontSize: 11, color: C.inkSoft },
  /** Canh phải: mắt đọc ô từ trái, con số phụ đứng cuối dòng thì không chen vào nội dung. */
  counter: {
    fontFamily: F.mono,
    fontSize: 10.5,
    color: C.muted,
    textAlign: 'right',
    marginTop: S.sm,
  },
  boxLine: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  boxInput: { flex: 1, fontFamily: F.uiBold, fontSize: 15, color: C.ink, paddingVertical: S.sm },
  suffix: { fontFamily: F.uiBold, fontSize: 14, color: C.inkSoft },
  boxValue: { flex: 1, fontFamily: F.uiBold, fontSize: 15, color: C.ink, paddingVertical: S.sm },
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
    paddingTop: S.md,
    paddingBottom: S.sm,
  },
});
