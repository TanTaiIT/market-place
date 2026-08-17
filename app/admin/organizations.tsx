import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { OrgCreateForm } from '@/components/OrgCreateForm';
import { SlugField } from '@/components/SlugField';
import { EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMyOrgs } from '@/queries/org';
import {
  useChangeOrganizationSlug,
  useCreateOrganization,
  useSetOrganizationStatus,
} from '@/queries/org-admin';
import type { MyOrg } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Bàn quản trị tổ chức (master).
 *
 * Danh sách lấy từ `/organizations/mine` vì đó là route DUY NHẤT trả về `organizationId` —
 * `/organizations/lookup` cố tình không trả id để không thành công cụ liệt kê khách hàng. Hệ quả
 * nói thẳng trong panel: khoá / đổi slug chỉ làm được với tổ chức mình đang là thành viên.
 *
 * Trạng thái (`active`/`suspended`) KHÔNG có trong `MyOrganization`, nên đây là hai HÀNH ĐỘNG
 * chứ không phải một công tắc: vẽ công tắc mặc định "đang mở" là bịa ra một trạng thái mà app
 * không hề biết, và người bấm sẽ tin vào nó.
 */
export default function AdminOrganizations() {
  const toast = useToast();
  const { data, error, isLoading } = useMyOrgs();
  const create = useCreateOrganization();
  const setStatus = useSetOrganizationStatus();
  const changeSlug = useChangeOrganizationSlug();

  /** Tổ chức đang đổi slug; `null` = panel dưới đang ở chế độ tạo mới. */
  const [editing, setEditing] = useState<MyOrg | null>(null);
  const [slug, setSlug] = useState('');

  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const toggleStatus = (org: MyOrg, next: 'active' | 'suspended') => {
    const run = () =>
      setStatus.mutate(
        { id: org.id, status: next },
        {
          // Trạng thái thật chỉ có trong response — nói lại đúng thứ BE vừa trả về, không đoán.
          onSuccess: (o) =>
            toast(o.status === 'suspended' ? `🔒 Đã khoá ${o.name}` : `🔓 Đã mở lại ${o.name}`),
          onError: fail,
        },
      );

    // Confirm gốc của hệ điều hành, chỉ cho đúng thao tác này: khoá tổ chức là cắt quyền truy
    // cập của TOÀN BỘ thành viên ngay lập tức, không phải một dòng dữ liệu gỡ nhầm rồi thêm lại.
    if (next === 'active') return run();
    Alert.alert('Khoá tổ chức?', `Mọi thành viên của ${org.name} mất quyền truy cập ngay.`, [
      { text: 'Thôi', style: 'cancel' },
      { text: 'Khoá', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <AdminScreen title="Tổ chức" note="ai đang mở, ai đang khoá">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon="🏫" onDark text="Bạn chưa là thành viên của tổ chức nào" />
        ) : (
          <View style={{ gap: 10 }}>
            {(data ?? []).map((org) => (
              <View key={org.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{org.name}</Text>
                  <Text style={styles.meta}>
                    /{org.slug} · {org.role.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.acts}>
                  <AdminSmallBtn
                    label="Đổi slug"
                    onPress={() => {
                      setEditing(org);
                      // Mở ra ô TRỐNG chứ không nạp slug hiện tại: nạp vào thì lượt kiểm tra đầu
                      // tiên báo "đã có tổ chức dùng slug này" — mà tổ chức đó chính là nó.
                      setSlug('');
                    }}
                  />
                  <AdminSmallBtn label="Khoá" onPress={() => toggleStatus(org, 'suspended')} />
                  <AdminSmallBtn label="Mở" onPress={() => toggleStatus(org, 'active')} />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={adminFormStyles.limit}>
          BE chưa có route liệt kê mọi tổ chức, cũng không trả trạng thái trong
          /organizations/mine — danh sách này chỉ gồm tổ chức bạn là thành viên, và hai nút
          Khoá / Mở là hành động chứ không phải công tắc phản ánh trạng thái hiện tại.
        </Text>

        <View style={{ marginTop: 18 }}>
          {editing ? (
            <AdminPanel
              title={`Đổi slug cho ${editing.name}`}
              note={`/${editing.slug} sẽ thành redirect 301`}
            >
              <SlugField value={slug} onChange={setSlug} />
              <View style={adminFormStyles.formActs}>
                <PinButton
                  label="Lưu slug mới"
                  loading={changeSlug.isPending}
                  style={{ flex: 1 }}
                  onPress={() =>
                    changeSlug.mutate(
                      { id: editing.id, slug: slug.trim() },
                      {
                        onSuccess: (o) => {
                          setEditing(null);
                          toast(`✓ ${o.name} giờ ở /${o.slug}`);
                        },
                        onError: fail,
                      },
                    )
                  }
                />
                <Pressable
                  onPress={() => setEditing(null)}
                  style={({ pressed }) => [adminFormStyles.cancel, pressed && { opacity: 0.7 }]}
                >
                  <Text style={adminFormStyles.smallText}>Huỷ</Text>
                </Pressable>
              </View>
            </AdminPanel>
          ) : (
            <AdminPanel title="Tạo tổ chức mới" note="người chủ phải có tài khoản trước">
              <OrgCreateForm
                busy={create.isPending}
                onSubmit={(values, reset) =>
                  create.mutate(values, {
                    onSuccess: (o) => {
                      reset();
                      // Nói trước điều người dùng sắp thắc mắc: master không tự thành thành viên
                      // nên tổ chức vừa tạo sẽ KHÔNG hiện trong danh sách phía trên.
                      toast(`✓ Đã tạo ${o.name} (/${o.slug}) — bạn không phải thành viên của nó`);
                    },
                    onError: fail,
                  })
                }
              />
            </AdminPanel>
          )}
        </View>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  row: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 14,
    gap: 11,
  },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  meta: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: 0.4, color: C.deskTxtDim, marginTop: 3 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
