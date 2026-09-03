import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { CategoryIconPicker } from '@/components/CategoryIconPicker';
import { EmptyState, Field, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAddCategory, useAdminCategories, useEditCategory } from '@/queries/admin-content';
import type { AdminCategory } from '@/api/admin-content';
import { C, F, shadow } from '@/theme';

/**
 * Danh mục = mẩu băng dính phân loại trên bảng tin của học sinh.
 *
 * Từ điển dùng chung TOÀN HỆ THỐNG, không thuộc tổ chức nào — nên màn này không có bộ lọc trường
 * như các mục khác của bàn quản trị, và chỉ master sửa được (`AdminNav` đã chặn ở cửa).
 *
 * Không có nút xoá: BE cố ý không mở endpoint đó vì tin đã đăng vẫn trỏ tới danh mục. Gỡ khỏi
 * lưu thông bằng `isActive: false` — danh mục tắt vẫn nằm trong danh sách, mờ đi, bật lại được.
 *
 * Một panel lo cả thêm lẫn sửa: Android không có `prompt()`, mà dựng thêm modal cho ba ô nhập
 * thì thừa. Bấm "Sửa" nạp danh mục cũ vào form và đổi nút thành "Lưu thay đổi".
 */
export default function AdminCategories() {
  const toast = useToast();
  const { data, error, isLoading } = useAdminCategories();
  const add = useAddCategory();
  const edit = useEditCategory();

  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [order, setOrder] = useState('');

  const rows = data ?? [];
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const reset = () => {
    setEditing(null);
    setName('');
    setIcon('');
    setOrder('');
  };

  const submit = () => {
    if (!name.trim()) return toast('⚠️ Nhập tên danh mục trước đã');
    if (!icon) return toast('⚠️ Chọn một biểu tượng cho danh mục');

    const done = (msg: string) => ({
      onSuccess: () => {
        reset();
        toast(msg);
      },
      onError: fail,
    });

    if (editing) {
      return edit.mutate(
        { id: editing.id, name, icon, order },
        done(`✓ Đã cập nhật "${name.trim()}"`),
      );
    }
    add.mutate({ name, icon, order }, done(`✓ Đã thêm danh mục "${name.trim()}"`));
  };

  const toggleActive = (cat: AdminCategory) =>
    edit.mutate(
      { id: cat.id, isActive: !cat.isActive },
      {
        onSuccess: (c) =>
          toast(c.isActive ? `✓ Đã bật lại "${c.name}"` : `✓ Đã tắt "${c.name}"`),
        onError: fail,
      },
    );

  return (
    <AdminScreen title="Danh mục" note="băng dính phân loại">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState icon="▩" onDark text="Chưa có danh mục nào" />
        ) : (
          <View style={styles.grid}>
            {rows.map((cat, i) => (
              <View key={cat.id} style={[styles.card, !cat.isActive && { opacity: 0.55 }]}>
                <View style={styles.cardTop}>
                  <View
                    style={[styles.chip, { transform: [{ rotate: i % 2 ? '1.3deg' : '-1.4deg' }] }]}
                  >
                    <Text style={styles.chipText}>
                      {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  /{cat.slug} · THỨ TỰ {cat.order} · {cat.isActive ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                </Text>
                <View style={styles.cardActs}>
                  <AdminSmallBtn
                    label="Sửa"
                    onPress={() => {
                      setEditing(cat);
                      setName(cat.name);
                      setIcon(cat.icon);
                      setOrder(String(cat.order));
                    }}
                  />
                  <AdminSmallBtn
                    label={cat.isActive ? 'Tắt' : 'Bật lại'}
                    onPress={() => toggleActive(cat)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={adminFormStyles.limit}>
          Danh mục đã tắt không hiện trên bảng tin nhưng tin cũ vẫn trỏ tới nó — vì thế BE không
          có đường xoá hẳn.
        </Text>

        <View style={{ marginTop: 18 }}>
          <AdminPanel
            title={editing ? `Sửa "${editing.name}"` : 'Thêm danh mục'}
            note={editing ? 'slug giữ nguyên, chỉ tên đổi' : 'slug do hệ thống tự đặt từ tên'}
          >
            <Field
              onDark
              label="Tên danh mục"
              value={name}
              onChangeText={setName}
              placeholder="Ví dụ: Dụng cụ thể thao"
            />
            <CategoryIconPicker value={icon} onChange={setIcon} />
            <Field
              onDark
              label="Thứ tự hiển thị"
              value={order}
              onChangeText={setOrder}
              placeholder="Số càng nhỏ càng đứng trước"
              keyboardType="number-pad"
            />

            <View style={adminFormStyles.formActs}>
              <PinButton
                label={editing ? 'Lưu thay đổi' : 'Thêm danh mục'}
                loading={add.isPending || edit.isPending}
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
  meta: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim },
  cardActs: { flexDirection: 'row', gap: 7, marginTop: 11 },
});
