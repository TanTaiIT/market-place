import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PickerSheet, type PickerSearch } from './PickerSheet';
import { useCategories } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

/**
 * Chọn danh mục cho tin đăng — qua popup, không phải hàng chip trải sẵn trên form.
 *
 * Hai hình dạng, cùng một component:
 * - **Chưa chọn**: lời mời + một nút mở popup. Phần còn lại của form chưa hiện, vì danh mục
 *   quyết định bộ field của nó (template).
 * - **Đã chọn**: đúng MỘT dòng "Danh mục · <tên> · Đổi". Trải lại cả danh sách ở đây là bắt
 *   người dùng đọc hai lần một thứ họ vừa chốt.
 *
 * `autoOpen` bật popup ngay lúc mount — dùng cho form ĐĂNG MỚI, nơi câu hỏi đầu tiên đúng là
 * "đăng tin gì". Form SỬA truyền `false`: danh mục đã có, chặn ngang bằng một popup không ai
 * yêu cầu là phiền.
 *
 * Đóng popup mà chưa chọn thì KHÔNG điều hướng đi đâu cả. Component dùng chung mà tự gọi
 * `router.back()` là buộc nó phải biết mình đang được mount từ màn nào.
 */
export function CategoryField({
  value,
  onChange,
  autoOpen,
}: {
  value: string;
  onChange: (categoryId: string) => void;
  autoOpen?: boolean;
}) {
  const { data: categories } = useCategories();
  const [open, setOpen] = useState(Boolean(autoOpen));

  const search = useCallback<PickerSearch<string>>(
    (keyword) =>
      (categories ?? [])
        .filter((c) => c.name.toLowerCase().includes(keyword.trim().toLowerCase()))
        .map((c) => ({ key: c.id, label: c.icon ? `${c.icon} ${c.name}` : c.name })),
    [categories],
  );

  const name = categories?.find((c) => c.id === value)?.name;

  return (
    <>
      <PickerSheet
        visible={open}
        title="Đăng tin gì?"
        placeholder="Tìm danh mục..."
        search={search}
        loading={categories === undefined}
        value={value || null}
        onSelect={(id) => id && onChange(id)}
        onClose={() => setOpen(false)}
      />

      {value ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Danh mục</Text>
            <Text style={styles.rowValue}>{name ?? '—'}</Text>
          </View>
          <Text style={styles.change}>Đổi ›</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.hint}>
            Chọn danh mục trước — mỗi loại món đồ hỏi những thông tin khác nhau.
          </Text>
          <Pressable
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pickBtnText}>Chọn danh mục</Text>
          </Pressable>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
    ...shadow,
  },
  rowLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.inkSoft },
  rowValue: { fontFamily: F.uiBold, fontSize: 14, color: C.ink, marginTop: 3 },
  change: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.pin },
  hint: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft, lineHeight: 20, marginTop: 4 },
  pickBtn: {
    alignSelf: 'flex-start',
    backgroundColor: C.pin,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 14,
  },
  pickBtnText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paperWarm },
});
