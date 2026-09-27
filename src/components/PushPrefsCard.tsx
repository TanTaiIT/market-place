import React from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { PinButton } from './ui';
import { PUSH_CATEGORY_LABEL } from '@/api/push';
import type { PushCategory, PushPermission, PushPrefs, PushPrefsPatch } from '@/api/push';
import { C, F } from '@/theme';

/** Thứ tự hiển thị: việc của CHÍNH mình trước, chuyện của nhóm sau. */
const ORDER: PushCategory[] = [
  'chat',
  'listing_status',
  'account',
  'membership',
  'report',
  'wallet',
  'support',
  'group_notice',
  'group_activity',
];

/**
 * Khối "Thông báo" trên màn Cài đặt. Thuần trình bày — mutation ở lại route.
 *
 * Hai tầng công tắc tách bạch: QUYỀN của hệ điều hành (máy này có được hiện thông báo không) và
 * CÔNG TẮC ở server (tài khoản muốn nhận loại nào). Tắt quyền thì mọi công tắc vô nghĩa, nên khi
 * chưa có quyền thẻ chỉ hiện đường bật quyền.
 */
export function PushPrefsCard({
  permission,
  prefs,
  enabling,
  testing,
  onEnable,
  onChange,
  onTest,
}: {
  /** `undefined` = đang đọc quyền của máy. */
  permission: { status: PushPermission; canAskAgain: boolean } | undefined;
  prefs: PushPrefs | undefined;
  enabling: boolean;
  testing: boolean;
  onEnable: () => void;
  onChange: (patch: PushPrefsPatch) => void;
  onTest: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>THÔNG BÁO</Text>

      {permission?.status !== 'granted' ? (
        <>
          <Text style={styles.note}>
            Nhận thông báo khi có tin nhắn mới, khi tin được duyệt, kể cả lúc không mở app.
          </Text>
          {permission?.canAskAgain !== false ? (
            <PinButton label="Bật thông báo" loading={enabling} onPress={onEnable} />
          ) : (
            // Đã từ chối hẳn: app không được hỏi lại nữa, chỉ Cài đặt hệ thống mở lại được.
            <Pressable onPress={() => void Linking.openSettings()} style={styles.link}>
              <Text style={styles.linkText}>Mở Cài đặt để cho phép thông báo →</Text>
            </Pressable>
          )}
        </>
      ) : !prefs ? null : (
        <>
          <Row
            title="Nhận thông báo"
            hint="Tắt để tạm im mọi loại (trừ thông báo về tài khoản)"
            value={prefs.enabled}
            onChange={(enabled) => onChange({ enabled })}
          />
          {ORDER.map((c) => {
            const locked = prefs.locked.includes(c as (typeof prefs.locked)[number]);
            return (
              <Row
                key={c}
                title={PUSH_CATEGORY_LABEL[c].title}
                hint={PUSH_CATEGORY_LABEL[c].hint}
                value={locked || (prefs.enabled && prefs.categories[c])}
                disabled={locked || !prefs.enabled}
                onChange={(on) => onChange({ categories: { [c]: on } })}
              />
            );
          })}
          <Pressable onPress={onTest} disabled={testing} style={styles.link}>
            <Text style={styles.linkText}>{testing ? 'Đang gửi…' : 'Gửi thử một thông báo'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function Row({
  title,
  hint,
  value,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.55 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.note}>{hint}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: C.moss, false: C.lineInput }}
        thumbColor={C.paperWarm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 28, gap: 6 },
  label: { fontFamily: F.uiBold, fontSize: 11, letterSpacing: 1.2, color: C.inkSoft },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowTitle: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 2 },
  link: { paddingVertical: 10 },
  linkText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.moss },
});
