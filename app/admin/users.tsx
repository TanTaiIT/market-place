import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { RowAction } from '@/components/AdminListingRow';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { Avatar, EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminUsers, useToggleUserLock, useVerifyUser } from '@/queries/admin-people';
import type { UserStatus } from '@/api/admin-people';
import { SCHOOLS } from '@/api/admin-people';
import { useAdminSchool, useSetAdminSchool } from '@/stores/admin';
import { C, F } from '@/theme';

const SCHOOL_OPTIONS = [
  { value: 'all', label: 'Tất cả trường' },
  ...SCHOOLS.map((s) => ({ value: s, label: s })),
];

const TABS: { value: UserStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unverified', label: 'Chờ xác thực' },
  { value: 'locked', label: 'Đang khoá' },
];

const STATUS: Record<UserStatus, { label: string; fg: string; bg: string }> = {
  ok: { label: 'Bình thường', fg: C.okText, bg: C.okTint },
  unverified: { label: 'Chờ xác thực', fg: C.tape, bg: C.warnTint },
  locked: { label: 'Đang khoá', fg: C.badText, bg: C.badTint },
};

const AVATAR_COLORS = [C.mossBright, C.amber, C.cork, C.sky, C.corkDark, C.moss];
const colorOf = (name: string) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

/**
 * Bảng người dùng. Bản web có 7 cột; ở đây ba con số (tin đăng / đã bán / đánh giá) gom thành
 * một dòng thống kê dưới tên, vì trên điện thoại tiêu đề cột chiếm nhiều chỗ hơn chính con số.
 */
export default function AdminUsers() {
  const toast = useToast();
  const school = useAdminSchool();
  const setSchool = useSetAdminSchool();
  const [tab, setTab] = useState<UserStatus | 'all'>('all');

  const { data, error, isLoading } = useAdminUsers(school);
  const verify = useVerifyUser();
  const lock = useToggleUserLock();

  const all = data ?? [];
  const rows = tab === 'all' ? all : all.filter((u) => u.status === tab);
  const tabs = TABS.map((t) => ({
    ...t,
    count: t.value === 'all' ? all.length : all.filter((u) => u.status === t.value).length,
  }));

  const surface = (done: string) => ({
    onSuccess: () => toast(done),
    onError: (e: Error) => toast(`⚠️ ${e.message}`),
  });

  return (
    <AdminScreen title="Người dùng" note="ai đang ở đây">
      <AdminFilter options={SCHOOL_OPTIONS} value={school} onChange={setSchool} />
      <AdminFilter
        options={tabs}
        value={tab}
        onChange={(v) => setTab(v as UserStatus | 'all')}
      />

      <FlatList
        data={rows}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const status = STATUS[item.status];
          return (
            <View style={styles.row}>
              <Avatar text={item.avatar} size={38} color={colorOf(item.name)} textColor={C.desk} />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                <Text style={styles.phone}>
                  {item.phone} · {item.school}
                </Text>
                <Text style={styles.stats}>
                  {item.posts} tin · {item.sold} đã bán ·{' '}
                  <Text
                    style={{
                      color: item.rating >= 4.5 ? C.okText : item.rating ? C.amber : C.deskTxtDim,
                    }}
                  >
                    {item.rating ? item.rating.toFixed(1) : '—'}
                  </Text>{' '}
                  · vào {item.joined}
                </Text>

                <View style={styles.foot}>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <View style={[styles.badgeDot, { backgroundColor: status.fg }]} />
                    <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
                  </View>

                  <View style={styles.acts}>
                    {item.status === 'unverified' && (
                      <RowAction
                        glyph="✓"
                        onPress={() =>
                          verify.mutate(
                            item.id,
                            surface(`Đã xác thực ${item.name} thuộc ${item.school}`),
                          )
                        }
                      />
                    )}
                    <RowAction
                      glyph={item.status === 'locked' ? '🔓' : '🔒'}
                      tone={item.status === 'locked' ? undefined : 'danger'}
                      onPress={() =>
                        lock.mutate(
                          item.id,
                          surface(
                            item.status === 'locked'
                              ? `Đã mở khoá ${item.name}`
                              : `Đã khoá tài khoản ${item.name}`,
                          ),
                        )
                      }
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState icon="◍" onDark text="Không có người dùng nào ở mục này" />
          )
        }
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingBottom: 24, gap: 10 },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 12,
  },
  name: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  phone: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtSoft, marginTop: 3 },
  stats: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  acts: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontFamily: F.mono, fontSize: 10 },
});
