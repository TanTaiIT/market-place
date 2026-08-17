import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, TabHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMarkNotificationRead, useNotifications } from '@/queries/notifications';
import { C, F, shadow } from '@/theme';

/**
 * Hai phạm vi BE thật sự phân biệt. `chain`/`system` của bản cũ đã bỏ: chain không còn tồn
 * tại trong hệ thống, còn system thì chưa từng có endpoint nào gửi.
 */
const SCOPE = {
  org: { icon: '🏫', label: 'Toàn tổ chức', iconBg: C.mossLight, badgeBg: C.moss, badgeFg: '#fff' },
  unit: { icon: '👥', label: 'Nhóm của bạn', iconBg: C.sand, badgeBg: C.amber, badgeFg: C.amberInk },
} as const;

export default function Notifications() {
  const { data, error, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const toast = useToast();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TabHeader title="Thông báo" />
      <FlatList
        data={data ?? []}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
        renderItem={({ item, index }) => {
          const scope = SCOPE[item.scope];
          return (
            <Animated.View entering={FadeInDown.delay(index * 70).duration(340)}>
              <Pressable
                // Chạm để đánh dấu đã đọc. Không tự đánh dấu khi dòng lọt vào khung nhìn: cuộn
                // lướt qua không phải là đã đọc, và chấm chưa đọc là thứ duy nhất giúp người
                // dùng tìm lại thông báo họ định xem sau.
                onPress={() =>
                  item.unread &&
                  markRead.mutate(item.id, { onError: (e: Error) => toast(`⚠️ ${e.message}`) })
                }
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.icon, { backgroundColor: scope.iconBg }]}>
                  <Text style={{ fontSize: 16 }}>{scope.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.badge, { backgroundColor: scope.badgeBg }]}>
                    <Text style={[styles.badgeText, { color: scope.badgeFg }]}>{scope.label}</Text>
                  </View>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                {item.unread && <View style={styles.dot} />}
              </Pressable>
            </Animated.View>
          );
        }}
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
