import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPicker } from '@/components/AvatarPicker';
import { AddressField, ProvinceField, WardField } from '@/components/LocationPicker';
import { EmptyState, Field, Loading, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useProfile, useUpdateProfile } from '@/queries/listings';
import { GENDER_LABEL } from '@/api/db';
import type { Gender, Profile } from '@/api/db';
import { C, F } from '@/theme';

const GENDERS = Object.keys(GENDER_LABEL) as Gender[];

/** Chỉ những field người dùng sửa được. `rating`/`posted`/`sold` là số đọc, không phải ô nhập. */
type Form = Pick<
  Profile,
  'name' | 'phone' | 'avatarUrl' | 'gender' | 'province' | 'ward' | 'address' | 'showPhone'
>;

export default function Settings() {
  const toast = useToast();
  const { data: profile, error } = useProfile();
  const update = useUpdateProfile();

  const [form, setForm] = useState<Form | null>(null);

  // Nạp một lần khi hồ sơ về. Không đồng bộ lại theo mỗi lần `profile` đổi: sau khi lưu, query
  // được ghi lại và effect sẽ đè lên đúng thứ người dùng vừa gõ nếu họ sửa tiếp.
  useEffect(() => {
    setForm((prev) => prev ?? (profile ? pickForm(profile) : null));
  }, [profile]);

  const patch = (part: Partial<Form>) => setForm((f) => (f ? { ...f, ...part } : f));

  // Nhánh lỗi phải đứng TRƯỚC: hồ sơ tải hỏng thì `form` mãi là `null`, và nếu kiểm `!form`
  // trước thì màn đứng ở spinner vĩnh viễn — thông điệp lỗi không bao giờ hiện ra.
  if (error) {
    return <EmptyState icon="📡" text={(error as Error).message || 'Không tải được hồ sơ'} />;
  }
  if (!profile || !form) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Cài đặt" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <AvatarPicker
            initials={profile.avatar}
            url={form.avatarUrl}
            onChange={(avatarUrl) => patch({ avatarUrl })}
          />

          <Field label="Họ và tên" value={form.name} onChangeText={(name) => patch({ name })} />

          <Text style={styles.label}>Giới tính</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => (
              <Chip
                key={g}
                label={GENDER_LABEL[g]}
                on={form.gender === g}
                onPress={() => patch({ gender: g })}
              />
            ))}
          </View>
          <Text style={styles.note}>Hiện trên hồ sơ người bán mà người mua xem được.</Text>

          <Field
            label="Số điện thoại"
            value={form.phone}
            onChangeText={(phone) => patch({ phone })}
            keyboardType="phone-pad"
          />

          <Pressable
            onPress={() => patch({ showPhone: !form.showPhone })}
            style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.75 }]}
          >
            <View style={[styles.box, form.showPhone && styles.boxOn]}>
              {form.showPhone && <Text style={styles.tick}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Cho người mua thấy số điện thoại</Text>
              {/* Nói rõ hai giới hạn thật, thay vì để người dùng tự phát hiện sau. */}
              <Text style={styles.note}>
                Tắt thì người mua chỉ liên hệ qua chat trong app. Chỉ áp dụng cho tin đăng
                <Text style={styles.strong}> mới</Text> — tin đã đăng giữ nguyên số cũ.
              </Text>
            </View>
          </Pressable>

          <Text style={styles.label}>Khu vực của bạn</Text>
          <Text style={styles.note}>
            Chỉ mình bạn thấy. Dùng để điền sẵn khu vực khi đăng tin, đỡ phải chọn lại mỗi lần.
          </Text>
          <View style={{ marginTop: 12 }}>
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
            <AddressField
              value={form.address ?? ''}
              onChange={(address) => patch({ address })}
            />
          </View>

          <PinButton
            label="Lưu thay đổi"
            loading={update.isPending}
            onPress={() =>
              update.mutate(form, {
                onSuccess: () => toast('✓ Đã lưu thay đổi!'),
                onError: (e: Error) => toast(`⚠️ ${e.message}`),
              })
            }
          />
        </ScrollView>
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

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, on && { color: C.paperWarm }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
    marginBottom: 8,
  },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, lineHeight: 17 },
  strong: { fontFamily: F.uiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.moss, borderColor: C.moss },
  chipText: { fontFamily: F.ui, fontSize: 12.5, color: C.ink },
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 13,
    marginTop: 4,
    marginBottom: 22,
  },
  box: {
    width: 21,
    height: 21,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.lineInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: C.moss, borderColor: C.moss },
  tick: { fontSize: 12, color: C.paperWarm, fontFamily: F.uiBold },
  toggleLabel: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 4 },
});
