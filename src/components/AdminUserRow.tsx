import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AdminUser, UserStatus } from '@/api/admin-people';
import { RowAction } from './AdminListingRow';
import type { UserAction } from './UserActionSheet';
import { Avatar } from './ui';
import { C, F } from '@/theme';

/**
 * Một hàng của bảng người dùng (master). Tách khỏi `app/admin/users.tsx` vì route đó chạm trần
 * 250 dòng đúng lúc cần thêm nút thứ tư — và hàng này thuần hiển thị, không gọi mutation nào:
 * mọi nút chỉ báo lên `onAction`, route mới là nơi bấm gửi.
 */

/** Ngưỡng tự đăng của BE (`QUOTA.AUTO_APPROVE_TRUST_LEVEL`) — cũng là trần, nên dưới nó là đã bị phạt. */
const SELF_PUBLISH_LEVEL = 2;

const STATUS: Record<UserStatus, { label: string; fg: string; bg: string }> = {
  ok: { label: 'Bình thường', fg: C.okText, bg: C.okTint },
  unverified: { label: 'Chưa xác thực email', fg: C.tape, bg: C.warnTint },
  locked: { label: 'Đang khoá', fg: C.badText, bg: C.badTint },
};

const AVATAR_COLORS = [C.mossBright, C.amber, C.cork, C.sky, C.corkDark, C.moss];
const colorOf = (name: string) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function AdminUserRow({
  item,
  onAction,
}: {
  item: AdminUser;
  onAction: (action: UserAction) => void;
}) {
  const status = STATUS[item.status];
  const locked = item.status === 'locked';
  const penalized = item.trustLevel < SELF_PUBLISH_LEVEL;

  return (
    <View style={styles.row}>
      <Avatar
        text={item.avatar}
        url={item.avatarUrl}
        size={38}
        color={colorOf(item.name)}
        textColor={C.desk}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.name}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={styles.email}>
          {item.email}
        </Text>
        <Text style={styles.stats}>
          {/* Tô sáng đúng ngưỡng tự đăng: nó là thứ khiến tin của người này lên bảng mà không ai
              nhìn qua. */}
          <Text style={{ color: penalized ? C.deskTxtDim : C.okText }}>
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
            <RowAction glyph="🪙" onPress={() => onAction('wallet')} />
            <RowAction glyph="⏳" onPress={() => onAction('clear')} />
            {/* Chỉ khi có bậc để trả — BE trả 409 cho người đang ở trần, ẩn nút thay vì để bấm rồi ăn lỗi. */}
            {penalized && <RowAction glyph="↺" onPress={() => onAction('restore')} />}
            <RowAction
              glyph={locked ? '🔓' : '🔒'}
              tone={locked ? undefined : 'danger'}
              onPress={() => onAction(locked ? 'unlock' : 'lock')}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
