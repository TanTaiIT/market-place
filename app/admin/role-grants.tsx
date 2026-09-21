import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { adminFormStyles } from '@/components/AdminPicker';
import { CategoryAxisPanel } from '@/components/CategoryAxisPanel';
import { RoleGrantForm } from '@/components/RoleGrantForm';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMyGrants } from '@/queries/admin';
import { useGrantRole, useRevokeGrant } from '@/queries/org-admin';
import { ROLE_LABEL, SCOPE_LABEL, type RoleGrant } from '@/api/org-admin';
import { isMaster } from '@/api/admin';
import { C, F } from '@/theme';

/**
 * Phân quyền: ai được cầm quyền gì, trong phạm vi nào.
 *
 * Danh sách đầu là quyền CỦA CHÍNH MÌNH (`/role-grants/mine`). Dưới nó, chỉ master thấy, là
 * bảng "ai phụ trách danh mục nào" — trước đây không tồn tại, và sự vắng mặt của nó khiến việc
 * cấp quyền thành đường một chiều: `DELETE /role-grants/:id` vẫn cho master thu hồi quyền của
 * bất kỳ ai, nhưng không có route nào trả về `id` của người khác để mà gọi.
 */
export default function AdminRoleGrants() {
  const toast = useToast();
  const { data, error, isLoading } = useMyGrants();
  // Chỉ master cấp được quyền — hệ thống không còn cấp phó. Người khác mở màn này (qua link cũ)
  // chỉ để xem và thu hồi quyền của chính mình.
  const master = isMaster(data);
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

  // `org="optional"`: màn này không cần tổ chức — phạm vi cấp ở đây là ô trục công khai, còn
  // quản trị NHÓM thì master đặt ở màn Tổ chức.
  return (
    <AdminScreen title="Phân quyền" note="ai cầm chìa khoá nào" org="optional">
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
            Đây là quyền của riêng bạn. Quyền TRỤC DANH MỤC của mọi người nằm ở bảng ngay dưới;
            quản trị NHÓM thì xem ở màn Tổ chức › ngăn chi tiết.
          </Text>
        </AdminPanel>

        {/* Bảng danh tính của cả hệ thống — route master-only, nên chỉ dựng cho master. */}
        {master && (
          <View style={{ marginTop: 18 }}>
            <CategoryAxisPanel />
          </View>
        )}

        {!isLoading && !error && (
          <View style={{ marginTop: 18 }}>
            {master ? (
              <AdminPanel title="Cấp quyền" note="không ai tự cấp cho chính mình">
                <RoleGrantForm
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
            ) : (
              <AdminPanel title="Cấp quyền" note="ngoài phạm vi của bạn">
                <Text style={adminFormStyles.limit}>
                  Chỉ master cấp được quyền. Hệ thống không còn cấp phó — quản trị nhóm không cấp
                  được cho ai.
                </Text>
              </AdminPanel>
            )}
          </View>
        )}
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
