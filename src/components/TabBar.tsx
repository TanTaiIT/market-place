import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversations } from '@/queries/chat';
import { C, F } from '@/theme';

const META: Record<string, { icon: string; label: string }> = {
  feed: { icon: '🏠', label: 'Bảng tin' },
  chatlist: { icon: '💬', label: 'Tin nhắn' },
  notif: { icon: '🔔', label: 'Thông báo' },
  profile: { icon: '👤', label: 'Cá nhân' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={styles.item}
      >
        <View>
          <Text style={styles.icon}>{meta.icon}</Text>
          {route.name === 'chatlist' && hasUnread && <View style={styles.dot} />}
        </View>
        <Text style={[styles.label, focused && { color: C.ink }]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 10 }]}>
      {left.map(renderItem)}

      <Pressable
        onPress={() => router.push('/post')}
        style={({ pressed }) => [
          styles.fab,
          { transform: [{ scale: pressed ? 0.88 : 1 }, { rotate: pressed ? '-8deg' : '0deg' }] },
        ]}
      >
        <Text style={{ fontSize: 22 }}>📌</Text>
      </Pressable>

      {right.map(renderItem)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
  },
  item: { alignItems: 'center', gap: 3, flex: 1 },
  icon: { fontSize: 18 },
  label: { fontFamily: F.uiBold, fontSize: 9.5, color: C.muted },
  dot: {
    position: 'absolute',
    top: -2,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.pin,
    borderWidth: 1.5,
    borderColor: C.paperWarm,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.pin,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    borderWidth: 6,
    borderColor: C.paperWarm,
    shadowColor: C.pin,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
