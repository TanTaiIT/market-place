import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PickerSheet, type PickerSearch } from './PickerSheet';
import { useCategories } from '@/queries/listings';
import { useProvinces } from '@/queries/location';
import { filterProvinces, type ProvinceName } from '@/api/location';
import { C, F } from '@/theme';

/**
 * Chọn ô đích (danh mục × tỉnh) để chuyển một tin sang hàng đợi khác.
 *
 * Bỏ trống một trong hai ô là CỐ Ý: tin sai tỉnh nhưng đúng danh mục thì chỉ đổi tỉnh, và
 * BE cũng nhận từng field một. Ép chọn cả hai sẽ khiến master phải gõ lại đúng cái đang đúng
 * — mỗi lần gõ lại là một lần chọn nhầm.
 *
 * Không gọi mutation ở đây: component chỉ trả ô đã chọn về cho màn hình (HARD#5 — mutation
 * chỉ chạy trong `app/**`).
 */
export function RerouteSheet({
  title,
  onSubmit,
  onClose,
  pending,
}: {
  /** Tiêu đề tin đang chuyển. `null` = đóng ngăn. */
  title: string | null;
  onSubmit: (target: { categoryId?: string; provinceCode?: ProvinceName }) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [province, setProvince] = useState<ProvinceName | null>(null);
  const [open, setOpen] = useState<'category' | 'province' | null>(null);

  const { data: categories, isPending: catLoading } = useCategories();
  const { data: provinces, isPending: provLoading } = useProvinces();

  const searchCategory = useCallback<PickerSearch<string>>(
    (keyword) =>
      (categories ?? [])
        .filter((c) => c.name.toLowerCase().includes(keyword.trim().toLowerCase()))
        .map((c) => ({ key: c.id, label: c.name })),
    [categories],
  );

  const searchProvince = useCallback<PickerSearch<ProvinceName>>(
    (keyword) =>
      filterProvinces(provinces ?? [], keyword).map((p) => ({ key: p.name, label: p.name })),
    [provinces],
  );

  const close = () => {
    setCategoryId(null);
    setProvince(null);
    setOpen(null);
    onClose();
  };

  const categoryName = categories?.find((c) => c.id === categoryId)?.name ?? null;

  return (
    <Modal visible={title !== null} transparent animationType="fade" onRequestClose={close}>
      {/* Scrim là anh em của thẻ chứ không bọc nó — chạm vào thẻ mà lọt xuống scrim thì mỗi
          lần bấm chọn danh mục là một lần ngăn tự đóng (cùng cách `PickerSheet` dựng). */}
      <Pressable style={styles.scrim} onPress={close} />

      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.heading}>Chuyển sang ô khác</Text>
          <Text numberOfLines={2} style={styles.subject}>
            {title}
          </Text>

          <Row
            label="Danh mục"
            value={categoryName}
            hint="giữ nguyên"
            onPress={() => setOpen('category')}
          />
          <Row
            label="Tỉnh / Thành"
            value={province}
            hint="giữ nguyên"
            onPress={() => setOpen('province')}
          />

          <Text style={styles.note}>
            Tin sẽ quay về đầu hàng đợi của ô mới và bạn không còn thấy nó ở đây nữa.
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={close} hitSlop={6}>
              <Text style={styles.cancel}>Huỷ</Text>
            </Pressable>
            <Pressable
              disabled={pending || (!categoryId && !province)}
              onPress={() =>
                onSubmit({
                  categoryId: categoryId ?? undefined,
                  provinceCode: province ?? undefined,
                })
              }
              style={({ pressed }) => [
                styles.submit,
                (pending || (!categoryId && !province)) && styles.submitOff,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.submitText}>{pending ? 'Đang chuyển...' : 'Chuyển'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <PickerSheet
        visible={open === 'category'}
        title="Chọn danh mục"
        placeholder="Gõ tên danh mục..."
        search={searchCategory}
        loading={catLoading}
        value={categoryId}
        emptyAll="Giữ nguyên danh mục"
        onSelect={(v) => setCategoryId(v)}
        onClose={() => setOpen(null)}
      />

      <PickerSheet
        visible={open === 'province'}
        title="Chọn tỉnh / thành"
        placeholder="Gõ tên tỉnh, kể cả tên cũ..."
        search={searchProvince}
        loading={provLoading}
        value={province}
        emptyAll="Giữ nguyên tỉnh"
        onSelect={(v) => setProvince(v)}
        onClose={() => setOpen(null)}
      />
    </Modal>
  );
}

function Row({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: string | null;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, !value && styles.rowHint]}>{value ?? hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  heading: { fontFamily: F.uiBold, fontSize: 15, color: C.paper },
  subject: { fontFamily: F.ui, fontSize: 12, color: C.deskTxtSoft, lineHeight: 17 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.deskRaise,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowLabel: { fontFamily: F.ui, fontSize: 12, color: C.deskTxtDim },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxt },
  rowHint: { fontFamily: F.ui, color: C.deskTxtDim },
  note: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  cancel: { fontFamily: F.ui, fontSize: 13, color: C.deskTxtDim },
  submit: { backgroundColor: C.tape, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  submitOff: { opacity: 0.4 },
  submitText: { fontFamily: F.uiBold, fontSize: 13, color: C.tapeInk },
});
