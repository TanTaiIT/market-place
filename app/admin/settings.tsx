import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminPanel, AdminScreen, AdminSwitch, SettingRow } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAdminLimits,
  useAdminRules,
  useSetAdminLimits,
  useToggleRule,
} from '@/queries/admin-content';
import { EXPIRY_CHOICES } from '@/api/admin-content';
import { C, F } from '@/theme';

/**
 * Luật của bảng tin. Khác mọi màn admin còn lại ở chỗ đây không xử một tin nào cả — đổi một
 * công tắc ở đây là đổi cách hàng nghìn tin sau này được đối xử.
 */
export default function AdminSettings() {
  const toast = useToast();
  const { data: rules, error, isLoading } = useAdminRules();
  const { data: limits } = useAdminLimits();
  const toggle = useToggleRule();
  const save = useSetAdminLimits();

  /** `null` = chưa gõ gì, đang hiện giá trị của server. */
  const [draft, setDraft] = useState<string | null>(null);

  const surface = (done: string) => ({
    onSuccess: () => toast(done),
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  const commitMax = () => {
    if (draft === null || !limits) return;
    const next = Number(draft);
    setDraft(null);
    if (next === limits.maxPerUser) return;
    save.mutate({ ...limits, maxPerUser: next }, surface('Đã lưu cài đặt'));
  };

  return (
    <AdminScreen title="Cài đặt" note="luật của bảng tin">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : (
          <AdminPanel flush title="Quy tắc duyệt tin">
            {(rules ?? []).map((rule) => (
              <SettingRow key={rule.id} title={rule.title} desc={rule.desc}>
                <AdminSwitch
                  value={rule.on}
                  onChange={() => toggle.mutate(rule.id, surface('Đã lưu cài đặt'))}
                />
              </SettingRow>
            ))}
          </AdminPanel>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giới hạn đăng tin</Text>
          <View style={styles.sectionRule} />
        </View>

        <AdminPanel flush title="Áp dụng cho mọi người dùng">
          <SettingRow
            title="Số tin tối đa mỗi người"
            desc="Áp dụng cho tin đang hiển thị, không tính tin đã bán."
          >
            <TextInput
              value={draft ?? String(limits?.maxPerUser ?? '')}
              onChangeText={setDraft}
              onBlur={commitMax}
              onSubmitEditing={commitMax}
              keyboardType="number-pad"
              returnKeyType="done"
              style={styles.number}
            />
          </SettingRow>

          <SettingRow
            title="Tin tự hết hạn sau"
            desc="Hết hạn thì tin rơi khỏi bảng, người đăng có thể ghim lại bằng một chạm."
          >
            <View style={styles.choices}>
              {EXPIRY_CHOICES.map((days) => {
                const on = days === limits?.expiryDays;
                return (
                  <Pressable
                    key={days}
                    onPress={() =>
                      limits && save.mutate({ ...limits, expiryDays: days }, surface('Đã lưu cài đặt'))
                    }
                    style={({ pressed }) => [
                      styles.choice,
                      on && styles.choiceOn,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.choiceText, on && { color: C.paper }]}>{days}</Text>
                  </Pressable>
                );
              })}
              <Text style={styles.unit}>ngày</Text>
            </View>
          </SettingRow>
        </AdminPanel>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  section: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 26, marginBottom: 11 },
  sectionTitle: { fontFamily: F.uiBold, fontSize: 15, color: C.paper },
  sectionRule: { flex: 1, height: 1, backgroundColor: C.deskLine },

  number: {
    width: 76,
    textAlign: 'center',
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    backgroundColor: C.desk,
    fontFamily: F.monoBold,
    fontSize: 14,
    color: C.deskTxt,
  },
  choices: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  choice: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    backgroundColor: C.desk,
  },
  choiceOn: { backgroundColor: C.deskHi, borderColor: C.cork },
  choiceText: { fontFamily: F.monoBold, fontSize: 12.5, color: C.deskTxtSoft },
  unit: { fontFamily: F.ui, fontSize: 11.5, color: C.deskTxtDim },
});
