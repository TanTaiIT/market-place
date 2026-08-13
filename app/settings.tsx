import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Field, Loading, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useProfile, useUpdateProfile } from '@/queries/listings';
import { C } from '@/theme';

export default function Settings() {
  const toast = useToast();
  const { data: profile, error, isLoading } = useProfile();
  const update = useUpdateProfile();

  // Chỉ hai field này: `PATCH /users/me` của BE chỉ nhận `name` + `phone`, còn tổ chức thì
  // không thuộc hồ sơ user. Cho sửa `org` ở đây là hứa suông — lưu xong nó lại rỗng.
  const [form, setForm] = useState({ name: '', phone: '' });

  useEffect(() => {
    if (profile) setForm({ name: profile.name, phone: profile.phone });
  }, [profile]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return <Loading />;
  if (error || !profile) {
    return <EmptyState icon="📡" text={(error as Error | null)?.message ?? 'Không tải được hồ sơ'} />;
  }

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
          <Field label="Họ và tên" value={form.name} onChangeText={set('name')} />
          <Field
            label="Số điện thoại"
            value={form.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
          />
          <View style={{ marginTop: 8 }}>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
});
