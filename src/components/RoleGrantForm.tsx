import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminChip, AdminPickerField, adminFormStyles } from './AdminPicker';
import { PinButton } from './ui';
import { useToast } from './Toast';
import type { PickerSearch } from './PickerSheet';
import { useMyOrgs, useOrgRoster, useOrgUnits } from '@/queries/org';
import { useCategories } from '@/queries/listings';
import { useProvinces } from '@/queries/location';
import { filterProvinces, type ProvinceName } from '@/api/location';
import {
  ROLE_LABEL,
  SCOPE_LABEL,
  rolesGrantableBy,
  scopesForRole,
  type NewGrantInput,
} from '@/api/org-admin';
import { useOrgSlug } from '@/stores/auth';
import { C, F } from '@/theme';

/**
 * Form cấp quyền cho một thành viên.
 *
 * Người nhận chọn từ DANH BẠ dựng bằng đơn đã duyệt, không phải ô gõ id: `userId` là ObjectId
 * 24 hex, bắt người ta dán tay vào là mời gõ nhầm một quyền quản trị sang người khác.
 *
 * Đổi vai trò thì reset phạm vi: mỗi vai trò có tập phạm vi riêng, giữ lại lựa chọn cũ sẽ để
 * form ở một tổ hợp không tồn tại mà nhìn vẫn như hợp lệ.
 */

const EMPTY = {
  userId: null as string | null,
  role: 'staff' as NewGrantInput['role'],
  scopeType: 'org' as NewGrantInput['scopeType'],
  unitId: null as string | null,
  categoryId: null as string | null,
  provinceCodes: [] as ProvinceName[],
};

