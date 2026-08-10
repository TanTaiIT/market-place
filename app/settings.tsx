import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, Loading, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useProfile, useUpdateProfile } from '@/queries/listings';
import { C } from '@/theme';

export default function Settings() {
  const toast = useToast();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  const [form, setForm] = useState({ name: '', phone: '', org: '' });

  useEffect(() => {
    if (profile) setForm({ name: profile.name, phone: profile.phone, org: profile.org });
  }, [profile]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return <Loading />;

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
          <Field label="Trường / tổ chức" value={form.org} onChangeText={set('org')} />
          <View style={{ marginTop: 8 }}>
            <PinButton
              label="Lưu thay đổi"
              loading={update.isPending}
              onPress={() =>
                update.mutate(form, {
                  onSuccess: () => toast('✓ Đã lưu thay đổi!'),
                  onError: () => toast('⚠️ Không lưu được, thử lại nhé'),
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
