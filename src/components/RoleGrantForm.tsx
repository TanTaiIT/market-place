import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminChip, adminFormStyles } from './AdminPicker';
import { RoleGrantGeoFields, type GeoScope } from './RoleGrantGeoFields';
import { Field, PinButton } from './ui';
import { useToast } from './Toast';
import type { ProvinceName } from '@/api/location';
import { SCOPE_LABEL, type NewGrantInput } from '@/api/org-admin';

/**
 * Form cấp quyền — CHỈ master dùng, và chỉ cấp được một thứ: **Quản lý** một ô trục công khai
 * (danh mục × tỉnh, hoặc danh mục × phường).
 *
 * Hệ thống không còn cấp phó: quản trị nhóm không cấp được quyền cho ai, vai trò `staff` đã bỏ.
 * Nên form không còn chip vai trò, không còn danh bạ thành viên, không còn nhánh "manager trục
 * cấp trong ô của mình". Quản trị NHÓM (phạm vi `org`) không đặt ở đây mà ở màn Tổ chức — đó là
 * nơi master nhìn thấy nhóm rồi chỉ định người phụ trách.
 *
 * Người nhận trỏ bằng EMAIL: người phụ trách danh mục thường chẳng thuộc tổ chức nào nên không
 * có danh bạ để chọn, còn danh sách người dùng toàn hệ thống giờ phân trang 10 dòng — một ô
 * chọn chỉ thấy trang đầu là mời bấm sai người. BE tra email và trả 404 nếu chưa có tài khoản.
 */

const SCOPES: GeoScope[] = ['category_province', 'category_ward'];

const EMPTY = {
  userEmail: '',
  scopeType: 'category_province' as GeoScope,
  categoryId: null as string | null,
  provinceCodes: [] as ProvinceName[],
  wardCodes: [] as string[],
};

export function RoleGrantForm({
  busy,
  initial,
  submitLabel = 'Cấp quyền',
  onSubmit,
}: {
  busy: boolean;
  /**
   * Có `initial` = chế độ SỬA: ô email biến mất vì đổi người không phải là sửa phạm vi — đó
   * là một grant khác, và nó đi qua cấp/thu hồi để hai chốt `canGrant` với `usableOrgAdmins`
   * còn chạy. Mọi phần còn lại dùng chung, kể cả luật hợp lệ — tách hai form là tách hai bộ
   * luật rồi để chúng lệch nhau.
   */
  initial?: Omit<typeof EMPTY, 'userEmail'>;
  submitLabel?: string;
  onSubmit: (values: NewGrantInput, reset: () => void) => void;
}) {
  const toast = useToast();
  const editing = initial !== undefined;
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial } : EMPTY);
  const patch = (fields: Partial<typeof EMPTY>) => setForm((prev) => ({ ...prev, ...fields }));

  const submit = () => {
    // Chỉ chặn ca rõ ràng là chưa điền — "email này có tài khoản không" là câu của BE, dựng
    // luật email riêng ở client chỉ tạo thêm một định nghĩa "email hợp lệ" để lệch nhau.
    if (!editing && !form.userEmail.includes('@')) return toast('⚠️ Nhập email người nhận quyền');
    if (!form.categoryId) return toast('⚠️ Chọn danh mục cho trục này');
    if (form.scopeType === 'category_province' && form.provinceCodes.length === 0) {
      return toast('⚠️ Chọn ít nhất một tỉnh');
    }
    if (form.scopeType === 'category_ward') {
      if (form.provinceCodes.length !== 1) return toast('⚠️ Chọn đúng một tỉnh cho phạm vi phường');
      if (form.wardCodes.length === 0) return toast('⚠️ Chọn ít nhất một phường/xã');
    }

    onSubmit(
      {
        userId: null,
        userEmail: form.userEmail.trim(),
        role: 'manager',
        scopeType: form.scopeType,
        orgId: null,
        categoryId: form.categoryId,
        provinceCodes: form.provinceCodes,
        wardCodes: form.wardCodes,
      },
      () => setForm(EMPTY),
    );
  };

  return (
    <>
      {editing ? null : (
        <>
          <Field
            onDark
            label="Cấp cho ai (email)"
            value={form.userEmail}
            onChangeText={(userEmail) => patch({ userEmail })}
            placeholder="email@vidu.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={adminFormStyles.hint}>
            Người nhận phải có tài khoản sẵn — BE tra theo email, chưa có thì trả lỗi. Vai trò
            luôn là Quản lý; quản trị nhóm đặt ở màn Tổ chức.
          </Text>
        </>
      )}

      <View style={{ marginTop: editing ? 0 : 18 }}>
        <Text style={adminFormStyles.label}>PHẠM VI</Text>
        <View style={adminFormStyles.chips}>
          {SCOPES.map((s) => (
            <AdminChip
              key={s}
              label={SCOPE_LABEL[s]}
              on={form.scopeType === s}
              onPress={() =>
                // Đổi phạm vi thì dọn lựa chọn của phạm vi cũ: phường chỉ có nghĩa ở
                // `category_ward`, và phạm vi đó chỉ mang đúng một tỉnh.
                patch({
                  scopeType: s,
                  provinceCodes:
                    s === 'category_ward' ? form.provinceCodes.slice(0, 1) : form.provinceCodes,
                  wardCodes: [],
                })
              }
            />
          ))}
        </View>
      </View>

      <RoleGrantGeoFields scope={form.scopeType} value={form} onChange={patch} />

      <View style={{ marginTop: 16 }}>
        <PinButton label={submitLabel} loading={busy} onPress={submit} />
      </View>
    </>
  );
}