export function RoleGrantForm({
  master,
  busy,
  onSubmit,
}: {
  /** Người đang dùng có phải master không — quyết định cấp được vai trò và phạm vi nào. */
  master: boolean;
  busy: boolean;
  onSubmit: (values: NewGrantInput, reset: () => void) => void;
}) {
  const toast = useToast();
  const orgSlug = useOrgSlug();
  const [form, setForm] = useState(EMPTY);

  const roster = useOrgRoster();
  const { data: units } = useOrgUnits();
  const { data: orgs } = useMyOrgs();
  const { data: categories } = useCategories();
  const { data: provinces, isPending: provincesPending } = useProvinces();

  const patch = (fields: Partial<typeof EMPTY>) => setForm((prev) => ({ ...prev, ...fields }));
  const roles = rolesGrantableBy(master);
  const scopes = scopesForRole(form.role, master);

  const searchProvince = useCallback<PickerSearch<ProvinceName>>(
    (keyword) =>
      filterProvinces(provinces ?? [], keyword)
        // Tỉnh đã chọn rồi thì bỏ khỏi danh sách: chọn lại chỉ tạo bản trùng trong `provinceCodes`.
        .filter((p) => !form.provinceCodes.includes(p.name))
        .map((p) => ({ key: p.name, label: p.name })),
    [provinces, form.provinceCodes],
  );

  /** Tổ chức đang hoạt động — `null` khi người dùng không là thành viên tổ chức nào. */
  const orgId = orgs?.find((o) => o.slug === orgSlug)?.id ?? null;

  const submit = () => {
    if (!form.userId) return toast('⚠️ Chọn người sẽ nhận quyền');
    // Master KHÔNG tự thành thành viên tổ chức mình tạo (xem `org-admin.ts`), nên `orgId` rỗng là
    // ca thường gặp chứ không phải hiếm — thiếu guard là gửi một grant phạm vi `org` không có org
    // và ăn 400, đúng thứ hai scope dưới đã chặn.
    if (form.scopeType === 'org' && !orgId) {
      return toast('⚠️ Bạn không thuộc tổ chức nào — chọn phạm vi khác');
    }
    if (form.scopeType === 'org_unit' && !form.unitId) return toast('⚠️ Chọn nhóm con áp quyền');
    if (form.scopeType === 'category_province') {
      if (!form.categoryId) return toast('⚠️ Chọn danh mục cho trục này');
      if (form.provinceCodes.length === 0) return toast('⚠️ Chọn ít nhất một tỉnh');
    }

    onSubmit(
      {
        userId: form.userId,
        role: form.role,
        scopeType: form.scopeType,
        orgId,
        unitId: form.unitId,
        categoryId: form.categoryId,
        provinceCodes: form.provinceCodes,
      },
      () => setForm(EMPTY),
    );
  };

  return (
    <>
      <AdminPickerField
        label="Cấp cho ai"
        title="Chọn thành viên"
        placeholder={roster.members.length ? 'Chọn từ danh bạ' : 'Danh bạ đang trống'}
        items={roster.members.map((m) => ({
          key: m.userId,
          label: m.name,
          // Tên nhóm con tra từ `units`: danh bạ chỉ mang `unitId`, và nhóm là thứ đổi tên
          // được — nhắc lại tên đã lưu ở chỗ khác là hai bản dễ lệch nhau.
          note: units?.find((u) => u.id === m.unitId)?.name,
        }))}
        loading={roster.isLoading}
        value={form.userId}
        onChange={(userId) => patch({ userId })}
      />

      <Text style={adminFormStyles.label}>VAI TRÒ</Text>
      <View style={adminFormStyles.chips}>
        {roles.map((r) => (
          <AdminChip
            key={r}
            label={ROLE_LABEL[r]}
            on={form.role === r}
            // Đổi vai trò kéo theo phạm vi mặc định của chính nó, không giữ phạm vi của vai trò cũ.
            onPress={() =>
              patch({ role: r, scopeType: scopesForRole(r, master)[0], unitId: null })
            }
          />
        ))}
      </View>

      <View style={{ marginTop: 18 }}>
        <Text style={adminFormStyles.label}>PHẠM VI</Text>
        <View style={adminFormStyles.chips}>
          {scopes.map((s) => (
            <AdminChip
              key={s}
              label={SCOPE_LABEL[s]}
              on={form.scopeType === s}
              onPress={() => patch({ scopeType: s })}
            />
          ))}
        </View>
      </View>

      {form.scopeType === 'org_unit' && (
        <View style={{ marginTop: 18 }}>
          <AdminPickerField
            label="Nhóm con"
            title="Chọn nhóm con"
            placeholder="Chưa chọn nhóm"
            items={(units ?? []).map((u) => ({ key: u.id, label: u.name }))}
            value={form.unitId}
            onChange={(unitId) => patch({ unitId })}
          />
        </View>
      )}

      {form.scopeType === 'category_province' && (
        <View style={{ marginTop: 18 }}>
          <AdminPickerField
            label="Danh mục"
            title="Chọn danh mục"
            placeholder="Chưa chọn danh mục"
            items={(categories ?? []).map((c) => ({ key: c.id, label: c.name }))}
            value={form.categoryId}
            onChange={(categoryId) => patch({ categoryId })}
          />

          <Text style={adminFormStyles.label}>TỈNH PHỤ TRÁCH</Text>
          <View style={adminFormStyles.chips}>
            {form.provinceCodes.map((p) => (
              <Pressable
                key={p}
                onPress={() =>
                  patch({ provinceCodes: form.provinceCodes.filter((x) => x !== p) })
                }
                style={({ pressed }) => [styles.province, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.provinceText}>{p} ✕</Text>
              </Pressable>
            ))}
          </View>
          <AdminPickerField
            label=""
            title="Thêm tỉnh phụ trách"
            placeholder="Thêm tỉnh..."
            search={searchProvince}
            loading={provincesPending}
            value={null}
            onChange={(p) => p && patch({ provinceCodes: [...form.provinceCodes, p] })}
          />
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <PinButton label="Cấp quyền" loading={busy} onPress={submit} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  province: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.deskHi,
    borderWidth: 1,
    borderColor: C.cork,
  },
  provinceText: { fontFamily: F.uiSemi, fontSize: 12, color: C.paper },
});
