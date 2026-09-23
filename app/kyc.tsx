import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface } from '@/components/Surface';
import { Field, Loading, PinButton, ScreenHeader, TapeChip } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMyKyc, useSubmitKyc } from '@/queries/kyc';
import type { KycSubject } from '@/api/kyc';
import { C, F, S } from '@/theme';

/**
 * HỒ SƠ ĐỊNH DANH NGƯỜI BÁN — màn TẠM THỜI cho vòng kiểm duyệt của Bộ Công Thương.
 *
 * Gỡ về sau: xoá file này, `api/kyc.ts`, `queries/kyc.ts`, và một dòng `<KycGate>` ở
 * `app/(tabs)/_layout.tsx`. Không file nào khác biết tới nó.
 *
 * Hai tab = hai ĐỐI TƯỢNG Bộ phân biệt, không phải hai cách bày cùng một form. Cá nhân khai ba
 * trường; tổ chức khai thêm ba trường doanh nghiệp, và ba trường cá nhân khi đó là của NGƯỜI
 * ĐẠI DIỆN THEO PHÁP LUẬT — nhãn phải nói ra điều đó, không thì người nộp điền tên công ty vào
 * ô họ tên.
 */
const TABS: { value: KycSubject; label: string }[] = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'company', label: 'Tổ chức' },
];

export default function KycScreen() {
  const toast = useToast();
  const { data: profile, isPending } = useMyKyc();
  const submit = useSubmitKyc();

  const [subject, setSubject] = useState<KycSubject>('individual');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTaxCode, setCompanyTaxCode] = useState('');

  const isCompany = subject === 'company';

  /*
   * Chặn ở client ĐÚNG những lỗi hình dạng, không hơn.
   *
   * "Số này có thật không" là câu của người duyệt, không phải của app — dựng thêm luật ở đây
   * chỉ tạo một định nghĩa thứ hai về "hợp lệ" để nó lệch với zod của BE.
   */
  const gap = (): string | null => {
    if (fullName.trim().length < 2) return 'Nhập họ tên đầy đủ';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) return 'Ngày sinh theo dạng YYYY-MM-DD';
    if (!/^\d{9,12}$/.test(idNumber.trim())) return 'Số định danh gồm 9–12 chữ số';
    if (!isCompany) return null;
    if (companyName.trim().length < 2) return 'Nhập tên tổ chức';
    if (companyAddress.trim().length < 5) return 'Nhập địa chỉ trụ sở chính';
    if (!/^\d{10}(-\d{3})?$/.test(companyTaxCode.trim())) return 'Mã số tổ chức gồm 10 chữ số';
    return null;
  };

  const send = () => {
    const err = gap();
    if (err) return toast(`⚠️ ${err}`);
    submit.mutate(
      {
        subjectType: subject,
        fullName: fullName.trim(),
        birthDate: birthDate.trim(),
        idNumber: idNumber.trim(),
        ...(isCompany
          ? {
              companyName: companyName.trim(),
              companyAddress: companyAddress.trim(),
              companyTaxCode: companyTaxCode.trim(),
            }
          : {}),
      },
      {
        onSuccess: () => toast('✓ Đã nộp hồ sơ — chờ quản trị duyệt'),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );
  };

  if (isPending) {
    return (
      <Surface>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader title="Định danh tài khoản" />
          <Loading />
        </SafeAreaView>
      </Surface>
    );
  }

  // Đã nộp và đang chờ: KHÔNG bày lại form. Nộp đè lên hồ sơ đang chờ chỉ làm hàng đợi của
  // người duyệt đổi liên tục, còn người nộp thì tưởng lần trước không ăn.
  if (profile?.status === 'pending') {
    return <Waiting note="Hồ sơ đã gửi. Quản trị sẽ xem trong thời gian sớm nhất." />;
  }

  return (
    <Surface>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader title="Định danh tài khoản" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              Theo quy định của Bộ Công Thương, tài khoản phải được định danh và duyệt trước khi
              đăng tin. Thông tin chỉ dùng để đối chiếu, không hiển thị công khai.
            </Text>

            {/* Lý do bị từ chối đứng TRƯỚC form: người nộp lại cần biết sửa chỗ nào, chứ không
                phải điền lại từ đầu rồi mới đọc được lời giải thích. */}
            {profile?.status === 'rejected' && !!profile.rejectReason && (
              <View style={styles.rejected}>
                <Text style={styles.rejectedLabel}>HỒ SƠ BỊ TỪ CHỐI</Text>
                <Text style={styles.rejectedText}>{profile.rejectReason}</Text>
              </View>
            )}

            <Text style={styles.label}>BẠN LÀ</Text>
            <View style={styles.tabs}>
              {TABS.map((t, i) => (
                <TapeChip
                  key={t.value}
                  label={t.label}
                  index={i}
                  active={subject === t.value}
                  onPress={() => setSubject(t.value)}
                />
              ))}
            </View>

            {isCompany && (
              <>
                <Field label="Tên tổ chức" value={companyName} onChangeText={setCompanyName} />
                <Field
                  label="Địa chỉ trụ sở chính"
                  value={companyAddress}
                  onChangeText={setCompanyAddress}
                />
                <Field
                  label="Số định danh tổ chức (MST)"
                  value={companyTaxCode}
                  onChangeText={setCompanyTaxCode}
                  keyboardType="number-pad"
                  placeholder="0312345678"
                />
                <Text style={styles.hint}>
                  Ba ô dưới đây là của NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT.
                </Text>
              </>
            )}

            <Field
              label={isCompany ? 'Họ tên người đại diện' : 'Họ và tên'}
              value={fullName}
              onChangeText={setFullName}
            />
            <Field
              label="Ngày sinh"
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="1995-03-12"
            />
            <Field
              label="Số định danh cá nhân (CCCD)"
              value={idNumber}
              onChangeText={setIdNumber}
              keyboardType="number-pad"
              placeholder="079095001234"
              maxLength={12}
            />

            <View style={{ marginTop: S.lg }}>
              <PinButton
                label={profile?.status === 'rejected' ? 'Nộp lại hồ sơ' : 'Gửi hồ sơ'}
                loading={submit.isPending}
                onPress={send}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Surface>
  );
}

/** Màn chờ duyệt — không có nút nào, vì lúc này người nộp không có việc gì làm được. */
function Waiting({ note }: { note: string }) {
  return (
    <Surface>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader title="Định danh tài khoản" />
        <View style={styles.waiting}>
          <Text style={styles.waitingGlyph}>⏳</Text>
          <Text style={styles.waitingTitle}>Đang chờ duyệt</Text>
          <Text style={styles.waitingNote}>{note}</Text>
        </View>
      </SafeAreaView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40 },
  intro: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.inkSoft, marginBottom: S.lg },
  label: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.inkSoft },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: S.lg },
  hint: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: S.xs, marginBottom: S.sm },
  rejected: { backgroundColor: C.badTint, borderRadius: 8, padding: S.lg, marginBottom: S.lg },
  rejectedLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.1, color: C.badText },
  rejectedText: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 18, color: C.ink, marginTop: 4 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  waitingGlyph: { fontSize: 40 },
  waitingTitle: { fontFamily: F.uiBold, fontSize: 16, color: C.ink },
  waitingNote: {
    fontFamily: F.ui,
    fontSize: 13,
    lineHeight: 20,
    color: C.inkSoft,
    textAlign: 'center',
  },
});
