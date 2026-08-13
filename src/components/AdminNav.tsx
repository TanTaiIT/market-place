import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminListings, useAdminReports } from '@/queries/admin';
import { useProfile } from '@/queries/listings';
import { Avatar } from './ui';
import { C, F, shadow } from '@/theme';

/**
 * Rail điều hướng của prototype, dựng lại thành ngăn kéo. Bản web có 236px cố định bên trái;
 * trên điện thoại đó là gần một nửa màn, nên nó chỉ hiện khi bấm ☰ — vẫn đủ chín mục, vẫn
 * nhóm y hệt, để quản trị quen bản web không phải học lại chỗ nào nằm đâu.
 *
 * Con số bên phải hai mục đầu đọc từ chính query mà màn tương ứng dùng, nên mở ngăn kéo không
 * tốn thêm lượt gọi nào (cache đã có sẵn) mà số vẫn khớp với thứ người dùng sắp thấy.
 */

type NavItem = { href: string; icon: string; label: string; badge?: 'queue' | 'reports' };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Hằng ngày',
    items: [
      { href: '/admin', icon: '▦', label: 'Tổng quan' },
      { href: '/admin/moderation', icon: '📌', label: 'Duyệt tin', badge: 'queue' },
      { href: '/admin/reports', icon: '⚑', label: 'Báo cáo', badge: 'reports' },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      { href: '/admin/listings', icon: '▤', label: 'Tin đăng' },
      { href: '/admin/categories', icon: '▩', label: 'Danh mục' },
      { href: '/admin/notice', icon: '◈', label: 'Gửi thông báo' },
    ],
  },
  {
    label: 'Cộng đồng',
    items: [
      { href: '/admin/users', icon: '◍', label: 'Người dùng' },
      { href: '/admin/schools', icon: '⌂', label: 'Trường & hệ thống' },
    ],
  },
  { label: 'Khác', items: [{ href: '/admin/settings', icon: '⚙', label: 'Cài đặt' }] },
];

export function AdminNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: queue } = useAdminListings('pending');
  const { data: reports } = useAdminReports();
  const { data: profile } = useProfile();

  const counts = { queue: queue?.length ?? 0, reports: reports?.length ?? 0 };

  const go = (href: string) => {
    onClose();
    // `replace` chứ không `push`: ngăn kéo là điều hướng ngang hàng, `push` sẽ chồng lên nhau
    // và nút back phải bấm mười lần mới thoát nổi bàn quản trị.
    if (href !== pathname) router.replace(href);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
        <View style={styles.brand}>
          <View style={styles.brandPin} />
          <View>
            <Text style={styles.brandName}>
              Gh<Text style={{ color: C.pin }}>i</Text>m
            </Text>
            <Text style={styles.brandSub}>BÀN QUẢN TRỊ</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {GROUPS.map((group) => (
            <View key={group.label}>
              <Text style={styles.group}>{group.label.toUpperCase()}</Text>
              {group.items.map((item) => {
                const on = item.href === pathname;
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <Pressable
                    key={item.href}
                    onPress={() => go(item.href)}
                    style={({ pressed }) => [
                      styles.item,
                      on && styles.itemOn,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {on && <View style={styles.itemPin} />}
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <Text style={[styles.itemLabel, on && { color: C.paper }]}>{item.label}</Text>
                    {!!count && (
                      <View style={[styles.count, item.badge === 'queue' && styles.countHot]}>
                        <Text
                          style={[
                            styles.countText,
                            item.badge === 'queue' && { color: C.paperWarm },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={() => {
            onClose();
            router.replace('/(tabs)/profile');
          }}
          style={({ pressed }) => [styles.foot, pressed && { opacity: 0.7 }]}
        >
          <Avatar text={profile?.avatar ?? '·'} size={32} color={C.mossDeep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.meName}>
              {profile?.name ?? 'Quản trị'}
            </Text>
            <Text style={styles.meRole}>{(profile?.role ?? '').toUpperCase()}</Text>
          </View>
          <Text style={styles.exit}>Thoát ›</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: C.scrim },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 268,
    backgroundColor: C.deskPanel,
    borderRightWidth: 1,
    borderRightColor: C.deskLineStrong,
    ...shadow,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  brandPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.pin,
    borderTopWidth: 5,
    borderTopColor: C.pinLight,
  },
  brandName: { fontFamily: F.hand, fontSize: 25, color: C.paper, lineHeight: 28 },
  brandSub: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.6, color: C.deskTxtDim },

  list: { paddingHorizontal: 10, paddingVertical: 10 },
  group: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: C.deskTxtDim,
    paddingHorizontal: 11,
    paddingTop: 14,
    paddingBottom: 7,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 6,
  },
  itemOn: { backgroundColor: C.deskHi },
  itemPin: {
    position: 'absolute',
    left: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.pin,
  },
  itemIcon: { width: 18, textAlign: 'center', fontSize: 13, color: C.deskTxtSoft },
  itemLabel: { flex: 1, fontFamily: F.uiSemi, fontSize: 13.5, color: C.deskTxtSoft },
  count: {
    minWidth: 22,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: C.deskHi,
  },
  countHot: { backgroundColor: C.pin },
  countText: { fontFamily: F.monoBold, fontSize: 10.5, color: C.deskTxtSoft },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.deskLine,
  },
  meName: { fontFamily: F.uiBold, fontSize: 12.5, color: C.deskTxt },
  meRole: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.6, color: C.deskTxtDim, marginTop: 1 },
  exit: { fontFamily: F.uiSemi, fontSize: 11.5, color: C.cork },
});
