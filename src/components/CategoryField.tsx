import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CategoryPicker } from './CategoryPicker';
import { useCategories } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

/**
 * Ô danh mục của form đăng tin — thực chất hai thứ: MỘT dòng hiện danh mục đã chọn, và cái cửa
 * mở màn chọn danh mục (`CategoryPicker`, chiếm trọn màn hình).
 *
 * Không còn nút "Chọn danh mục" ở trạng thái chưa chọn: với `autoOpen`, màn chọn đã phủ kín ngay
 * lúc mount, nên cái nút đó là một affordance không ai kịp nhìn thấy. Hệ quả là chưa chọn thì ô
 * này KHÔNG vẽ gì cả — và thoát màn chọn không còn đường quay lại.
 *
 * Vì thế thoát mà chưa chọn ở luồng ĐĂNG MỚI thì rời luôn việc đăng. Component dùng chung vẫn
 * không phải đoán mình được mount từ đâu: chính `autoOpen` nói ra điều đó — nó mang nghĩa "ô này
 * là cửa vào của luồng đăng tin", không phải "mở giúp tôi một popup".
 *
 * Form SỬA truyền `autoOpen={false}`: danh mục đã có, chặn ngang bằng một màn không ai yêu cầu
 * là phiền, và thoát ra ở đó chỉ là đóng màn chọn chứ không rời việc sửa.
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
  const router = useRouter();
  const { data: categories } = useCategories();
  const [open, setOpen] = useState(Boolean(autoOpen));

  const picked = categories?.find((c) => c.id === value);

  const dismiss = () => {
    setOpen(false);
    // Điều kiện là `value` chứ không phải một cờ riêng: vào lại màn chọn bằng "Đổi" thì đã có
    // danh mục, lúc đó thoát chỉ là đóng màn chọn.
    if (!autoOpen || value) return;
    // `canGoBack` vì `/post` mở được bằng deep link — lúc đó không có gì phía sau để lùi về.
    // Cùng lối rơi với `ScreenHeader`.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  };

  return (
    <>
      <CategoryPicker
        visible={open}
        categories={categories ?? []}
        value={value || null}
        loading={categories === undefined}
        onSelect={(id) => {
          onChange(id);
          setOpen(false);
        }}
        onDismiss={dismiss}
      />

      {!!value && (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Danh mục</Text>
            <Text style={styles.rowValue}>
              {picked ? `${picked.icon || ''} ${picked.name}`.trim() : '—'}
            </Text>
          </View>
          <Text style={styles.change}>Đổi ›</Text>
        </Pressable>
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
});
