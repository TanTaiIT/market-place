import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, Loading } from '@/components/ui';
import { GuestGate } from '@/components/GuestGate';
import { useIsAuthenticated } from '@/stores/auth';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { useToast } from '@/components/Toast';
import { useSignOut } from '@/queries/auth';
import { useProfile } from '@/queries/listings';
import { useMyGrants } from '@/queries/admin';
import { canOpenAdmin, isMaster, topRole } from '@/api/admin';
import { C, F, G, shadow } from '@/theme';

export default function Profile() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { data: profile, error, isLoading } = useProfile();
  const { data: grants } = useMyGrants();
  const master = isMaster(grants);
  const signOut = useSignOut();

  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Cá nhân"
        message="Trang cá nhân giữ tin bạn đăng, tin đã lưu và đánh giá từ người mua. Đăng nhập để mở."
      />
    );
  }
  if (isLoading) return <Loading />;
  if (error || !profile) {
    return <EmptyState icon="📡" text={(error as Error | null)?.message ?? 'Không tải được hồ sơ'} />;
  }

  const menu = [
    ...(canOpenAdmin(grants)
      ? [{ icon: '🗂', text: 'Bàn quản trị', admin: true, go: () => router.push('/admin') }]
      : []),
    { icon: '📌', text: 'Tin đã đăng', go: () => router.push('/mylistings') },
    { icon: '👥', text: 'Nhóm của tôi', go: () => router.push('/join-org') },
    { icon: '🤍', text: 'Tin đã lưu', go: () => router.push('/saved') },
    { icon: '⚙️', text: 'Cài đặt tài khoản', go: () => router.push('/settings') },
    { icon: '❓', text: 'Trợ giúp & hỗ trợ', go: () => toast('Liên hệ: hotro@ghim.vn') },
    { icon: '🚪', text: 'Đăng xuất', danger: true, go: signOut },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <LinearGradient colors={G.hero} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <Avatar text={profile.avatar} url={profile.avatarUrl} size={76} ring />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.org}>{profile.org}</Text>

        <View style={styles.stats}>
          <Stat num={profile.posted} label="Tin đã ghim" />
          <Stat num={profile.sold} label="Đã bán" />
          <Stat num={profile.rating} label="Đánh giá" />
        </View>
      </LinearGradient>

      {/*
        CHỈ master. Với người thường, "nhóm đang thao tác" không còn là thứ họ phải nghĩ tới:
        đọc tin của nhóm và đăng tin vào nhóm đều làm ngay trên trang hồ sơ nhóm
        (`/org/[slug]`), nên một cái công tắc toàn cục ở trang cá nhân chỉ tạo ra một trạng
        thái ẩn mà họ đổi nhầm rồi không hiểu vì sao bảng tin đổi theo.

        Master thì ngược lại: họ không thuộc nhóm nào, và phạm vi thao tác là thứ họ PHẢI
        chỉ ra. Quản trị nhóm chọn phạm vi ngay trong bàn quản trị (`AdminOrgPicker`).
      */}
      {master && (
        <View style={styles.orgBlock}>
          <OrgSwitcher />
        </View>
      )}

      <View style={styles.menu}>
        {menu.map((m, i) => (
          <Animated.View key={m.text} entering={FadeInDown.delay(i * 60).duration(320)}>
            <Pressable
              onPress={m.go}
              style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.rowIcon}>{m.icon}</Text>
              <Text
                style={[
                  styles.rowText,
                  m.danger && { color: C.pin },
                  m.admin && { color: C.moss, fontFamily: F.uiBold },
                ]}
              >
                {m.text}
              </Text>
              {m.admin && (
                <View style={styles.adminTag}>
                  <Text style={styles.adminTagText}>{(topRole(grants) ?? '').toUpperCase()}</Text>
                </View>
              )}
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
  orgBlock: { paddingHorizontal: 16, marginTop: 14 },
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
  adminTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: C.mossLight,
  },
  adminTagText: { fontFamily: F.mono, fontSize: 9, color: C.moss },
});
