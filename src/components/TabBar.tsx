import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRequireAuth } from './GuestGate';
import { useConversations } from '@/queries/chat';
import { C, F, R, shadowLift } from '@/theme';

/**
 * Thanh điều hướng nổi dạng viên thuốc — `.nav` của prototype.
 *
 * Khung ngoài VẪN chiếm chỗ trong layout như thanh cũ: navigator dựa vào chiều cao của nó để
 * chừa khoảng dưới cho từng màn. Làm nó `position: absolute` cho "nổi" thật thì mọi danh sách
 * phải tự cộng thêm padding đáy, và màn nào quên là nội dung chui xuống dưới thanh.
 *
 * Tab hiện tại vẫn là bốn màn cũ (Khám phá · Tin nhắn · Thông báo · Cá nhân). Bản mẫu thay
 * Thông báo bằng "Đã lưu" — đó là đổi CẤU TRÚC điều hướng chứ không phải đổi giao diện, nên
 * để riêng một quyết định, không lẫn vào đợt đổi da này.
 */
const META: Record<string, { icon: string; label: string }> = {
  feed: { icon: '🏠', label: 'Khám phá' },
  chatlist: { icon: '💬', label: 'Tin nhắn' },
  notif: { icon: '🔔', label: 'Thông báo' },
  profile: { icon: '👤', label: 'Cá nhân' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const { data: conversations } = useConversations();
  const hasUnread = !!conversations?.some((c) => c.unread);

  const routes = state.routes.filter((r) => META[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderItem = (route: (typeof routes)[number]) => {
    const focused = state.routes[state.index]?.key === route.key;
    const meta = META[route.name];
    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={[styles.item, focused && styles.itemOn]}
      >
        <View>
          <Text style={styles.icon}>{meta.icon}</Text>
          {route.name === 'chatlist' && hasUnread && <View style={styles.dot} />}
        </View>
        <Text style={[styles.label, focused && styles.labelOn]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: (insets.bottom || 10) + 2 }]}>
      <View style={styles.pill}>
        {left.map(renderItem)}

        <Pressable
          onPress={() => requireAuth(() => router.push('/post'), 'Đăng nhập để đăng tin')}
          style={({ pressed }) => [styles.fabSlot, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.fab}>
            <Text style={styles.fabGlyph}>＋</Text>
          </View>
        </Pressable>

        {right.map(renderItem)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: C.paper, paddingHorizontal: 12, paddingTop: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 66,
    backgroundColor: C.paperWarm,
    borderRadius: R.pill,
    paddingHorizontal: 6,
    ...shadowLift,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 9,
    borderRadius: R.pill,
  },
  itemOn: { backgroundColor: C.brandLt },
  icon: { fontSize: 18 },
  label: { fontFamily: F.ui, fontSize: 10.5, color: C.muted },
  labelOn: { fontFamily: F.uiSemi, color: C.brandTx },
  dot: {
    position: 'absolute',
    top: -2,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
    borderWidth: 1.5,
    borderColor: C.paperWarm,
  },
  /** Ô giữa hẹp hơn các tab: nút cộng là hình vuông bo, không phải một tab đầy đủ. */
  fabSlot: { flexBasis: 56, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.brand,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabGlyph: { fontSize: 24, color: '#fff', lineHeight: 28, marginTop: -2 },
});
