import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRequireAuth, useRequireVerifiedEmail } from './GuestGate';
import { useConversations } from '@/queries/chat';
import { useNotifications } from '@/queries/notifications';
import { onSocketEvent } from '@/api/socket';
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

// Lấy type props của tab bar thẳng từ prop `tabBar` của `Tabs` thay vì import
// `BottomTabBarProps` từ `@react-navigation/bottom-tabs`: expo-router (SDK 57+) vendor
// bản react-navigation riêng, hai bộ type trùng tên nhưng không gán được cho nhau.
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const requireVerified = useRequireVerifiedEmail();
  const { data: conversations } = useConversations();
  const hasUnread = !!conversations?.some((c) => c.unread);
  const { data: notifs } = useNotifications();
  const hasNotif = !!notifs?.some((n) => n.unread);
  const bell = useBellShake();

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
          {/*
            Chỉ chuông mới lắc. Bọc MỌI icon trong `Animated.Text` thì ba icon kia cũng dựng
            thêm một node animated không bao giờ chạy — rẻ, nhưng nói sai rằng chúng có hiệu ứng.
          */}
          {route.name === 'notif' ? (
            <Animated.Text style={[styles.icon, bell]}>{meta.icon}</Animated.Text>
          ) : (
            <Text style={styles.icon}>{meta.icon}</Text>
          )}
          {route.name === 'chatlist' && hasUnread && <View style={styles.dot} />}
          {route.name === 'notif' && hasNotif && <View style={styles.dot} />}
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
          onPress={() =>
            requireAuth(
              () => requireVerified(() => router.push('/post'), 'Xác thực email trước khi đăng tin'),
              'Đăng nhập để đăng tin',
            )
          }
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

/**
 * Lắc chuông khi có thông báo mới.
 *
 * Nghe `notif:new` NGAY TẠI ĐÂY thay vì nhận qua prop hay global state: hiệu ứng thuộc về cái
 * chuông, nên nó nên sống và chết cùng cái chuông. `useNotifSignal` ở `_layout` lo việc quét
 * lại query — hai việc khác nhau, hai vòng đời khác nhau, và thanh tab thì không phải lúc nào
 * cũng hiển thị.
 *
 * Lắc bằng `rotate` chứ không `translateX`: chuông thật quay quanh điểm treo. Bốn nhịp giảm
 * dần rồi về 0 — kết thúc đúng ở 0 là bắt buộc, nếu không mỗi lượt lắc để lại một độ nghiêng
 * cộng dồn và sau vài thông báo cái chuông nằm ngang.
 */
function useBellShake() {
  const deg = useSharedValue(0);

  useEffect(() => {
    const off = onSocketEvent('notif:new', () => {
      deg.value = withSequence(
        withTiming(-14, { duration: 60 }),
        withTiming(12, { duration: 70 }),
        withTiming(-8, { duration: 70 }),
        withTiming(5, { duration: 70 }),
        withTiming(0, { duration: 80 }),
      );
    });
    return off;
  }, [deg]);

  return useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
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
