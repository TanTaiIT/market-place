import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminNav } from './AdminNav';
import { useToast } from './Toast';
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
  children,
}: {
  title: string;
  /** Câu viết tay trên tiêu đề, giữ đúng giọng của prototype. */
  note: string;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const [navOpen, setNavOpen] = useState(false);

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

      {children}

      <AdminNav open={navOpen} onClose={() => setNavOpen(false)} />
    </SafeAreaView>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  panelTitle: { fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  panelNote: { fontFamily: F.hand, fontSize: 13, color: C.cork },
  panelBody: { padding: 16 },

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
  pillText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxtSoft },
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
  setTitle: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  setDesc: { fontFamily: F.ui, fontSize: 12, lineHeight: 18, color: C.deskTxtSoft, marginTop: 3 },
});
