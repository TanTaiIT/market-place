import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPicker } from '@/components/AvatarPicker';
import { AddressField, ProvinceField, WardField } from '@/components/LocationPicker';
import { SettingsChoice, SettingsSection } from '@/components/SettingsCard';
import { EmptyState, Field, Loading, PinButton, ScreenHeader, Switch } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useProfile, useUpdateProfile } from '@/queries/listings';
import { useAuthStore } from '@/stores/auth';
import { GENDER_LABEL } from '@/api/db';
import type { Gender, Profile } from '@/api/db';
import { C, F, R, S, T } from '@/theme';

const GENDER_OPTIONS = (Object.keys(GENDER_LABEL) as Gender[]).map((key) => ({
  key,
  text: GENDER_LABEL[key],
}));

/** Chỉ những field sửa được. `posted`/`sold`/`rating` là số BE chốt, không phải ô nhập. */
type Form = Pick<
  Profile,
  'name' | 'phone' | 'avatarUrl' | 'gender' | 'province' | 'ward' | 'address' | 'showPhone'
>;

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const userId = useAuthStore((s) => s.session?.userId);
  const { data: profile, error } = useProfile();
  const update = useUpdateProfile();

  /*
   * State chỉ giữ NHỮNG Ô ĐÃ SỬA, form đầy đủ dựng lại lúc render từ hồ sơ mới nhất.
   *
   * Cách hiển nhiên hơn — `useEffect` nạp cả hồ sơ vào state một lần — phải tự chặn không cho
   * lần chạy sau đè lên thứ người dùng đang gõ, vì `useUpdateProfile` ghi lại cache ngay khi
   * lưu xong. Chồng `draft` lên hồ sơ thì thứ tự đó tự đúng: nền luôn mới, ô đang sửa luôn
   * thắng, và không có nhịp nào state cũ hơn server.
   */
  const [draft, setDraft] = useState<Partial<Form>>({});
  const patch = (part: Partial<Form>) => setDraft((d) => ({ ...d, ...part }));

  // Nhánh lỗi phải đứng TRƯỚC nhánh chờ: hồ sơ hỏng thì `profile` mãi `undefined`, và kiểm
  // `!profile` trước sẽ giữ màn ở spinner vĩnh viễn — thông điệp lỗi không bao giờ hiện ra.
  if (error) {
    return <EmptyState icon="📡" text={(error as Error).message || 'Không tải được hồ sơ'} />;
  }
  if (!profile) return <Loading />;

  const base = pickForm(profile);
  const form = { ...base, ...draft };
  // So GIÁ TRỊ chứ không đếm key trong `draft`: sửa rồi sửa lại như cũ phải về 0, đúng lúc một
  // cờ `dirty` bật-một-lần sẽ nói dối trên một màn dài phải cuộn mới thấy nút lưu.
  const dirty = (Object.keys(base) as (keyof Form)[]).filter((k) => form[k] !== base[k]).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Tài khoản" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <AvatarPicker
              initials={profile.avatar}
              url={form.avatarUrl}
              onChange={(avatarUrl) => patch({ avatarUrl })}
            />
            <View style={styles.heroText}>
              <Text numberOfLines={1} style={styles.heroName}>
                {form.name || profile.name}
              </Text>
              <Text numberOfLines={1} style={styles.heroMail}>
                {profile.email}
              </Text>
              {/*
                Huy hiệu bám XÁC THỰC EMAIL chứ không phải số điện thoại như bản mẫu: app chưa
                có luồng xác thực SĐT nào, nên một dấu "đã xác thực" cạnh số là lời khẳng định
                không có gì đứng sau. Email thì có thật, và khi chưa xong nó còn là lối vào.
              */}
              {profile.emailVerified ? (
                <Text style={styles.ok}>✓ Email đã xác thực</Text>
              ) : (
                <Text style={styles.warn} onPress={() => router.push('/verify-email')}>
                  ⚠️ Email chưa xác thực — xác thực ngay
                </Text>
              )}
            </View>
          </View>

          {/* Chỉ hiện khi biết id: hồ sơ công khai tra theo `/users/{id}`, không có id thì link
              dẫn tới màn lỗi chứ không phải tới trang trống. */}
          {!!userId && (
            <Pressable onPress={() => router.push(`/user/${userId}`)} style={styles.peek}>
              <Text style={styles.peekText}>👁  Xem hồ sơ của bạn như người mua thấy</Text>
            </Pressable>
          )}

          <SettingsSection title="Thông tin công khai" visibility="public">
            <Field
              label="Họ và tên"
              value={form.name}
              onChangeText={(name) => patch({ name })}
              placeholder="Tên hiện trên tin đăng"
            />
            <SettingsChoice
              label="GIỚI TÍNH"
              options={GENDER_OPTIONS}
              value={form.gender}
              onChange={(gender) => patch({ gender })}
            />
          </SettingsSection>

          <SettingsSection title="Liên hệ" visibility="private" badgeLabel="🔒  Bạn tự chọn hiển thị">
            <Field
              label="Số điện thoại"
              value={form.phone}
              onChangeText={(phone) => patch({ phone })}
              keyboardType="phone-pad"
              placeholder="Chưa có số"
            />
            <Pressable
              onPress={() => patch({ showPhone: !form.showPhone })}
              style={({ pressed }) => [styles.block, styles.switchRow, pressed && { opacity: 0.75 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Hiện số cho người mua</Text>
                {/* Nói ra giới hạn thật, thay vì để người dùng tự phát hiện sau khi tắt mà số cũ
                    vẫn còn trên tin đăng hôm qua. */}
                <Text style={styles.switchDesc}>
                  Tắt thì người mua chỉ nhắn tin trong app. Chỉ áp dụng cho tin
                  <Text style={styles.strong}> đăng mới</Text> — tin cũ giữ nguyên số.
                </Text>
              </View>
              <Switch on={form.showPhone} />
            </Pressable>
          </SettingsSection>

          <SettingsSection
            title="Khu vực của bạn"
            visibility="private"
            note="Dùng để điền sẵn khi bạn đăng tin, đỡ phải chọn lại mỗi lần. Mỗi tin vẫn mang khu vực riêng của nó."
          >
            <ProvinceField
              value={form.province ?? null}
              onChange={(province) => patch({ province: province ?? undefined })}
              allowAll
            />
            <WardField
              province={form.province ?? null}
              value={form.ward ?? null}
              onChange={(ward) => patch({ ward: ward ?? undefined })}
            />
            <AddressField value={form.address ?? ''} onChange={(address) => patch({ address })} />
          </SettingsSection>
        </ScrollView>

        {/*
          Thanh lưu DÍNH đáy, ngoài vùng cuộn. Bản trước để nút ở cuối danh sách, nên người sửa ô
          đầu tiên phải cuộn qua cả ba mục mới thấy nó — và không có gì nói cho họ biết còn thay
          đổi chưa lưu trước khi họ bấm quay lại.
        */}
        <View style={styles.saveBar}>
          <Text style={[styles.dirtyNote, dirty > 0 && { color: C.brandTx }]}>
            {dirty === 0 ? 'Đã lưu mọi thay đổi' : `${dirty} thay đổi chưa lưu`}
          </Text>
          <PinButton
            label="Lưu thay đổi"
            tone="ok"
            style={styles.saveBtn}
            disabled={dirty === 0}
            loading={update.isPending}
            onPress={() =>
              update.mutate(form, {
                // Dọn `draft` chứ không để nó trùng nền: BE có chuẩn hoá lại (cắt khoảng trắng
                // ở số điện thoại), và giữ bản chưa chuẩn hoá thì màn báo "chưa lưu" mãi mãi.
                onSuccess: () => {
                  setDraft({});
                  toast('✓ Đã lưu thay đổi!');
                },
                onError: (e: Error) => toast(`⚠️ ${e.message}`),
              })
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function pickForm(p: Profile): Form {
  return {
    name: p.name,
    phone: p.phone,
    avatarUrl: p.avatarUrl,
    gender: p.gender,
    province: p.province,
    ward: p.ward,
    address: p.address,
    showPhone: p.showPhone,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xl },

  hero: { flexDirection: 'row', alignItems: 'center', gap: S.lg, marginBottom: S.md },
  heroText: { flex: 1, minWidth: 0 },
  heroName: { fontFamily: F.uiBold, ...T.lg, color: C.ink },
  heroMail: { fontFamily: F.ui, ...T.xs, color: C.muted, marginTop: 1 },
  ok: { fontFamily: F.uiBold, ...T.xs, color: C.brandTx, marginTop: S.xs },
  warn: { fontFamily: F.uiBold, ...T.xs, color: C.pin, marginTop: S.xs },

  peek: {
    backgroundColor: C.chipIdle,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
    marginBottom: S.xl,
  },
  peekText: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, textAlign: 'center' },

  // 18px = nhịp `styles.field` của ô nhập; khối tự dựng phải trùng nó, xem `SettingsCard`.
  block: { marginBottom: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  switchTitle: { fontFamily: F.uiBold, ...T.sm, color: C.ink },
  switchDesc: { fontFamily: F.ui, ...T.xs, color: C.inkSoft, marginTop: 2 },
  strong: { fontFamily: F.uiBold },

  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingHorizontal: S.lg,
    paddingTop: S.md,
    paddingBottom: 6,
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  // Nút chiếm phần dư, chữ co lại — không phải ngược lại: `btnFace` của `PinButton` không có
  // `paddingHorizontal` nào, để nó tự co là ra một mẩu đúng bề ngang chữ. Mọi màn khác không lộ
  // vì đều dùng nó full-width; `TemplateSaveBar` cũng giải bằng đúng `flex: 1` này.
  saveBtn: { flex: 1 },
  dirtyNote: { flexShrink: 1, fontFamily: F.ui, ...T.xs, color: C.muted },
});
