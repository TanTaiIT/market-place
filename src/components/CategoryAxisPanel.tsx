import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminPanel } from './AdminScreen';
import { RoleGrantForm } from './RoleGrantForm';
import { EmptyState, Loading } from './ui';
import { useToast } from './Toast';
import {
  useCategoryAxisGrants,
  useRevokeGrant,
  useUpdateGrantScope,
} from '@/queries/org-admin';
import type { ProvinceName } from '@/api/location';
import { axisScopeLabel, ROLE_LABEL, type CategoryAxisGrant } from '@/api/org-admin';
import { C, F } from '@/theme';

/**
 * AI ĐANG PHỤ TRÁCH DANH MỤC NÀO — bảng của master.
 *
 * Trước đây không màn nào trả lời được câu này: ma trận phủ sóng chỉ nói ô CÓ hay KHÔNG có
 * người, còn danh sách ở màn Phân quyền chỉ là quyền của CHÍNH người đang xem. Hệ quả nặng hơn
 * là `DELETE /role-grants/:id` vốn đã cho master thu hồi quyền của bất kỳ ai, nhưng không có
 * đường nào lấy được `id` — nên cấp quyền trên thực tế là đường một chiều.
 *
 * Tài khoản đã khoá/không còn vẫn giữ grant (xoá tài khoản KHÔNG thu hồi quyền). Bảng phải
 * NÓI RA thay vì lọc đi: một ô do tài khoản chết phụ trách hiện ra "đã có người" ở mọi chỗ
 * khác, và đó đúng là ô master cần thấy nhất.
 */
export function CategoryAxisPanel() {
  const toast = useToast();
  const { data, error, isLoading } = useCategoryAxisGrants();
  const revoke = useRevokeGrant();
  const update = useUpdateGrantScope();
  /** Grant đang mở form sửa — `null` = đang xem danh sách. Một dòng một lúc. */
  const [editing, setEditing] = useState<string | null>(null);

  const confirmRevoke = (row: CategoryAxisGrant) =>
    Alert.alert(
      'Thu hồi quyền này?',
      `${row.holderName} sẽ mất quyền duyệt ${axisScopeLabel(row)} ngay lập tức. Ô đó quay về chưa có người phụ trách.`,
      [
        { text: 'Thôi', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: () =>
            revoke.mutate(row.id, {
              onSuccess: () => toast(`✓ Đã thu hồi quyền của ${row.holderName}`),
              onError: (e: Error) => toast(`⚠️ ${e.message}`),
            }),
        },
      ],
    );

  return (
    <AdminPanel title="Phụ trách danh mục" note="ai duyệt ô nào · chạm ✕ để thu hồi">
      {isLoading ? (
        <Loading onDark />
      ) : error ? (
        <EmptyState icon="📡" onDark text={(error as Error).message} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon="🗂" onDark text="Chưa ai được cấp quyền trục danh mục" />
      ) : (
        <View style={{ gap: 10 }}>
          {(data ?? []).map((row) => (
            <View key={row.id}>
            <View style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {row.holderName}
                  {row.holderActive ? '' : ' · đã khoá'}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {ROLE_LABEL[row.role]} · {axisScopeLabel(row)}
                </Text>
                {!!row.holderEmail && (
                  <Text numberOfLines={1} style={styles.email}>
                    {row.holderEmail}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setEditing(editing === row.id ? null : row.id)}
                hitSlop={8}
                style={({ pressed }) => [styles.edit, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.editGlyph}>{editing === row.id ? '▾' : '✎'}</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmRevoke(row)}
                hitSlop={8}
                style={({ pressed }) => [styles.revoke, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.revokeGlyph}>✕</Text>
              </Pressable>
            </View>

            {/*
              Form SỬA mở ngay dưới dòng, không phải một ngăn riêng: người dùng đang so sánh
              phạm vi cũ với phạm vi mới, và đẩy họ sang màn khác là cắt mất đúng phép so đó.
              Dùng lại `RoleGrantForm` — cùng ô chọn, cùng luật hợp lệ; hai form là hai bộ luật
              rồi để chúng lệch nhau.
            */}
            {editing === row.id && (
              <View style={styles.editor}>
                <RoleGrantForm
                  busy={update.isPending}
                  submitLabel="Lưu phạm vi"
                  initial={{
                    scopeType: row.scopeType === 'category_ward' ? 'category_ward' : 'category_province',
                    categoryId: row.categoryId,
                    provinceCodes: row.provinceCodes as ProvinceName[],
                    wardCodes: row.wardCodes,
                  }}
                  onSubmit={(values) =>
                    update.mutate(
                      {
                        id: row.id,
                        scopeType:
                          values.scopeType === 'category_ward' ? 'category_ward' : 'category_province',
                        categoryId: values.categoryId!,
                        provinceCodes: values.provinceCodes,
                        wardCodes: values.wardCodes,
                      },
                      {
                        onSuccess: () => {
                          setEditing(null);
                          toast('✓ Đã sửa phạm vi phụ trách');
                        },
                        onError: (e: Error) => toast(`⚠️ ${e.message}`),
                      },
                    )
                  }
                />
              </View>
            )}
            </View>
          ))}
        </View>
      )}
    </AdminPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editor: { marginTop: 2, marginBottom: 6, paddingLeft: 6 },
  edit: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  editGlyph: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxtSoft },
  name: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxt },
  meta: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtSoft, marginTop: 2 },
  email: { fontFamily: F.mono, fontSize: 10, color: C.deskTxtDim, marginTop: 1 },
  revoke: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  revokeGlyph: { fontFamily: F.uiBold, fontSize: 14, color: C.badText },
});
