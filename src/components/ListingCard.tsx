import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Listing } from '@/api/db';
import { listingShips } from '@/api/placeholders';
import { ListingPhoto } from './ListingPhoto';
import { C, F, R, S, T, shadow } from '@/theme';

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
 * Không có nút nhắn tin như thẻ bảng-bần cũ (`FeedCard`, đã xoá): bản mẫu chỉ để lại nút lưu
 * nằm ở thanh dính dưới màn chi tiết. Một hành động một chỗ, không nhân đôi bề mặt.
 */
export function ListingCard({
  item,
  index,
  showOrg = true,
  saved,
  onPress,
  onToggleSave,
}: {
  item: Listing;
  index: number;
  /**
   * Hiện viên "🏫 tên nhóm". Tắt ở chính hồ sơ nhóm — xem chỗ gọi ở `app/org/[id]`.
   *
   * Mặc định BẬT: viên này trả lời "tin này đến từ đâu", và quên bật nó ở một màn trộn nhiều
   * nguồn là mất đúng thông tin người xem đang cần. Quên TẮT ở hồ sơ nhóm thì chỉ thừa.
   */
  showOrg?: boolean;
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
            {/* Tên nhóm đọc thẳng từ tin (`item.org`), do BE tra sẵn. Bản trước nhận qua prop
                và người gọi ghép tên từ `useMyOrgs()` — cách đó câm với chính người NGOÀI
                nhóm, tức là đúng những người cần biết tin này đến từ đâu. */}
            {showOrg && !!item.org && (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  🏫 {item.org.name}
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
  imgWrap: { margin: S.sm, marginBottom: 0, borderRadius: R.md, overflow: 'hidden' },
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
  fav: { top: S.md, right: S.md },
  favOn: { backgroundColor: C.glassLift },
  favGlyph: { fontSize: 15 },

  pending: {
    position: 'absolute',
    top: S.md,
    left: S.md,
    paddingHorizontal: S.sm,
    paddingVertical: S.xs,
    borderRadius: R.pill,
    backgroundColor: C.scrim,
  },
  pendingText: { fontFamily: F.uiBold, ...T.xs, letterSpacing: 0.8, color: C.paperWarm },

  dots: { position: 'absolute', alignSelf: 'center', bottom: S.md, flexDirection: 'row', gap: S.xs },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 14, backgroundColor: '#fff' },

  /* Đệm ngang bằng `S.lg` cho cả thân thẻ: bản trước 12/14 lệch nhau 2px giữa dọc và ngang, đủ
     để mắt thấy thẻ hơi 'méo' mà không chỉ ra được chỗ nào. */
  body: { padding: S.lg, paddingBottom: 0 },
  chips: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap', marginBottom: S.md },
  chip: {
    backgroundColor: C.chipIdle,
    borderRadius: R.pill,
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 2,
    maxWidth: '60%',
  },
  chipGreen: { backgroundColor: C.brandLt },
  chipOrange: { backgroundColor: C.orangeLt },
  chipText: { fontFamily: F.ui, ...T.sm, color: C.inkSoft },

  /* `T.md` mang `lineHeight: 22` (1.47×). Bản trước là 15.5/20 — 1.29×, và với chữ có dấu thì
     dấu của dòng hai chạm chân dòng một; đó là nguồn cảm giác chật rõ nhất trên thẻ. */
  title: { fontFamily: F.uiBold, ...T.md, color: C.ink },
  specs: { flexDirection: 'row', gap: S.lg, marginTop: S.md, flexWrap: 'wrap' },
  spec: { fontFamily: F.ui, ...T.sm, color: C.inkSoft },
  loc: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginTop: S.sm },

  foot: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    marginTop: S.lg,
    marginHorizontal: -S.lg,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
  },
  /* Giá KHÔNG to hơn tiêu đề — nó đã khác màu (`brandTx`). Cho nó thêm một bậc cỡ nữa là hai
     thứ tranh nhau làm tâm của thẻ, và mắt không biết đọc cái nào trước. */
  price: { fontFamily: F.uiBold, ...T.md, color: C.brandTx },
});
