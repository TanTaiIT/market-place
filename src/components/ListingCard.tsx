import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Listing } from '@/api/db';
import { listingShips } from '@/api/placeholders';
import { ListingPhoto } from './ListingPhoto';
import { C, F, R, shadow } from '@/theme';

/**
 * Thẻ tin của giao diện mới — dựng theo `.card` trong prototype "Ghim · Mioto style".
 *
 * MỌI con số trên thẻ đều là số THẬT của `Listing`: tiêu đề, giá, danh mục, tỉnh/phường,
 * lượt xem, người quan tâm, trạng thái chờ duyệt, số ảnh.
 *
 * Ngoại lệ duy nhất là viên "Giao tận nơi" (`listingShips`) — trang trí, không phải thứ
 * người mua dựa vào để chọn người bán. Sao đánh giá, số giao dịch, % giảm giá, giá cũ và
 * khoảng cách từng nằm ở đây và đã được gỡ: chúng trông như bằng chứng về người bán, nên
 * bịa chúng là nói dối đúng chỗ người mua tin nhất.
 *
 * Không có nút nhắn tin như `FeedCard` cũ: bản mẫu chỉ để lại nút lưu trên thẻ, còn nhắn tin
 * nằm ở thanh dính dưới màn chi tiết. Một hành động một chỗ, không nhân đôi bề mặt.
 */
export function ListingCard({
  item,
  index,
  orgName,
  saved,
  onPress,
  onToggleSave,
}: {
  item: Listing;
  index: number;
  /** Tên tổ chức của tin nội bộ; vắng thì thẻ giấu viên đó đi chứ không bịa tên. */
  orgName?: string;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  const ships = listingShips(item.id);
  const photoCount = item.photoUrls?.length ?? 0;

  return (
    // Chặn độ trễ ở mốc thứ 5: bảng tin dài không giới hạn, nhân thẳng `index` thì tin cuối vào
    // màn sau cả giây — nhìn như treo chứ không như hiệu ứng.
    <Animated.View entering={FadeInDown.delay(Math.min(index, 4) * 70).duration(340)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      >
        <View style={styles.imgWrap}>
          <ListingPhoto photo={item.photo} photoUrl={item.photoUrls?.[0]} style={styles.photo}>
            {item.status === 'pending' && (
              <View style={styles.pending}>
                <Text style={styles.pendingText}>CHỜ DUYỆT</Text>
              </View>
            )}

            <Pressable
              hitSlop={8}
              onPress={onToggleSave}
              style={[styles.round, styles.fav, saved && styles.favOn]}
            >
              <Text style={styles.favGlyph}>{saved ? '❤️' : '🤍'}</Text>
            </Pressable>


            {photoCount > 1 && (
              <View style={styles.dots}>
                {/* Khoá theo URL ảnh, không theo index: index đổi nghĩa ngay khi tin thêm ảnh. */}
                {(item.photoUrls ?? []).slice(0, 5).map((url, i) => (
                  <View key={url} style={[styles.dot, i === 0 && styles.dotOn]} />
                ))}
              </View>
            )}
          </ListingPhoto>
        </View>

        <View style={styles.body}>
          <View style={styles.chips}>
            {ships && (
              <View style={[styles.chip, styles.chipOrange]}>
                <Text style={[styles.chipText, { color: C.orange }]}>🚚 Giao tận nơi</Text>
              </View>
            )}
            {!!orgName && (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  🏫 {orgName}
                </Text>
              </View>
            )}
          </View>

          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>

          {/* Hai số này là số THẬT của BE — thay cho "Còn bảo hành / Dùng 8 tháng" của bản mẫu. */}
          <View style={styles.specs}>
            <Text style={styles.spec}>👁 {item.viewCount} lượt xem</Text>
            <Text style={styles.spec}>📌 {item.favoriteCount} người quan tâm</Text>
          </View>

          <Text style={styles.loc} numberOfLines={1}>
            📍 {[item.ward, item.province].filter(Boolean).join(', ') || item.cat}
          </Text>

          {/* Giá đứng MỘT MÌNH trong hàng chân sau khi gỡ sao/giao dịch — không cân đối hai
              đầu nữa, nên nó về lề trái theo hướng đọc thay vì lơ lửng bên phải. */}
          <View style={styles.foot}>
            <Text style={styles.price}>{item.price}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.paperWarm, borderRadius: R.lg, overflow: 'hidden', ...shadow },
  imgWrap: { margin: 8, marginBottom: 0, borderRadius: R.md, overflow: 'hidden' },
  photo: { height: 196, width: '100%' },

  round: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fav: { top: 10, right: 10 },
  favOn: { backgroundColor: C.glassLift },
  favGlyph: { fontSize: 15 },

  pending: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.scrim,
  },
  pendingText: { fontFamily: F.uiBold, fontSize: 9.5, letterSpacing: 0.8, color: C.paperWarm },


  dots: { position: 'absolute', alignSelf: 'center', bottom: 10, flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 14, backgroundColor: '#fff' },

  body: { padding: 12, paddingHorizontal: 14, paddingBottom: 0 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 11 },
  chip: {
    backgroundColor: C.chipIdle,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '60%',
  },
  chipGreen: { backgroundColor: C.brandLt },
  chipOrange: { backgroundColor: C.orangeLt },
  chipText: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft },

  title: { fontFamily: F.uiBold, fontSize: 15.5, lineHeight: 20, color: C.ink, letterSpacing: 0.1 },
  specs: { flexDirection: 'row', gap: 16, marginTop: 11, flexWrap: 'wrap' },
  spec: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft },
  loc: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft, marginTop: 10 },

  foot: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: 13,
    marginHorizontal: -14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  price: { fontFamily: F.uiBold, fontSize: 16, color: C.brandTx },
});
