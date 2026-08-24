import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { adminFormStyles } from '@/components/AdminPicker';
import { RoleGrantForm } from '@/components/RoleGrantForm';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMyGrants } from '@/queries/admin';
import { useGrantRole, useRevokeGrant } from '@/queries/org-admin';
import { isMaster } from '@/api/admin';
import { ROLE_LABEL, SCOPE_LABEL, type RoleGrant } from '@/api/org-admin';
import { C, F } from '@/theme';

/**
 * Phân quyền: ai được cầm quyền gì, trong phạm vi nào.
 *
 * Danh sách phía trên là quyền CỦA CHÍNH MÌNH, không phải của cả tổ chức — `/role-grants/mine`
 * là route duy nhất trả về `id` của grant, mà thu hồi thì cần đúng cái id đó. Hệ quả nói thẳng
 * dưới danh sách: cấp quyền cho người khác xong thì trong app không rút lại được.
 */
export default function AdminRoleGrants() {
  const toast = useToast();
  const { data, error, isLoading } = useMyGrants();
  const grant = useGrantRole();
  const revoke = useRevokeGrant();

  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const confirmRevoke = (row: RoleGrant) =>
    // Confirm gốc hệ điều hành: thu hồi quyền của CHÍNH MÌNH có thể đóng luôn cửa bàn quản trị,
    // và không có nút nào trong app mở lại được — phải có người khác cấp lại.
    Alert.alert(
      'Thu hồi quyền này?',
      `${ROLE_LABEL[row.role]} · ${SCOPE_LABEL[row.scopeType]}. Bạn sẽ mất quyền ngay, và cần người khác cấp lại.`,
      [
        { text: 'Thôi', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: () =>
            revoke.mutate(row.id, {
              onSuccess: () => toast('✓ Đã thu hồi quyền'),
              onError: fail,
            }),
        },
      ],
    );

  return (
    <AdminScreen title="Phân quyền" note="ai cầm chìa khoá nào" org>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AdminPanel title="Quyền của tôi" note="chạm ✕ để thu hồi">
          {isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (data ?? []).length === 0 ? (
            <EmptyState icon="🔑" onDark text="Bạn chưa được cấp quyền nào" />
          ) : (
            <View style={{ gap: 10 }}>
              {(data ?? []).map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.role}>{ROLE_LABEL[row.role]}</Text>
                    <Text style={styles.meta}>
                      {SCOPE_LABEL[row.scopeType]}
                      {row.provinceCodes.length > 0 ? ` · ${row.provinceCodes.join(', ')}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => confirmRevoke(row)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.revoke, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.revokeGlyph}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={adminFormStyles.limit}>
            BE chỉ có route đọc quyền của chính mình, nên đây không phải danh sách quyền của cả
            tổ chức — quyền vừa cấp cho người khác sẽ không hiện ở đây và app không thu hồi được.
          </Text>
        </AdminPanel>

        <View style={{ marginTop: 18 }}>
          <AdminPanel title="Cấp quyền" note="không ai tự cấp cho chính mình">
            <RoleGrantForm
              master={isMaster(data)}
              busy={grant.isPending}
              onSubmit={(values, reset) =>
                grant.mutate(values, {
                  onSuccess: (g) => {
                    reset();
                    toast(`✓ Đã cấp ${ROLE_LABEL[g.role]} · ${SCOPE_LABEL[g.scopeType]}`);
                  },
                  onError: fail,
                })
              }
            />
          </AdminPanel>
        </View>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.desk,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 10,
    padding: 12,
  },
  role: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  meta: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 3 },
  revoke: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revokeGlyph: { fontSize: 12, color: C.pinLight },
});
