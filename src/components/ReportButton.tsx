import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MIN_REPORT_QUOTE, REPORT_KINDS, type ReportKind } from '@/api/report';
import { C, F, shadow } from '@/theme';

/**
 * Nút "Báo cáo" + ngăn nhập đi kèm, cho tin đăng lẫn người bán.
 *
 * Nút và ngăn ở chung một component vì chúng là MỘT thao tác: tách ra thì mỗi call-site phải tự
 * giữ một `useState` mở/đóng và tự nhớ gắn ngăn vào cây — hai mảnh luôn đi cùng nhau mà vẫn có
 * thể quên một.
 *
 * Mutation vẫn do route gọi (AGENTS §Kiến trúc): component chỉ báo lên `onSubmit`, và nhận lại
 * `close` để đóng ngăn sau khi route xác nhận đã gửi xong.
 *
 * Loại báo cáo là chip BẮT BUỘC chọn, mô tả là ô tự do bắt buộc điền: người xử lý đọc cả hai —
 * mã loại để xếp mức nặng nhẹ, còn câu mô tả mới nói được chuyện gì đã xảy ra. Thiếu vế sau thì
 * hàng đợi đầy những dòng "Nghi lừa đảo" không ai kiểm chứng nổi.
 */
export function ReportButton({
  label,
  target,
  pending,
  onSubmit,
}: {
  /** Chữ trên nút, vd "⚑ Báo cáo tin này". */
  label: string;
  /** Tên đối tượng, hiện trên tiêu đề ngăn. */
  target: string;
  pending: boolean;
  onSubmit: (values: { kind: ReportKind; quote: string }, close: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [quote, setQuote] = useState('');

  const close = () => {
    setOpen(false);
    setKind(null);
    setQuote('');
  };

  const missing = !kind
    ? 'Chọn một loại báo cáo'
    : quote.trim().length < MIN_REPORT_QUOTE
      ? `Còn ${MIN_REPORT_QUOTE - quote.trim().length} ký tự nữa`
      : '';

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.trigger}>
        <Text style={styles.triggerText}>{label}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.scrim} onPress={close} />

        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.heading}>Báo cáo {target}</Text>
            <Text style={styles.sub}>
              Quản trị đọc báo cáo này. Người bị báo cáo không thấy tên bạn.
            </Text>

            <View style={styles.chips}>
              {REPORT_KINDS.map((k) => (
                <Pressable
                  key={k.value}
                  onPress={() => setKind(k.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    kind === k.value && styles.chipOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.chipText, kind === k.value && { color: '#fff' }]}>
                    {k.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={quote}
              onChangeText={setQuote}
              placeholder="Chuyện gì đã xảy ra?"
              placeholderTextColor={C.muted}
              maxLength={500}
              multiline
              style={styles.input}
            />

            <View style={styles.actions}>
              {/* Nói ra điều còn thiếu thay vì chỉ làm mờ nút: nút xám không kèm lý do là người
                  dùng bấm mãi rồi bỏ, không hiểu mình đang thiếu cái gì. */}
              <Text style={styles.hint}>{missing}</Text>
              <Pressable onPress={close} hitSlop={6}>
                <Text style={styles.cancel}>Huỷ</Text>
              </Pressable>
              <Pressable
                disabled={!!missing || pending}
                onPress={() => kind && onSubmit({ kind, quote: quote.trim() }, close)}
                style={({ pressed }) => [
                  styles.submit,
                  (!!missing || pending) && { opacity: 0.4 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.submitText}>{pending ? 'Đang gửi...' : 'Gửi báo cáo'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { alignSelf: 'flex-start', marginTop: 8 },
  triggerText: { fontFamily: F.uiSemi, fontSize: 12, color: C.inkSoft },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: C.scrim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.paperWarm,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    ...shadow,
  },
  heading: { fontFamily: F.uiBlack, fontSize: 16, color: C.ink },
  sub: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.inkSoft, marginTop: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1.5,
    borderColor: C.lineInput,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { borderColor: C.pin, backgroundColor: C.pin },
  chipText: { fontFamily: F.uiSemi, fontSize: 11.5, color: C.inkSoft },
  input: {
    minHeight: 72,
    textAlignVertical: 'top',
    backgroundColor: C.paper,
    borderRadius: 8,
    padding: 11,
    fontFamily: F.ui,
    fontSize: 13,
    lineHeight: 19,
    color: C.ink,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hint: { flex: 1, fontFamily: F.ui, fontSize: 11, color: C.inkSoft },
  cancel: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  submit: { backgroundColor: C.pin, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  submitText: { fontFamily: F.uiBold, fontSize: 13, color: '#fff' },
});
