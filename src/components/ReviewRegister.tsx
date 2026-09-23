import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, PinButton, TapeChip } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useRegister } from '@/queries/auth';
import { useSignIn } from '@/stores/auth';
import { kycApi, type KycSubject } from '@/api/kyc';
import { setHttpSession } from '@/api/http';
import { C, F, G, S } from '@/theme';

/**
 * ĐĂNG KÝ KÈM ĐỊNH DANH — màn TẠM THỜI cho vòng kiểm duyệt của Bộ Công Thương.
 *
 * Bộ yêu cầu "trong mọi trường hợp đều phải duyệt tk", và phân biệt hai đối tượng với hai bộ
 * trường. Nên bước đăng ký gộp luôn hồ sơ định danh: người dùng khai một lần, và hồ sơ vào
 * hàng chờ duyệt ngay — thay vì đăng ký xong rồi bị đẩy sang một form thứ hai.
 *
 * Gỡ về sau: xoá file này, xoá `if (REVIEW_MODE)` ở `app/register.tsx`. Form đăng ký cũ nằm
 * nguyên bên dưới dòng đó, không bị xoá, nên nó sống lại ngay.
 */
const TABS: { value: KycSubject; label: string }[] = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'company', label: 'Tổ chức' },
];

export function ReviewRegister() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const register = useRegister();
  const signIn = useSignIn();

  const [subject, setSubject] = useState<KycSubject>('individual');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    email: '',
    password: '',
    phone: '',
    fullName: '',
    birthDate: '',
    idNumber: '',
    companyName: '',
    companyAddress: '',
    companyTaxCode: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const isCompany = subject === 'company';

  /** Chỉ chặn lỗi HÌNH DẠNG — "số này có thật không" là câu của người duyệt, không phải của app. */
  const gap = (): string | null => {
    if (!f.email.includes('@')) return 'Nhập email hợp lệ';
    if (f.password.length < 6) return 'Mật khẩu ít nhất 6 ký tự';
    if (f.fullName.trim().length < 2)
      return isCompany ? 'Nhập họ tên người đại diện' : 'Nhập họ và tên';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.birthDate.trim())) return 'Ngày sinh theo dạng YYYY-MM-DD';
    if (!/^\d{9,12}$/.test(f.idNumber.trim())) return 'Số định danh gồm 9–12 chữ số';
    if (!isCompany) return null;
    if (f.companyName.trim().length < 2) return 'Nhập tên tổ chức';
    if (f.companyAddress.trim().length < 5) return 'Nhập địa chỉ trụ sở chính';
    if (!/^\d{10}(-\d{3})?$/.test(f.companyTaxCode.trim())) return 'Mã số tổ chức gồm 10 chữ số';
    return null;
  };

  /**
   * Ba bước, và THỨ TỰ là toàn bộ vấn đề.
   *
   * `signIn` phải đứng CUỐI: nó đổi `Stack.Protected` sang stack đã-đăng-nhập, và mọi việc còn
   * dang dở sau đó chạy trên một màn sắp bị tháo. Nhưng lượt nộp hồ sơ lại CẦN token — nên
   * `setHttpSession` được gọi thẳng, trước, thay vì chờ `useSyncAccessToken` đẩy xuống ở lượt
   * render kế tiếp. Nó idempotent (hook kia vẫn ghi lại y vậy khi render), nên gọi sớm vô hại.
   *
   * Hỏng ở bước nộp hồ sơ thì tài khoản ĐÃ tạo — nói thẳng điều đó thay vì im lặng, và mời họ
   * đăng nhập để nộp lại. Giấu đi thì họ bấm đăng ký lần hai và ăn "email đã được đăng ký".
   */
  const submit = async () => {
    const err = gap();
    if (err) return toast(`⚠️ ${err}`);

    setBusy(true);
    try {
      const session = await register.mutateAsync({
        name: f.fullName.trim(),
        email: f.email.trim(),
        password: f.password,
        phone: f.phone.trim() || undefined,
      });

      setHttpSession({ accessToken: session.accessToken, userId: session.userId });
      await kycApi.submit({
        subjectType: subject,
        fullName: f.fullName.trim(),
        birthDate: f.birthDate.trim(),
        idNumber: f.idNumber.trim(),
        ...(isCompany
          ? {
              companyName: f.companyName.trim(),
              companyAddress: f.companyAddress.trim(),
              companyTaxCode: f.companyTaxCode.trim(),
            }
          : {}),
      });

      toast('✓ Đã gửi hồ sơ — chờ quản trị duyệt');
      signIn(session);
    } catch (e) {
      toast(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={G.auth} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 30, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.sub}>
            Theo quy định của Bộ Công Thương, tài khoản phải được định danh và quản trị duyệt
            trước khi đăng tin.
          </Text>

          <Text style={styles.label}>BẠN ĐĂNG KÝ VỚI TƯ CÁCH</Text>
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

          <Text style={styles.section}>TÀI KHOẢN</Text>
          <Field
            label="Email"
            value={f.email}
            onChangeText={set('email')}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field label="Mật khẩu" value={f.password} onChangeText={set('password')} secureTextEntry />
          <Field
            label="Số điện thoại (không bắt buộc)"
            value={f.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
          />

          {isCompany && (
            <>
              <Text style={styles.section}>TỔ CHỨC</Text>
              <Field label="Tên tổ chức" value={f.companyName} onChangeText={set('companyName')} />
              <Field
                label="Địa chỉ trụ sở chính"
                value={f.companyAddress}
                onChangeText={set('companyAddress')}
              />
              <Field
                label="Số định danh tổ chức (MST)"
                value={f.companyTaxCode}
                onChangeText={set('companyTaxCode')}
                keyboardType="number-pad"
                placeholder="0312345678"
              />
            </>
          )}

          {/* Nhãn mục đổi theo tab: với tổ chức thì ba ô này là của NGƯỜI ĐẠI DIỆN THEO PHÁP
              LUẬT, và không nói ra thì người nộp điền tên công ty vào ô họ tên. */}
          <Text style={styles.section}>
            {isCompany ? 'NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT' : 'ĐỊNH DANH CÁ NHÂN'}
          </Text>
          <Field label="Họ và tên" value={f.fullName} onChangeText={set('fullName')} />
          <Field
            label="Ngày sinh"
            value={f.birthDate}
            onChangeText={set('birthDate')}
            placeholder="1995-03-12"
          />
          <Field
            label="Số định danh cá nhân (CCCD)"
            value={f.idNumber}
            onChangeText={set('idNumber')}
            keyboardType="number-pad"
            placeholder="079095001234"
            maxLength={12}
          />

          <View style={{ marginTop: S.lg }}>
            <PinButton label="Đăng ký" loading={busy || register.isPending} onPress={submit} />
          </View>

          <Text style={styles.link} onPress={() => router.replace('/login')}>
            Đã có tài khoản? Đăng nhập
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/*
 * MỰC trên nền sáng, không phải chữ trắng.
 *
 * `G.auth` là `[C.brandWash, C.corkDark]` — một dải SÁNG (#F4FCF7 → #E4E6EA), xem ghi chú ở
 * `app/login.tsx`. Bản trước đặt `C.paperWarm` (#FFFFFF) cho tiêu đề, nhãn mục và link, tức là
 * trắng trên gần-trắng: không đọc được chữ nào. Màu đó chỉ đúng nếu nền auth còn tối như đợt
 * bảng màu cũ.
 *
 * `opacity` cũng bỏ theo: nó sinh ra để hạ chữ trắng xuống cho đỡ chói trên nền tối. Đặt lên
 * mực trên nền sáng thì nó chỉ làm chữ bạc đi, đúng hướng ngược với thứ đang cần.
 *
 * Bảng màu bám theo `app/login.tsx` — hai màn cùng một nền thì phải cùng một thang chữ, nếu
 * không người dùng đi từ màn này sang màn kia sẽ thấy hai app khác nhau.
 */
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 26 },
  title: { fontFamily: F.uiBold, fontSize: 24, color: C.ink },
  sub: {
    fontFamily: F.ui,
    fontSize: 12.5,
    lineHeight: 19,
    color: C.inkSoft,
    marginTop: 6,
    marginBottom: S.lg,
  },
  label: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.inkSoft },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: S.lg },
  section: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: C.inkSoft,
    marginTop: S.lg,
    marginBottom: 4,
  },
  // `C.pin` như `link` bên `login.tsx`: đây là dòng bấm được, phải khác mực thường mới đọc ra
  // là một lối đi chứ không phải một câu chú thích.
  link: {
    fontFamily: F.uiSemi,
    fontSize: 13,
    color: C.pin,
    textAlign: 'center',
    marginTop: S.lg,
  },
});
