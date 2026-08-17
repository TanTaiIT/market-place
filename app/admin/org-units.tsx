import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminPickerField, AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { EmptyState, Field, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useCreateOrgUnit,
  useDeleteOrgUnit,
  useOrgRoster,
  useOrgUnits,
  useUpdateOrgUnit,
} from '@/queries/org';
import type { OrgUnit } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Nhóm con của tổ chức — khoá, lớp, phòng ban. Tổ chức phẳng thì danh sách rỗng, đó là trạng
 * thái hợp lệ chứ không phải lỗi.
 *
 * Một panel lo cả thêm lẫn sửa, giống màn Danh mục: bấm "Sửa" nạp nhóm cũ vào form và đổi nút
 * thành "Lưu thay đổi". Android không có `prompt()`, mà dựng thêm một modal cho hai ô nhập là thừa.
 */
export default function AdminOrgUnits() {
  const toast = useToast();
  const { data, error, isLoading } = useOrgUnits();
  const roster = useOrgRoster();
  const create = useCreateOrgUnit();
  const update = useUpdateOrgUnit();
  const remove = useDeleteOrgUnit();

  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [name, setName] = useState('');
  const [moderatorId, setModeratorId] = useState<string | null>(null);
  const [parentUnitId, setParentUnitId] = useState<string | null>(null);

  const units = data ?? [];

  /**
   * Người phụ trách KHÔNG nằm trong danh bạ (vào tổ chức bằng đường khác) vẫn phải hiện là CÓ
   * người — trả về "chưa có" ở ca đó là mời người khác gán đè lên một nhóm đã có chủ.
   */
  const moderatorLabel = (id: string | null) => {
    if (!id) return 'chưa có người phụ trách';
    return roster.members.find((m) => m.userId === id)?.claimedName ?? 'đã có người phụ trách';
  };

  const reset = () => {
    setEditing(null);
    setName('');
    setModeratorId(null);
    setParentUnitId(null);
  };

  const fail = (e: Error) => toast(`⚠️ ${e.message}`);
  const done = (msg: string) => ({
    onSuccess: () => {
      reset();
      toast(msg);
    },
    onError: fail,
  });

  const submit = () => {
    if (!name.trim()) return toast('⚠️ Nhập tên nhóm trước đã');
    if (editing) {
      // Gửi `moderatorId` kể cả khi `null`: ở `PATCH` thì `null` mang nghĩa GỠ người phụ trách,
      // còn vắng field mới là "không đụng tới" — bỏ trống ô là ý muốn gỡ, phải nói ra đúng vậy.
      return update.mutate(
        { id: editing.id, name: name.trim(), moderatorId, parentUnitId },
        done(`✓ Đã cập nhật nhóm "${name.trim()}"`),
      );
    }
    create.mutate(
      {
        name: name.trim(),
        ...(moderatorId ? { moderatorId } : {}),
        ...(parentUnitId ? { parentUnitId } : {}),
      },
      done(`✓ Đã tạo nhóm "${name.trim()}"`),
    );
  };

  return (
    <AdminScreen title="Nhóm con" note="khoá, lớp, phòng ban">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : units.length === 0 ? (
          <EmptyState icon="🗂" onDark text="Tổ chức đang phẳng — chưa có nhóm con nào" />
        ) : (
          <View style={{ gap: 10 }}>
            {units.map((unit) => (
              <View key={unit.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{unit.name}</Text>
                  <Text style={styles.meta}>
                    {units.find((u) => u.id === unit.parentUnitId)?.name ?? 'Thuộc thẳng tổ chức'}
                    {' · '}
                    {moderatorLabel(unit.moderatorId)}
                  </Text>
                </View>
                <View style={styles.acts}>
                  <AdminSmallBtn
                    label="Sửa"
                    onPress={() => {
                      setEditing(unit);
                      setName(unit.name);
                      setModeratorId(unit.moderatorId);
                      setParentUnitId(unit.parentUnitId);
                    }}
                  />
                  <AdminSmallBtn
                    label="Xoá"
                    onPress={() =>
                      remove.mutate(unit.id, {
                        // Xoá mềm: thành viên đang thuộc nhóm không mất chỗ, họ về mức tổ chức.
                        onSuccess: () => toast(`🗑 Đã xoá nhóm "${unit.name}"`),
                        onError: fail,
                      })
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <AdminPanel
            title={editing ? `Sửa nhóm "${editing.name}"` : 'Thêm nhóm con'}
            note={editing ? 'bỏ trống người phụ trách = gỡ họ ra' : 'để trống cấp cha = nằm thẳng dưới tổ chức'}
          >
            <Field
              onDark
              label="Tên nhóm"
              value={name}
              onChangeText={setName}
              placeholder="Ví dụ: Khối 12"
            />

            <AdminPickerField
              label="Người phụ trách"
              title="Chọn người phụ trách"
              placeholder={roster.members.length ? 'Chưa chọn' : 'Danh bạ đang trống'}
              items={roster.members.map((m) => ({ key: m.userId, label: m.claimedName }))}
              loading={roster.isLoading}
              value={moderatorId}
              emptyLabel="Không có người phụ trách"
              onChange={setModeratorId}
            />

            <AdminPickerField
              label="Nằm trong nhóm"
              title="Chọn nhóm cấp trên"
              placeholder="Thuộc thẳng tổ chức"
              // Bỏ chính nó khỏi danh sách cấp cha: một nhóm làm cha của chính mình là một vòng
              // trong cây, và cây đó là thứ BE dùng để tính ai duyệt được của ai.
              items={units
                .filter((u) => u.id !== editing?.id)
                .map((u) => ({ key: u.id, label: u.name }))}
              value={parentUnitId}
              emptyLabel="Thuộc thẳng tổ chức"
              onChange={setParentUnitId}
            />

            <View style={adminFormStyles.formActs}>
              <PinButton
                label={editing ? 'Lưu thay đổi' : 'Thêm nhóm'}
                loading={create.isPending || update.isPending}
                style={{ flex: 1 }}
                onPress={submit}
              />
              {!!editing && (
                <Pressable
                  onPress={reset}
                  style={({ pressed }) => [adminFormStyles.cancel, pressed && { opacity: 0.7 }]}
                >
                  <Text style={adminFormStyles.smallText}>Huỷ</Text>
                </Pressable>
              )}
            </View>
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
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 14,
  },
  name: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  meta: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 3 },
  acts: { flexDirection: 'row', gap: 7 },
});
