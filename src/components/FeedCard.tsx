import React from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Listing } from '@/api/db';
import { ListingPhoto } from './ListingPhoto';
import { Avatar } from './ui';
import { C, F, shadow } from '@/theme';

/**
 * Thẻ tin của BẢNG TIN — một tờ giấy ghim khổ rộng, đọc hết được nội dung mà không phải mở tin.
 *
 * Tách khỏi `NoteCard` chứ không sửa đè: `NoteCard` là ô thumbnail trong lưới 2 cột của
 * `/saved` và `/user/[id]`, nơi mật độ mới là thứ cần. Gộp hai vai vào một component thì mỗi
 * lần chỉnh bảng tin lại kéo theo hai màn khác đổi theo mà không ai kiểm.
 *
 * Mọi con số ở đây đều từ BE: `viewCount`, `favoriteCount` nằm sẵn trong payload tin. Chỗ duy
 * nhất KHÔNG có dữ liệu là dấu tick "đã xác minh" — BE không trả trạng thái xác minh của người
 * đăng trong `Listing`, nên thẻ này không vẽ nó thay vì vẽ một cái luôn bật.
 */
export function FeedCard({
  item,
  index,
  orgName,
  saved,
  onPress,
  onToggleSave,
  onMessage,
}: {
  item: Listing;
  index: number;
  /** Tên tổ chức tra từ `useMyOrgs()`; bỏ trống thì dòng phụ chỉ còn mốc thời gian. */
  orgName?: string;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
  onMessage: () => void;
}) {
  const share = () =>
    // Không `catch` im lặng: người dùng bấm Huỷ trên sheet chia sẻ cũng vào đây, mà đó không
    // phải lỗi — nuốt nó ở đây đúng hơn là đẩy một toast "chia sẻ thất bại" vô nghĩa.
    void Share.share({ message: `${item.title} — ${item.price}` }).catch(() => {});

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 4) * 70)
        .duration(380)
        .springify()
        .damping(16)}
      style={styles.card}
    >
      <View style={styles.pinhead} />
      {/* ── Người đăng ─────────────────────────────────────────── */}
      <View style={styles.head}>
        <Avatar text={item.avatar} url={item.avatarUrl} size={38} color={C.moss} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.seller}>
            {item.seller}
          </Text>
          <Text numberOfLines={1} style={styles.subMeta}>
            {orgName ? `${orgName} · ${item.meta}` : item.meta}
          </Text>
        </View>
        {item.status === 'pending' && (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>CHỜ DUYỆT</Text>
          </View>
        )}
      </View>

      {/* ── Nội dung ───────────────────────────────────────────── */}
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          {!!item.desc && (
            <Text numberOfLines={2} style={styles.desc}>
              {item.desc}
            </Text>
          )}
          {!!item.cat && (
            <View style={styles.catPill}>
              <Text style={styles.catText}>{item.cat}</Text>
            </View>
          )}
        </View>

        <ListingPhoto photo={item.photo} photoUrl={item.photoUrls?.[0]} style={styles.photo}>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{item.price}</Text>
          </View>
        </ListingPhoto>
      </Pressable>

      {/* ── Số liệu ────────────────────────────────────────────── */}
      <View style={styles.stats}>
        <Text style={styles.statText}>👁 {item.viewCount} lượt xem</Text>
        <Text style={styles.statText}>📌 {item.favoriteCount} người quan tâm</Text>
      </View>

      {/* ── Hành động ──────────────────────────────────────────── */}
      <View style={styles.actions}>
        <Action
          label={saved ? 'Đã lưu' : 'Lưu tin'}
          glyph={saved ? '❤️' : '🤍'}
          tint={saved ? C.pin : undefined}
          onPress={onToggleSave}
        />
        {/* Tin của chính mình thì không có ai để nhắn — chỗ đó thành nút xem lượt quan tâm. */}
        {!item.mine && <Action label="Nhắn tin" glyph="💬" onPress={onMessage} />}
        <Action label="Chia sẻ" glyph="↗" onPress={share} last />
      </View>
    </Animated.View>
  );
}

function Action({
  label,
  glyph,
  tint,
  last,
  onPress,
}: {
  label: string;
  glyph: string;
  tint?: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, !last && styles.actionSplit, pressed && styles.on]}
    >
      <Text style={styles.actionGlyph}>{glyph}</Text>
      <Text style={[styles.actionLabel, !!tint && { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * Tờ giấy GHIM LÊN BẢNG BẦN, không phải một dải trắng chạy hết màn hình. Bốn thứ làm nên
   * hình dáng đó và phải đi cùng nhau: lề ngoài (do danh sách chừa), bo góc, bóng đổ và cái
   * đinh. Bỏ một cái là ra thứ lai — bo góc mà không có lề thì góc bo chẳng dựa vào đâu để
   * nhìn thấy.
   *
   * `overflow: 'visible'` để đinh nhô lên trên mép; ảnh bên trong tự bo góc riêng.
   */
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    overflow: 'visible',
    ...shadow,
  },
  pinhead: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.pin,
    borderTopWidth: 3,
    borderTopColor: C.pinLight,
    zIndex: 3,
    ...shadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 10 },
  seller: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  subMeta: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 2 },
  pendingPill: {
    backgroundColor: C.tape,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  pendingText: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 0.6, color: C.tapeInk },

  body: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  /** Kalam: tiêu đề tin là chữ người ta viết lên tờ giấy, không phải nhãn hệ thống. */
  title: { fontFamily: F.hand, fontSize: 19, lineHeight: 25, color: C.ink },
  desc: { fontFamily: F.ui, fontSize: 13.5, lineHeight: 19, color: C.inkSoft },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: C.tape,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 3,
    marginTop: 1,
    transform: [{ rotate: '-1.2deg' }],
  },
  catText: { fontFamily: F.uiBold, fontSize: 11, color: C.tapeInk },

  /*
   * Cao CỐ ĐỊNH 200, không phải vuông theo bề ngang. Thẻ đã có lề nên ảnh hẹp hơn màn hình;
   * để vuông thì một tin chiếm gần hết chiều cao và mỗi lần cuộn chỉ thấy đúng một tin, phần
   * chữ lẫn hàng nút bị đẩy ra ngoài.
   */
  photo: { height: 200, justifyContent: 'flex-end' },
  priceTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: C.moss,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderBottomLeftRadius: 0,
  },
  priceText: { color: C.paper, fontFamily: F.monoBold, fontSize: 14 },

  stats: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1.5,
    borderTopColor: '#DFD6BC',
    borderStyle: 'dashed',
  },
  statText: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft },

  actions: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: '#DFD6BC',
    borderStyle: 'dashed',
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  actionSplit: { borderRightWidth: 1.5, borderRightColor: '#DFD6BC', borderStyle: 'dashed' },
  on: { backgroundColor: C.sand },
  actionGlyph: { fontSize: 13 },
  actionLabel: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft },
});
