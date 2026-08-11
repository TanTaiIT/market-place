import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSignOut } from '@/queries/auth';
import { useProfile } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Profile() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading } = useProfile();
  const signOut = useSignOut();

  if (isLoading || !profile) return <Loading />;

  const menu = [
    { icon: '📌', text: 'Tin đã đăng', go: () => router.push('/mylistings') },
    { icon: '🤍', text: 'Tin đã lưu', go: () => router.push('/saved') },
    { icon: '⚙️', text: 'Cài đặt tài khoản', go: () => router.push('/settings') },
    { icon: '❓', text: 'Trợ giúp & hỗ trợ', go: () => toast('Liên hệ: hotro@ghim.vn') },
    { icon: '🚪', text: 'Đăng xuất', danger: true, go: signOut },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <LinearGradient colors={[C.cork, C.paper]} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <Avatar text={profile.avatar} size={76} ring />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.org}>{profile.org}</Text>

        <View style={styles.stats}>
          <Stat num={String(profile.posted)} label="Tin đã ghim" />
          <Stat num={String(profile.sold)} label="Đã bán" />
          <Stat num={profile.rating} label="Đánh giá" />
        </View>
      </LinearGradient>

      <View style={styles.menu}>
        {menu.map((m, i) => (
          <Animated.View key={m.text} entering={FadeInDown.delay(i * 60).duration(320)}>
            <Pressable
              onPress={m.go}
              style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.rowIcon}>{m.icon}</Text>
              <Text style={[styles.rowText, m.danger && { color: C.pin }]}>{m.text}</Text>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  hero: { alignItems: 'center', paddingBottom: 20, paddingHorizontal: 20 },
  name: { fontFamily: F.hand, fontSize: 24, color: C.ink, marginTop: 12 },
  org: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 28, marginTop: 18 },
  statNum: { fontFamily: F.monoBold, fontSize: 18, color: C.ink },
  statLabel: { fontFamily: F.ui, fontSize: 10.5, color: C.inkSoft, marginTop: 2 },
  menu: { padding: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.paperWarm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    ...shadow,
  },
  rowIcon: { fontSize: 17, width: 22, textAlign: 'center' },
  rowText: { flex: 1, fontFamily: F.uiSemi, fontSize: 13.5, color: C.ink },
  arrow: { color: C.muted, fontSize: 18 },
});
