import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ModListing, ModStatus } from '@/api/admin';
import { ListingPhoto } from './ListingPhoto';
import { Avatar } from './ui';
import { C, F } from '@/theme';

/**
 * Một tin trên bảng quản trị. Prototype web là hàng của `<table>` 6 cột; trên điện thoại
 * cột thứ ba trở đi không còn chỗ, nên xếp dọc thành thẻ — cùng dữ liệu, khác hình.
 *
 * Nút thao tác truyền vào qua `children`: mỗi màn cần một bộ khác nhau (duyệt / ẩn / gỡ),
 * mà mutation thì chỉ được gọi từ `app/**` (folder.convention §6).
 */

const BADGE: Record<ModStatus, { label: string; fg: string; bg: string }> = {
  active: { label: 'Đang hiển thị', fg: C.okText, bg: C.okTint },
  pending: { label: 'Chờ duyệt', fg: C.tape, bg: C.warnTint },
  // Nhãn nói rõ NGUỒN chứ không chỉ trạng thái: người duyệt cần biết tin này đến từ người
  // không thuộc tổ chức, vì đó là lý do nó nằm ở hàng đợi riêng.
  pending_unverified: { label: 'Người ngoài gửi', fg: C.tape, bg: C.warnTint },
  rejected: { label: 'Đã từ chối', fg: C.badText, bg: C.badTint },
  hidden: { label: 'Đã ẩn', fg: C.deskTxtDim, bg: C.mutedTint },
};

export function StatusBadge({ status }: { status: ModStatus }) {
  const style = BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: style.fg }]} />
      <Text style={[styles.badgeText, { color: style.fg }]}>{style.label}</Text>
    </View>
  );
}

/** Nút vuông nhỏ ở mép phải mỗi hàng. `tone="danger"` cho hành động không hoàn tác được. */
export function RowAction({
  glyph,
  onPress,
  tone,
}: {
  glyph: string;
  onPress: () => void;
  tone?: 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.action,
        tone === 'danger' && styles.actionDanger,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.actionGlyph}>{glyph}</Text>
    </Pressable>
  );
}

const AVATAR_COLORS = [C.mossBright, C.amber, C.cork, C.sky, C.corkDark, C.moss];

/** Cùng người luôn ra cùng màu giữa các màn — hash tên chứ không dùng chỉ số hàng. */
const colorOf = (name: string) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function AdminListingRow({
  item,
  onPress,
  children,
}: {
  item: ModListing;
  /** Chạm vào thân hàng để mở chi tiết; nút thao tác bên trong vẫn nhận chạm riêng của nó. */
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <ListingPhoto photo={item.photo} style={styles.thumb} imageStyle={styles.thumbRadius} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>
        <Text style={styles.sub}>
          {item.price} · {item.cat}
        </Text>

        <View style={styles.seller}>
          <Avatar text={item.avatar} size={20} color={colorOf(item.seller)} textColor={C.desk} />
          <Text numberOfLines={1} style={styles.sellerText}>
            {item.seller} · gửi {item.at}
          </Text>
        </View>

        {!!item.reason && <Text style={styles.reason}>Lý do từ chối: {item.reason}</Text>}

        <View style={styles.foot}>
          <StatusBadge status={item.status} />
          <View style={styles.actions}>{children}</View>
        </View>
      </View>
    </Pressable>
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
  thumb: { width: 52, height: 52, borderRadius: 6 },
  thumbRadius: { borderRadius: 6 },
  title: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper, lineHeight: 18 },
  sub: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtSoft, marginTop: 3 },
  seller: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  sellerText: { flex: 1, fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim },
  reason: { fontFamily: F.uiSemi, fontSize: 11, color: C.badText, marginTop: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontFamily: F.mono, fontSize: 10 },

  action: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDanger: { borderColor: C.pin, backgroundColor: C.badTint },
  actionGlyph: { fontSize: 13, color: C.deskTxt },
});
