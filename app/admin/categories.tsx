import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Field, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAddCategory,
  useAdminCategories,
  useRemoveCategory,
  useRenameCategory,
} from '@/queries/admin-content';
import { MAX_CATEGORIES } from '@/api/admin-content';
import { SCHOOLS } from '@/api/admin';
import { useAdminSchool, useSetAdminSchool } from '@/stores/admin';
import { C, F, shadow } from '@/theme';

const SCHOOL_OPTIONS = [
  { value: 'all', label: 'Tất cả trường' },
  ...SCHOOLS.map((s) => ({ value: s, label: s })),
];

const SCOPES = ['Cả hệ thống', ...SCHOOLS];

/**
 * Danh mục = mẩu băng dính phân loại trên bảng tin của học sinh.
 *
 * Một ô nhập lo cả thêm lẫn đổi tên: bấm "Đổi tên" nạp tên cũ vào ô và chuyển nút thành "Lưu
 * tên mới". Android không có `prompt()`, mà dựng thêm một hộp thoại nhập liệu nữa cho đúng một
 * trường chữ thì thừa.
 */
export default function AdminCategories() {
  const toast = useToast();
  const school = useAdminSchool();
  const setSchool = useSetAdminSchool();

  const { data, error, isLoading } = useAdminCategories(school);
  const add = useAddCategory();
  const rename = useRenameCategory();
  const remove = useRemoveCategory();

  const [name, setName] = useState('');
  const [scope, setScope] = useState(SCOPES[0]);
  /** Tên danh mục đang sửa, `null` = đang ở chế độ thêm mới. */
  const [editing, setEditing] = useState<string | null>(null);

  const busy = add.isPending || rename.isPending;
  const surface = (done: string) => ({
    onSuccess: () => {
      toast(done);
      setName('');
      setEditing(null);
    },
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  const submit = () =>
    editing
      ? rename.mutate({ from: editing, to: name }, surface(`Đã đổi tên thành "${name.trim()}"`))
      : add.mutate({ name, scope }, surface(`Đã thêm danh mục "${name.trim()}"`));

  return (
    <AdminScreen title="Danh mục" note="băng dính phân loại">
      <AdminFilter options={SCHOOL_OPTIONS} value={school} onChange={setSchool} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : (
          <View style={styles.grid}>
            {(data ?? []).map((cat, i) => (
              <View key={cat.name} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.chip, { transform: [{ rotate: i % 2 ? '1.3deg' : '-1.4deg' }] }]}>
                    <Text style={styles.chipText}>{cat.name}</Text>
                  </View>
                  <Text style={styles.count}>{cat.count}</Text>
                </View>
                <Text style={styles.meta}>
                  {cat.scope.toUpperCase()} · {cat.count} TIN ĐANG CÓ
                </Text>
                <View style={styles.cardActs}>
                  <Pressable
                    onPress={() => {
                      setEditing(cat.name);
                      setName(cat.name);
                    }}
                    style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.smallBtnText}>Đổi tên</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      remove.mutate(cat.name, {
                        onSuccess: () => toast(`Đã gỡ danh mục "${cat.name}"`),
                        onError: (e: Error) => toast(`⚠️ ${e.message}`),
                      })
                    }
                    style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.smallBtnText}>Gỡ bỏ</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <AdminPanel
            title={editing ? `Đổi tên "${editing}"` : 'Thêm danh mục'}
            note={editing ? 'tên cũ đang nằm trong ô' : `tối đa ${MAX_CATEGORIES} cái thôi`}
          >
            <Field
              onDark
              label="Tên danh mục"
              value={name}
              onChangeText={setName}
              placeholder="Ví dụ: Dụng cụ thể thao"
            />
            <Text style={styles.hint}>
              Tên sẽ hiện thành mẩu băng dính trên bảng tin của học sinh.
            </Text>

            {!editing && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.label}>MỞ CHO</Text>
                <View style={styles.scopes}>
                  {SCOPES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setScope(s)}
                      style={({ pressed }) => [
                        styles.scope,
                        s === scope && styles.scopeOn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.scopeText, s === scope && { color: C.paper }]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.formActs}>
              <PinButton
                label={editing ? 'Lưu tên mới' : 'Thêm danh mục'}
                loading={busy}
                onPress={submit}
                style={{ flex: 1 }}
              />
              {!!editing && (
                <Pressable
                  onPress={() => {
                    setEditing(null);
                    setName('');
                  }}
                  style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.smallBtnText}>Huỷ</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 14,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: C.tape,
    ...shadow,
  },
  chipText: { fontFamily: F.uiBold, fontSize: 12, color: C.tapeInk },
  count: { marginLeft: 'auto', fontFamily: F.monoBold, fontSize: 18, color: C.paper },
  meta: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim },
  cardActs: { flexDirection: 'row', gap: 7, marginTop: 11 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  smallBtnText: { fontFamily: F.uiBold, fontSize: 11.5, color: C.deskTxt },

  hint: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.deskTxtDim, marginTop: -8 },
  label: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: C.deskTxtDim,
    marginBottom: 8,
  },
  scopes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scope: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.desk,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  scopeOn: { backgroundColor: C.deskHi, borderColor: C.cork },
  scopeText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxtSoft },
  formActs: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18 },
  cancel: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
});
