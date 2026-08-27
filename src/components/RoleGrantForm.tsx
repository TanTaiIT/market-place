import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AdminChip, AdminPickerField, adminFormStyles } from './AdminPicker';
import { RoleGrantGeoFields } from './RoleGrantGeoFields';
import { Field, PinButton } from './ui';
import { useToast } from './Toast';
import { useMyOrgs, useOrgRoster, useOrgUnits } from '@/queries/org';
import { useAdminUsers } from '@/queries/admin-people';
import { isMaster } from '@/api/admin';
import type { ProvinceName } from '@/api/location';
import {
  ROLE_LABEL,
  SCOPE_LABEL,
  rolesGrantableBy,
  scopesForRole,
  type NewGrantInput,
  type RoleGrant,
} from '@/api/org-admin';
import { useOrgSlug } from '@/stores/auth';

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
  userEmail: '',
  role: 'staff' as NewGrantInput['role'],
  scopeType: 'org' as NewGrantInput['scopeType'],
  unitId: null as string | null,
  categoryId: null as string | null,
  provinceCodes: [] as ProvinceName[],
  wardCodes: [] as string[],
};

export function RoleGrantForm({
  grants,
  busy,
  onSubmit,
}: {
  /**
   * Grant của CHÍNH người đang cấp — quyết định cấp được vai trò nào, trong phạm vi nào. Cờ
   * `master` không đủ: manager trục (danh mục × tỉnh) cấp được staff trong đúng ô của họ, mà
   * ô đó chỉ đọc ra được từ grant.
   */
  grants: RoleGrant[] | undefined;
  busy: boolean;
  onSubmit: (values: NewGrantInput, reset: () => void) => void;
}) {
  const toast = useToast();
  const orgSlug = useOrgSlug();
  const [form, setForm] = useState(EMPTY);
  const master = isMaster(grants);

  /*
   * NGUỒN NGƯỜI NHẬN QUYỀN phụ thuộc người đang CẤP, không phụ thuộc tổ chức đang chọn.
   *
   * `GET /memberships` đòi `requireOrg` VÀ `requireMembership` — mà master cố ý không là
   * thành viên tổ chức nào, nên với họ danh bạ luôn 403 dù đã chọn tổ chức. Trước bản sửa
   * này, ô "Cấp cho ai" của master vĩnh viễn hiện "Danh bạ đang trống" và không có gì nói
   * ra vì sao.
   *
   * Master cũng là người duy nhất cần nguồn RỘNG hơn danh bạ: grant `category_province`
   * cấp cho người phụ trách danh mục, mà người đó thường chẳng thuộc tổ chức nào cả.
   * `GET /users` là route master-only nên chỉ họ gọi được — đúng thứ họ cần.
   */
  const roster = useOrgRoster();
  const allUsers = useAdminUsers({}, master);
  const people = master
    ? (allUsers.data ?? []).map((u) => ({ key: u.id, label: u.name, note: u.email }))
    : roster.members.map((m) => ({
        key: m.userId,
        label: m.name,
        // Tên nhóm con tra từ `units`: danh bạ chỉ mang `unitId`, và nhóm là thứ đổi tên
        // được — nhắc lại tên đã lưu ở chỗ khác là hai bản dễ lệch nhau.
        note: units?.find((u) => u.id === m.unitId)?.name,
      }));
  const peopleLoading = master ? allUsers.isLoading : roster.isLoading;
  const { data: units } = useOrgUnits();
  const { data: orgs, isPending: orgsPending } = useMyOrgs();

  const patch = (fields: Partial<typeof EMPTY>) => setForm((prev) => ({ ...prev, ...fields }));
  const roles = rolesGrantableBy(grants);
  const scopes = scopesForRole(form.role, grants);
  // Grants tới sau lần render đầu, nên phạm vi đang giữ trong state có thể không còn hợp lệ —
  // chốt về phạm vi hợp lệ đầu tiên thay vì gửi đi tổ hợp BE chắc chắn từ chối.
  const scope = scopes.includes(form.scopeType) ? form.scopeType : scopes[0];

  /** Tổ chức đang hoạt động — `null` khi người dùng không là thành viên tổ chức nào. */
  const orgId = orgs?.find((o) => o.slug === orgSlug)?.id ?? null;
  /**
   * Không master và không thuộc tổ chức nào → không có danh bạ nào để chọn, chuyển sang nhập
   * email. Chờ `useMyOrgs` xong mới quyết: `orgs` chưa về cũng là mảng rỗng, đoán sớm sẽ nhá ô
   * email cho người thật ra có danh bạ.
   */
  const byEmail = !master && !orgsPending && (orgs ?? []).length === 0;

  const submit = () => {
    if (byEmail) {
      // Chỉ chặn ca rõ ràng là chưa điền — "email này có tài khoản không" là câu của BE, dựng
      // luật email riêng ở client chỉ tạo thêm một định nghĩa "email hợp lệ" để lệch nhau.
      if (!form.userEmail.includes('@')) return toast('⚠️ Nhập email người nhận quyền');
    } else if (!form.userId) {
      return toast('⚠️ Chọn người sẽ nhận quyền');
    }
    // Master KHÔNG tự thành thành viên tổ chức mình tạo (xem `org-admin.ts`), nên `orgId` rỗng là
    // ca thường gặp chứ không phải hiếm — thiếu guard là gửi một grant phạm vi `org` không có org
    // và ăn 400, đúng thứ hai scope dưới đã chặn.
    if (scope === 'org' && !orgId) {
      return toast('⚠️ Bạn không thuộc tổ chức nào — chọn phạm vi khác');
    }
    if (scope === 'org_unit' && !form.unitId) return toast('⚠️ Chọn nhóm con áp quyền');
    if (scope === 'category_province') {
      if (!form.categoryId) return toast('⚠️ Chọn danh mục cho trục này');
      if (form.provinceCodes.length === 0) return toast('⚠️ Chọn ít nhất một tỉnh');
    }
    if (scope === 'category_ward') {
      if (!form.categoryId) return toast('⚠️ Chọn danh mục cho trục này');
      if (form.provinceCodes.length !== 1) return toast('⚠️ Chọn đúng một tỉnh cho phạm vi phường');
      if (form.wardCodes.length === 0) return toast('⚠️ Chọn ít nhất một phường/xã');
    }

    onSubmit(
      {
        userId: byEmail ? null : form.userId,
        userEmail: byEmail ? form.userEmail.trim() : null,
        role: form.role,
        scopeType: scope,
        orgId,
        unitId: form.unitId,
        categoryId: form.categoryId,
        provinceCodes: form.provinceCodes,
        wardCodes: form.wardCodes,
      },
      () => setForm(EMPTY),
    );
  };

  return (
    <>
      {/*
        Không thuộc tổ chức nào thì KHÔNG có danh bạ nào để chọn: `GET /memberships` đòi
        `requireMembership`, nên với manager trục (danh mục × tỉnh) ô chọn người vĩnh viễn rỗng.
        BE nhận `userEmail` đúng cho ca này — email là thứ họ biết về người mình định giao việc.
      */}
      {byEmail ? (
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
            Người nhận phải có tài khoản sẵn — BE tra theo email, chưa có thì trả lỗi.
          </Text>
        </>
      ) : (
        <AdminPickerField
          label="Cấp cho ai"
          title={master ? 'Chọn người dùng' : 'Chọn thành viên'}
          // Ô rỗng phải nói ĐÚNG vì sao rỗng: "danh bạ trống" là một câu trả lời sai với
          // master chưa chọn tổ chức, và sai luôn với người chưa tải xong.
          placeholder={emptyReason(master, people.length, orgSlug, peopleLoading)}
          items={people}
          loading={peopleLoading}
          value={form.userId}
          onChange={(userId) => patch({ userId })}
        />
      )}

      <Text style={adminFormStyles.label}>VAI TRÒ</Text>
      <View style={adminFormStyles.chips}>
        {roles.map((r) => (
          <AdminChip
            key={r}
            label={ROLE_LABEL[r]}
            on={form.role === r}
            // Đổi vai trò kéo theo phạm vi mặc định của chính nó, không giữ phạm vi của vai trò cũ.
            onPress={() =>
              patch({ role: r, scopeType: scopesForRole(r, grants)[0], unitId: null })
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
              on={scope === s}
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

      {scope === 'org_unit' && (
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

      {(scope === 'category_province' || scope === 'category_ward') && (
        <RoleGrantGeoFields scope={scope} value={form} onChange={patch} />
      )}

      <View style={{ marginTop: 16 }}>
        <PinButton label="Cấp quyền" loading={busy} onPress={submit} />
      </View>
    </>
  );
}

/**
 * Câu hiện trong ô "Cấp cho ai" khi chưa chọn ai.
 *
 * Bốn tình huống rỗng nhìn giống hệt nhau trên giao diện nhưng cần bốn hành động khác nhau —
 * gộp chung một câu là để người dùng ngồi đoán xem mình phải làm gì.
 */
function emptyReason(
  master: boolean,
  count: number,
  orgSlug: string | undefined,
  loading: boolean,
): string {
  if (count > 0) return master ? 'Chọn người dùng' : 'Chọn từ danh bạ';
  if (loading) return 'Đang tải…';
  if (master) return 'Chưa có người dùng nào trong hệ thống';
  if (!orgSlug) return 'Chọn tổ chức trước để thấy danh bạ';
  return 'Danh bạ tổ chức này đang trống';
}
