import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { AdminChip, AdminPickerField, adminFormStyles } from './AdminPicker';
import { SlugField } from './SlugField';
import { Field, PinButton } from './ui';
import { useToast } from './Toast';
import type { PickerSearch } from './PickerSheet';
import { useProvinces } from '@/queries/location';
import { filterProvinces, mergedFromLabel, type ProvinceName } from '@/api/location';
import { ORG_TYPES, type NewOrgInput, type OrgType } from '@/api/org-admin';

/**
 * Form tạo tổ chức mới (master).
 *
 * Giữ state + luật hợp lệ, KHÔNG gọi mutation — submit đi ngược lên route (AGENTS §Kiến trúc).
 *
 * Chỉ `name` và `ownerEmail` là bắt buộc, đúng như BE khai. Bỏ trống slug là cố ý cho phép:
 * BE tự sinh từ tên, và với tổ chức tạo hàng loạt thì tự nghĩ slug cho từng cái là việc thừa.
 */

const EMPTY: NewOrgInput = {
  name: '',
  slug: '',
  orgType: 'school',
  ownerEmail: '',
  provinceCode: null,
  district: '',
};

export function OrgCreateForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (values: NewOrgInput, reset: () => void) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<NewOrgInput>(EMPTY);
  const { data: provinces, isPending } = useProvinces();

  const patch = (fields: Partial<NewOrgInput>) => setForm((prev) => ({ ...prev, ...fields }));

  const searchProvince = useCallback<PickerSearch<ProvinceName>>(
    (keyword) =>
      filterProvinces(provinces ?? [], keyword).map((p) => ({
        key: p.name,
        label: p.name,
        note: mergedFromLabel(p),
      })),
    [provinces],
  );

  const submit = () => {
    if (!form.name.trim()) return toast('⚠️ Nhập tên tổ chức trước đã');
    // Chỉ chặn ca rõ ràng là chưa điền email — BE mới là nơi biết tài khoản đó có thật không, và
    // dựng một luật email riêng ở client chỉ tạo thêm một định nghĩa "email hợp lệ" để lệch nhau.
    if (!form.ownerEmail.includes('@')) return toast('⚠️ Nhập email của người chủ tổ chức');
    onSubmit(form, () => setForm(EMPTY));
  };

  return (
    <>
      <Field
        onDark
        label="Tên tổ chức"
        value={form.name}
        onChangeText={(name) => patch({ name })}
        placeholder="Ví dụ: THPT Hùng Vương"
      />

      <SlugField
        label="Slug (bỏ trống để hệ thống tự đặt)"
        value={form.slug}
        onChange={(slug) => patch({ slug })}
      />

      <View style={{ marginTop: 16 }}>
        <Text style={adminFormStyles.label}>LOẠI TỔ CHỨC</Text>
        <View style={adminFormStyles.chips}>
          {ORG_TYPES.map((t) => (
            <AdminChip
              key={t.value}
              label={t.label}
              on={form.orgType === t.value}
              onPress={() => patch({ orgType: t.value as OrgType })}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: 18 }}>
        <Field
          onDark
          label="Email người chủ"
          value={form.ownerEmail}
          onChangeText={(ownerEmail) => patch({ ownerEmail })}
          placeholder="nguoi.chu@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[adminFormStyles.hint, { marginTop: -8 }]}>
          Người chủ phải CÓ TÀI KHOẢN từ trước — đây không phải đường mời người mới vào hệ thống.
        </Text>
      </View>

      <View style={{ marginTop: 18 }}>
        <AdminPickerField
          label="Tỉnh / thành"
          title="Chọn tỉnh / thành"
          placeholder="Chưa chọn"
          search={searchProvince}
          loading={isPending}
          value={form.provinceCode}
          emptyLabel="Không gắn tỉnh nào"
          onChange={(provinceCode) => patch({ provinceCode })}
        />

        <Field
          onDark
          label="Quận / huyện cũ (tuỳ chọn)"
          value={form.district}
          onChangeText={(district) => patch({ district })}
          placeholder="Chỉ để phân biệt hai tổ chức trùng tên"
        />
      </View>

      <PinButton label="Tạo tổ chức" loading={busy} onPress={submit} />
    </>
  );
}
