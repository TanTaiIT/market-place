import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { AdminUserRow } from '@/components/AdminUserRow';
import { UserActionSheet } from '@/components/UserActionSheet';
import type { UserAction, UserActionInput } from '@/components/UserActionSheet';
import { EmptyState, Loading, PagedFooter } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAdjustWallet,
  useAdminUsers,
  useClearRejections,
  useRestoreTrust,
  useSetUserLock,
} from '@/queries/admin-people';
import type { AdminUser } from '@/api/admin-people';
import { C, F } from '@/theme';

/**
 * Bảng người dùng TOÀN HỆ THỐNG — chỉ master (`GET /users` gác `requireMaster`).
 *
 * Không có bộ lọc tổ chức, và đó là điểm chính: tài khoản ở v2 là toàn cục, không thuộc org
 * nào. Một org khoá được tài khoản là với tay sang mọi org khác — nên quyền đó nằm ở đây chứ
 * không nằm trong bàn quản trị của org.
 *
 * Ba con số bịa của bản fixture (tin đăng / đã bán / đánh giá) đã bỏ; thứ thay vào là bậc uy
 * tín — con số quyết định tin của người này có tự lên bảng hay không. Hàng hiển thị nằm ở
 * `AdminUserRow`; file này chỉ còn bộ lọc và chỗ bấm gửi mutation.
 */

/** Đúng hai nhánh BE lọc được. "Chưa xác thực email" là một BADGE, không phải bộ lọc. */
const TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'locked', label: 'Đang khoá' },
];

export default function AdminUsers() {
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState('all');

  const { data, error, isPending, loadMore, isFetchingNextPage } = useAdminUsers({
    q: term,
    status: tab === 'all' ? undefined : (tab as 'active' | 'locked'),
  });
  const lock = useSetUserLock();
  const clear = useClearRejections();
  const restore = useRestoreTrust();
  const adjust = useAdjustWallet();

  /** Thao tác đang mở ngăn. Một state cho tất cả vì ngăn chỉ mở được một lần một. */
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

    if (action === 'restore') {
      return restore.mutate(
        { id: user.id, reason: text },
        {
          // Bậc mới lấy từ response, không đoán: hàng sẽ hiện đúng con số này sau khi quét cache.
          onSuccess: (u) => done(`↺ Đã phục hồi uy tín bậc ${u.trustLevel} cho ${u.name}`),
          onError: fail,
        },
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} onDark />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <AdminUserRow item={item} onAction={(action) => setActing({ action, user: item })} />
        )}
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
        pending={lock.isPending || clear.isPending || restore.isPending || adjust.isPending}
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
});
