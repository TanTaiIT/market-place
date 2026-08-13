import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, TabHeader } from '@/components/ui';
import { useNotifications } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

const ICON_BG = { org: C.mossLight, chain: '#FDEFD9', system: C.sand } as const;
const BADGE_BG = { org: C.moss, chain: C.amber, system: C.sand } as const;
const BADGE_FG = { org: '#fff', chain: C.amberInk, system: C.inkSoft } as const;

export default function Notifications() {
  const { data, error, isLoading } = useNotifications();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TabHeader title="Thông báo" />
      <FlatList
        data={data ?? []}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 70).duration(340)} style={styles.item}>
            <View style={[styles.icon, { backgroundColor: ICON_BG[item.kind] }]}>
              <Text style={{ fontSize: 16 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {item.badge && (
                <View style={[styles.badge, { backgroundColor: BADGE_BG[item.kind] }]}>
                  <Text style={[styles.badgeText, { color: BADGE_FG[item.kind] }]}>{item.badge}</Text>
                </View>
              )}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            {item.unread && <View style={styles.dot} />}
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState icon="🔔" text="Chưa có thông báo nào" />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  item: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    ...shadow,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  badgeText: { fontFamily: F.uiBold, fontSize: 9.5 },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 2 },
  body: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, lineHeight: 18, marginBottom: 5 },
  time: { fontFamily: F.mono, fontSize: 10, color: C.muted },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.pin,
    position: 'absolute',
    top: 14,
    right: 12,
  },
});
