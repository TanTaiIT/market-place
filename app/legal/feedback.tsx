import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSubmitFeedback } from '@/queries/social-feedback';
import { C, F, S, T } from '@/theme';

/**
 * Gửi đánh giá / phản ánh / kiến nghị của tổ chức xã hội — cụm tạm thời, gỡ theo `@/api/legal`.
 *
 * Là một ROUTE dựng dạng modal (`presentation: 'modal'` khai ở `app/_layout.tsx`), không phải
 * `<Modal>` đặt trong `SiteFooter`. Lý do là luật của repo: mutation chỉ được khởi phát từ
 * `app/**`. Đặt form trong component thì `useSubmitFeedback` bị gọi ở tầng cấm.
 *
 * Không cần đăng nhập — nên nó nằm ngoài khối `Stack.Protected`. Tổ chức xã hội gửi kiến nghị
 * không phải là người dùng của sàn.
 */
export default function SocialFeedbackForm() {
  const router = useRouter();
  const toast = useToast();
  const submit = useSubmitFeedback();

  const [orgName, setOrgName] = useState('');
  const [decisionNo, setDecisionNo] = useState('');
  const [content, setContent] = useState('');

  /*
   * Chốt ở client KHỚP TỪNG SỐ với Zod của BE (`createSocialFeedbackSchema`): chặn tại chỗ để
   * người gửi biết ngay thay vì mất một vòng mạng. BE vẫn kiểm lại — đây là tiện nghi, không
   * phải hàng rào.
   */
  const ready = orgName.trim().length >= 2 && decisionNo.trim().length >= 1 && content.trim().length >= 10;

  const send = () =>
    submit.mutate(
      { orgName: orgName.trim(), decisionNo: decisionNo.trim(), content: content.trim() },
      {
        onSuccess: () => {
          // Nói thẳng là CHƯA hiện ngay: người gửi quay lại trang công bố mà không thấy ý kiến
          // của mình sẽ tưởng gửi hỏng và gửi lại — đúng thứ rate limit sẽ chặn.
          toast('✅ Đã tiếp nhận. Ý kiến sẽ được công bố sau khi duyệt.');
          router.back();
        },
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Gửi ý kiến" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Tiếp nhận đánh giá, phản ánh, kiến nghị của tổ chức xã hội tham gia bảo vệ quyền lợi
            người tiêu dùng.
          </Text>

          <Field
            label="Tên tổ chức xã hội"
            placeholder="Tên tổ chức xã hội"
            value={orgName}
            onChangeText={setOrgName}
          />
          <Field
            label="Số quyết định thành lập"
            placeholder="Số quyết định thành lập"
            value={decisionNo}
            onChangeText={setDecisionNo}
          />
          <Field
            label="Nội dung"
            placeholder="Nhập nội dung"
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={5}
            style={styles.area}
          />

          <PinButton
            label="Gửi"
            tone="ok"
            onPress={send}
            disabled={!ready}
            loading={submit.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xxl },
  lead: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginBottom: S.lg },
  /* `textAlignVertical` cho Android: mặc định nó canh giữa ô nhiều dòng, iOS thì canh trên. */
  area: { height: 112, textAlignVertical: 'top', paddingTop: S.sm },
});
