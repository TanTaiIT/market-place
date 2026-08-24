import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminNav } from './AdminNav';
import { useToast } from './Toast';
import { PinButton } from './ui';
import { useOrgSlug } from '@/stores/auth';
import { C, F } from '@/theme';

/**
 * Khung chung của bàn quản trị: nền tối, thanh trên, và những khối lặp lại nhiều nhất (hàng
 * viên lọc, hộp panel, hàng cài đặt).
 *
 * Rail 236px của bản web thành ngăn kéo sau nút ☰ — mọi màn admin đều mount `AdminNav`, nên
 * đi tới bất kỳ mục nào cũng chỉ một chạm, không phải quay ngược về tổng quan.
 */

export function AdminScreen({
  title,
  note,
  org,
  children,
}: {
  title: string;
  /** Câu viết tay trên tiêu đề, giữ đúng giọng của prototype. */
  note: string;
  /**
   * Màn này đọc `X-Org-Slug` — khớp đúng cờ `org: true` của `AdminNav.GROUPS`.
   *
   * Bật thì khi chưa chọn tổ chức, màn hiện lối đi tiếp thay vì ruột của nó. Master cố ý không
   * thuộc tổ chức nào, nên đây là trạng thái BÌNH THƯỜNG của họ lúc mới vào, không phải lỗi:
   * trước đó mọi màn trong nhóm này ném nguyên văn câu của `requireOrg` — "gửi header
   * X-Org-Slug hoặc truy cập qua subdomain" — cho người vừa bấm một mục menu.
   */
  org?: boolean;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const router = useRouter();
  const orgSlug = useOrgSlug();
  const [navOpen, setNavOpen] = useState(false);
  const needsOrg = Boolean(org) && !orgSlug;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setNavOpen(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.iconGlyph}>☰</Text>
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.note}>{note}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>

        <Pressable
          onPress={() => toast('Không có cảnh báo mới')}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.iconGlyph}>🔔</Text>
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      {needsOrg ? <NoOrgPicked onPick={() => router.push('/admin/organizations')} /> : children}

      <AdminNav open={navOpen} onClose={() => setNavOpen(false)} />
    </SafeAreaView>
  );
}

/**
 * Màn org-scoped nhưng chưa có tổ chức nào được chọn.
 *
 * Nói bằng lời của người dùng và chỉ ra đúng một việc phải làm. Không gọi API nào — các hook
 * query đã tự tắt bằng `enabled` khi thiếu slug (`queries/admin.ts`), nên tới đây là im lặng
 * hoàn toàn chứ không phải hiện lối thoát trong lúc vẫn bắn request hỏng phía sau.
 */
function NoOrgPicked({ onPick }: { onPick: () => void }) {
  return (
    <View style={styles.noOrg}>
      <Text style={styles.noOrgIcon}>🏫</Text>
      <Text style={styles.noOrgTitle}>Chưa chọn tổ chức nào</Text>
      <Text style={styles.noOrgText}>
        Màn này hiện dữ liệu của một tổ chức cụ thể. Chọn tổ chức bạn muốn thao tác rồi quay lại.
      </Text>
      <PinButton label="Chọn tổ chức" onPress={onPick} style={{ marginTop: 18 }} />
    </View>
  );
}

/**
 * Một dòng cài đặt: tên + giải thích bên trái, điều khiển bên phải. `children` để trống thì
 * chỉ là dòng chữ — dùng cho những mục còn chờ BE.
 */
export function SettingRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.setRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.setTitle}>{title}</Text>
        <Text style={styles.setDesc}>{desc}</Text>
      </View>
      {children}
    </View>
  );
}

/** `Switch` gốc của RN, chỉ nhuộm lại theo token — không dựng lại công tắc bằng tay. */
export function AdminSwitch({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: C.deskHi, true: C.mossDeep }}
      thumbColor={value ? C.mossBright : C.deskTxtDim}
    />
  );
}

export function AdminPanel({
  title,
  note,
  flush,
  children,
}: {
  title: string;
  note?: string;
  /** Bỏ đệm trong: dùng khi ruột panel là chuỗi `SettingRow` vốn đã tự có đệm và vạch ngăn. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {!!note && <Text style={styles.panelNote}>{note}</Text>}
      </View>
      <View style={flush ? undefined : styles.panelBody}>{children}</View>
    </View>
  );
}

type FilterOption = { value: string; label: string; count?: number };

/** Một hàng viên lọc cuộn ngang — dùng cho cả bộ lọc trường, trạng thái lẫn danh mục. */
export function AdminFilter({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterBar}
      contentContainerStyle={styles.filterRow}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.pillText, on && styles.pillTextOn]}>{opt.label}</Text>
            {opt.count !== undefined && (
              <Text style={[styles.pillCount, on && styles.pillTextOn]}>{opt.count}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.desk },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 15, color: C.deskTxt },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.pin,
  },
  note: { fontFamily: F.hand, fontSize: 13.5, color: C.cork },
  title: { fontFamily: F.uiBlack, fontSize: 20, color: C.paper, marginTop: 1 },

  panel: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 14,
    // Vạch dưới của `SettingRow` cuối cùng trùng luôn viền panel — cùng màu nên nhìn ra một nét.
    overflow: 'hidden',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    // Ghi chú viết tay dài hơn chỗ còn lại thì XUỐNG DÒNG. Thiếu `flexWrap` thì nó tràn ra và
    // bị `overflow: hidden` của panel cắt cụt giữa chữ, không cả một dấu ba chấm.
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  panelTitle: { fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  panelNote: { fontFamily: F.hand, fontSize: 13, color: C.cork, flexShrink: 1 },
  panelBody: { padding: 16 },

  /*
   * `flexGrow/flexShrink: 0` KHÔNG thừa: React Native gán sẵn `flexGrow: 1, flexShrink: 1` cho
   * MỌI ScrollView (`ScrollView.js` → `baseHorizontal`). Hàng lọc này là con trực tiếp của cột
   * màn hình nên nó tranh chiều dọc với ScrollView nội dung ngay dưới: màn nào nội dung dài thì
   * nó bị BÓP lại — viên lọc mất nửa dưới của chữ; màn nào nội dung ngắn thì nó DÃN ra ăn hết
   * chỗ trống. Chốt về 0 để nó cao đúng bằng ruột của nó, không thương lượng với ai.
   */
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filterRow: { gap: 8, paddingHorizontal: 18, paddingBottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  pillOn: { backgroundColor: C.deskHi, borderColor: C.cork },
  // `lineHeight` cố định: hộp chữ của viên lọc cao đúng một mức biết trước, không co giãn
  // theo metric của font vừa nạp xong.
  pillText: { fontFamily: F.uiSemi, fontSize: 12.5, lineHeight: 18, color: C.deskTxtSoft },
  pillTextOn: { color: C.paper },
  pillCount: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  noOrg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  noOrgIcon: { fontSize: 34, marginBottom: 12 },
  noOrgTitle: { fontFamily: F.uiBold, fontSize: 16, color: C.paper, marginBottom: 8 },
  noOrgText: {
    fontFamily: F.ui,
    fontSize: 13,
    lineHeight: 20,
    color: C.deskTxtSoft,
    textAlign: 'center',
  },

  setTitle: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  setDesc: { fontFamily: F.ui, fontSize: 12, lineHeight: 18, color: C.deskTxtSoft, marginTop: 3 },
});
