import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { RowAction } from '@/components/AdminListingRow';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { UserActionSheet } from '@/components/UserActionSheet';
import type { UserAction, UserActionInput } from '@/components/UserActionSheet';
import { Avatar, EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAdjustWallet,
  useAdminUsers,
  useClearRejections,
  useSetUserLock,
} from '@/queries/admin-people';
import type { AdminUser, UserStatus } from '@/api/admin-people';
import { C, F } from '@/theme';

/**
 * Bảng người dùng TOÀN HỆ THỐNG — chỉ master (`GET /users` gác `requireMaster`).
 *
 * Không có bộ lọc tổ chức, và đó là điểm chính: tài khoản ở v2 là toàn cục, không thuộc org
 * nào. Một org khoá được tài khoản là với tay sang mọi org khác — nên quyền đó nằm ở đây chứ
 * không nằm trong bàn quản trị của org.
 *
 * Ba con số bịa của bản fixture (tin đăng / đã bán / đánh giá) đã bỏ; thứ thay vào là bậc uy
 * tín — con số quyết định tin của người này có tự lên bảng hay không.
 */

/** Đúng hai nhánh BE lọc được. "Chưa xác thực email" là một BADGE, không phải bộ lọc. */
const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'locked', label: 'Đang khoá' },
];

const STATUS: Record<UserStatus, { label: string; fg: string; bg: string }> = {
  ok: { label: 'Bình thường', fg: C.okText, bg: C.okTint },
  unverified: { label: 'Chưa xác thực email', fg: C.tape, bg: C.warnTint },
  locked: { label: 'Đang khoá', fg: C.badText, bg: C.badTint },
};

const AVATAR_COLORS = [C.mossBright, C.amber, C.cork, C.sky, C.corkDark, C.moss];
const colorOf = (name: string) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function AdminUsers() {
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState('all');

  const { data, error, isPending } = useAdminUsers({
    q: term,
    status: tab === 'all' ? undefined : (tab as 'active' | 'locked'),
  });
  const lock = useSetUserLock();
  const clear = useClearRejections();
  const adjust = useAdjustWallet();

  /** Thao tác đang mở ngăn. Một state cho cả ba vì ngăn chỉ mở được một lần một. */
  const [acting, setActing] = useState<{ action: UserAction; user: AdminUser } | null>(null);

  const rows = data ?? [];
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);
  const done = (message: string) => {
    setActing(null);
    toast(message);
  };

  const submit = ({ text, amount, idempotencyKey }: UserActionInput) => {
    if (!acting) return;
    const { action, user } = acting;

    if (action === 'wallet') {
      return adjust.mutate(
        { userId: user.id, amount, note: text, idempotencyKey },
        {
          // Không nói "số dư còn X": BE không trả số dư về, và bịa một con số ở đúng màn tiền
          // là kiểu nói dối tệ nhất.
          onSuccess: () => done(`✓ Đã ghi ${amount > 0 ? '+' : ''}${amount} Xu cho ${user.name}`),
          onError: fail,
        },
      );
    }

    if (action === 'clear') {
      return clear.mutate(
        { id: user.id, reason: text },
        { onSuccess: () => done(`✓ Đã gỡ án phạt đăng tin cho ${user.name}`), onError: fail },
      );
    }

    lock.mutate(
      { id: user.id, isActive: action === 'unlock', reason: text },
      {
        // Trạng thái thật chỉ có trong response — nói lại đúng thứ BE vừa trả về, không đoán.
        onSuccess: (u) =>
          done(u.status === 'locked' ? `🔒 Đã khoá ${u.name}` : `🔓 Đã mở khoá ${u.name}`),
        onError: fail,
      },
    );
  };

  return (
    <AdminScreen title="Người dùng" note="tài khoản là toàn cục">
      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Tìm theo tên hoặc email…"
          placeholderTextColor={C.deskTxtDim}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {rows.length > 0 && <Text style={styles.searchCount}>{rows.length}</Text>}
      </View>

      <AdminFilter options={TABS} value={tab} onChange={setTab} />

      <FlatList
        data={rows}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const status = STATUS[item.status];
          const locked = item.status === 'locked';
          return (
            <View style={styles.row}>
              <Avatar text={item.avatar} size={38} color={colorOf(item.name)} textColor={C.desk} />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.email}>
                  {item.email}
                </Text>
                <Text style={styles.stats}>
                  {/* Bậc 2 là ngưỡng tự đăng — tô sáng đúng ngưỡng đó, vì nó là thứ khiến tin
                      của người này lên bảng mà không ai nhìn qua. */}
                  <Text style={{ color: item.trustLevel >= 2 ? C.okText : C.deskTxtDim }}>
                    uy tín bậc {item.trustLevel}
                  </Text>
                  {' · vào '}
                  {item.joined}
                  {item.lastSeen ? ` · đăng nhập ${item.lastSeen}` : ' · chưa đăng nhập lại'}
                </Text>

                <View style={styles.foot}>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <View style={[styles.badgeDot, { backgroundColor: status.fg }]} />
                    <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
                  </View>

                  <View style={styles.acts}>
                    <RowAction
                      glyph="🪙"
                      onPress={() => setActing({ action: 'wallet', user: item })}
                    />
                    <RowAction
                      glyph="⏳"
                      onPress={() => setActing({ action: 'clear', user: item })}
                    />
                    <RowAction
                      glyph={locked ? '🔓' : '🔒'}
                      tone={locked ? undefined : 'danger'}
                      onPress={() => setActing({ action: locked ? 'unlock' : 'lock', user: item })}
                    />
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          isPending ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" onDark text={(error as Error).message} />
          ) : (
            <EmptyState icon="◍" onDark text="Không có tài khoản nào khớp bộ lọc" />
          )
        }
      />

      <UserActionSheet
        action={acting?.action ?? null}
        user={acting?.user ?? null}
        pending={lock.isPending || clear.isPending || adjust.isPending}
        onSubmit={submit}
        onClose={() => setActing(null)}
      />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: F.ui, fontSize: 13, color: C.deskTxt },
  searchCount: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },

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
  email: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtSoft, marginTop: 3 },
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
