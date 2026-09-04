import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { gradOf } from '@/api/client';
import { C, F, shadow } from '@/theme';

/**
 * Một dòng nhóm trong màn khám phá.
 *
 * Nhận PROPS RỜI chứ không nhận nguyên `OrgRow`: hai chỗ dùng nó có lượng dữ liệu khác nhau —
 * kết quả tìm có đủ số thành viên và mã, còn "nhóm của bạn" (`/organizations/mine`) thì BE
 * không trả hai thứ đó. Ép cả hai vào một kiểu nghĩa là chỗ thiếu phải bịa `memberCount: 0`,
 * và con số bịa đó hiện thẳng lên mặt người dùng.
 */
export function OrgRowCard({
  slug,
  name,
  avatarUrl,
  meta,
  action,
  locked,
  exact,
  onPress,
  onJoin,
}: {
  /** Khoá của gradient dự phòng — cùng nhóm thì luôn ra cùng màu giữa các lần mở. */
  slug: string;
  name: string;
  avatarUrl?: string | null;
  /** Dòng phụ do người gọi ghép — chỉ nơi đó biết mình đang có những mảnh nào. */
  meta: string;
  action: 'joined' | 'join' | 'closed';
  /** Nhóm riêng tư: ổ khoá góc ảnh. Chỉ gặp khi người dùng gõ đúng mã. */
  locked?: boolean;
  /** Khớp CHÍNH XÁC mã nhóm — viền đậm để nó không lẫn vào danh sách gợi ý. */
  exact?: boolean;
  onPress: () => void;
  onJoin?: () => void;
}) {
  const grad = gradOf(slug);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, exact && styles.rowExact, pressed && { opacity: 0.85 }]}
    >
      {/*
        Ảnh bìa VUÔNG bo góc, không phải avatar tròn: nhóm là một nơi chốn, không phải một
        người. Chưa có ảnh thì rơi về dải màu suy từ slug — trang trí, không phải dữ liệu bịa.
      */}
      <View style={[styles.cover, { backgroundColor: grad[0] }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.coverImg} resizeMode="cover" />
        ) : (
          <View style={[styles.coverHalf, { backgroundColor: grad[1] }]} />
        )}
        {locked && (
          <View style={styles.lock}>
            <Text style={styles.lockGlyph}>🔒</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text numberOfLines={2} style={styles.meta}>
          {meta}
        </Text>
      </View>

      {action === 'joined' ? (
        <View style={styles.joined}>
          <Text style={styles.joinedText}>✓ Đã vào</Text>
        </View>
      ) : (
        /*
         * Nhóm đang đóng cửa nhận đơn vẫn hiện ra, chỉ là không bấm được: giấu hẳn thì người
         * dùng tìm mãi không thấy nhóm mình biết chắc là có, rồi kết luận app hỏng.
         */
        <Pressable
          onPress={onJoin}
          disabled={action === 'closed'}
          style={({ pressed }) => [
            styles.join,
            action === 'closed' && styles.joinOff,
            pressed && styles.joinPressed,
          ]}
        >
          <Text style={styles.joinText}>{action === 'closed' ? 'Tạm đóng' : 'Tham gia'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 11,
    ...shadow,
  },
  rowExact: { borderWidth: 2, borderColor: C.moss },

  cover: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  coverImg: { ...StyleSheet.absoluteFill },
  /** Nửa dưới đậm hơn — đủ để dải màu trông có chiều, không cần thư viện gradient. */
  coverHalf: { height: '55%', opacity: 0.85 },
  lock: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  lockGlyph: { fontSize: 9 },

  name: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink, lineHeight: 18 },
  meta: { fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 3, lineHeight: 15 },

  /*
   * Nút nổi 3px — chữ ký của cả bộ giao diện (`box-shadow: 0 3px 0 pin-dark` trong prototype).
   * RN không có `box-shadow` đặc, nên dựng bằng viền dưới: bấm xuống thì viền co lại và nút
   * tụt đúng 2px, ra cảm giác ấn thật thay vì chỉ mờ đi.
   */
  join: {
    backgroundColor: C.pin,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: C.pinDark,
  },
  joinPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  joinOff: { backgroundColor: C.muted, borderBottomColor: C.inkSoft },
  joinText: { fontFamily: F.uiBold, fontSize: 12, color: C.paper },

  joined: {
    backgroundColor: C.mossLight,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  joinedText: { fontFamily: F.uiBold, fontSize: 12, color: C.moss },
});
