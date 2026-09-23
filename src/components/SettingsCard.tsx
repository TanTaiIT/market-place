import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, R, S, T, shadow } from '@/theme';

/**
 * Khung một MỤC của màn Tài khoản: tiêu đề + nhãn quyền riêng tư + thẻ trắng chứa các ô.
 *
 * Tách khỏi `settings.tsx` vì route đó có trần 250 dòng và ba mục chiếm phần lớn phần vẽ.
 * Nhưng lý do thật để nó thành component chứ không phải mấy `<View>` rời là NHÃN: mỗi mục phải
 * nói ai nhìn thấy dữ liệu trong đó, và nếu nhãn là tuỳ chọn ở từng chỗ dựng thì mục thêm sau
 * sẽ quên mất nó — đúng cái thông tin người dùng cần nhất để quyết định có điền hay không.
 *
 * Thẻ KHÔNG có `paddingBottom`: mọi ô nhập (`Field`, `ProvinceField`, …) đã tự mang 18px dưới
 * chân, nên thêm đệm ở đây là cộng hai lần và đáy thẻ dày gấp đôi đỉnh.
 */

/** Ai đọc được dữ liệu trong mục này. Không có mặc định: mỗi mục phải tự khai. */
export type Visibility = 'public' | 'private';

const BADGE: Record<Visibility, string> = {
  public: '👁  Người mua thấy được',
  private: '🔒  Chỉ mình bạn thấy',
};

export function SettingsSection({
  title,
  visibility,
  badgeLabel,
  note,
  children,
}: {
  title: string;
  visibility: Visibility;
  /** Ghi đè chữ mặc định khi "công khai / riêng tư" chưa nói đủ (vd người dùng tự bật tắt). */
  badgeLabel?: string;
  note?: string;
  children: React.ReactNode;
}) {
  const isPublic = visibility === 'public';
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.badge, isPublic && styles.badgePublic]}>
          <Text style={[styles.badgeText, isPublic && styles.badgeTextPublic]}>
            {badgeLabel ?? BADGE[visibility]}
          </Text>
        </View>
      </View>
      {!!note && <Text style={styles.note}>{note}</Text>}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/**
 * Chọn MỘT trong vài lựa chọn ngắn, bày hết ra thay vì giấu trong sheet: bốn nút thì đọc xong
 * nhanh hơn một lần mở sheet, và người dùng thấy luôn mình đang ở lựa chọn nào.
 *
 * Quá ~5 lựa chọn, hoặc chữ dài, thì đây là sai công cụ — dùng `PickerSheet` như ô tỉnh/xã.
 */
export function SettingsChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { key: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.segment}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => [
              styles.seg,
              value === o.key && styles.segOn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.segText, value === o.key && styles.segTextOn]}>{o.text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: S.xl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginBottom: S.sm,
    flexWrap: 'wrap',
  },
  title: { fontFamily: F.uiBold, ...T.md, color: C.ink },

  badge: {
    borderRadius: R.pill,
    backgroundColor: C.chipIdle,
    paddingHorizontal: S.sm,
    paddingVertical: 3,
  },
  badgePublic: { backgroundColor: C.brandLt },
  badgeText: { fontFamily: F.ui, ...T.xs, color: C.inkSoft },
  badgeTextPublic: { color: C.brandTx },

  note: { fontFamily: F.ui, ...T.xs, color: C.inkSoft, marginBottom: S.sm },

  card: {
    backgroundColor: C.paperWarm,
    borderRadius: R.lg,
    paddingHorizontal: S.lg,
    paddingTop: S.lg,
    ...shadow,
  },

  // 18px = `styles.field` của `ui.tsx` và `LocationPicker`: khối tự dựng phải cùng nhịp với ô
  // nhập, nếu không thẻ nào có khối sẽ thở khác thẻ chỉ có ô.
  block: { marginBottom: 18 },
  blockLabel: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    letterSpacing: 0.5,
    color: C.inkSoft,
    marginBottom: 6,
  },

  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  seg: {
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.sm,
  },
  segOn: { backgroundColor: C.brandLt, borderColor: C.brandTx },
  segText: { fontFamily: F.ui, ...T.sm, color: C.inkSoft },
  segTextOn: { fontFamily: F.uiBold, color: C.brandTx },
});
