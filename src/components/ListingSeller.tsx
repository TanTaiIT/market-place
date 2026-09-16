import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './ui';
import { useSellerProfile } from '@/queries/users';
import type { Listing } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Thẻ người bán ở trang chi tiết tin.
 *
 * Bản trước chỉ có tên + số điện thoại. Nhưng câu người mua thật sự hỏi trước khi nhắn cho một
 * người lạ là "người này có đáng tin không", và câu đó phải trả lời được NGAY TẠI ĐÂY — bắt họ
 * mở sang hồ sơ rồi bấm back là đúng chỗ người ta bỏ cuộc.
 *
 * Dữ liệu lấy từ `GET /users/:id` (công khai, khách chưa đăng nhập cũng đọc được) — không thêm
 * field nào ở BE, chỉ là ba con số vốn đã có mà màn này chưa hỏi tới.
 *
 * KHÔNG gọi khi tin là của chính mình: tự soi mình thì tab Cá nhân đã đủ và hơn hẳn, nên lượt
 * gọi đó chỉ là một request thừa mỗi lần chủ tin mở tin của họ.
 */
export function ListingSeller({ listing, onOpen }: { listing: Listing; onOpen: () => void }) {
  const { data: profile } = useSellerProfile(listing.mine ? '' : listing.sellerId);

  return (
    <Pressable
      disabled={listing.mine}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <Avatar
        text={listing.avatar}
        url={listing.avatarUrl}
        size={46}
        color={C.amber}
        textColor={C.amberInk}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.name}>
          {listing.seller}
        </Text>
        <Text numberOfLines={1} style={styles.sub}>
          {sellerSummary(profile, listing.contact)}
        </Text>
      </View>

      {!listing.mine && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

/**
 * Một dòng tóm tắt người bán, ghép từ thứ ĐANG CÓ.
 *
 * Người chưa ai đánh giá KHÔNG hiện "0,0 ★ · 0 đánh giá": một số 0 trông như điểm kém, trong
 * khi sự thật chỉ là chưa ai chấm — nói thẳng "Chưa có đánh giá" vừa đúng vừa không kết tội
 * người mới. Hồ sơ chưa về thì rơi về số điện thoại (thứ bản cũ vẫn hiện), rồi mới tới rỗng:
 * dòng này không bao giờ được nhảy từ có sang không có sau khi đã vẽ.
 */
function sellerSummary(
  profile: { rating: string; ratingCount: number; joined: string } | undefined,
  contact: string,
): string {
  if (!profile) return contact;

  const parts =
    profile.ratingCount > 0
      ? [`${profile.rating} ★`, `${profile.ratingCount} đánh giá`]
      : ['Chưa có đánh giá'];

  if (profile.joined) parts.push(`Tham gia ${profile.joined}`);
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  /*
   * KHÔNG có nền/bo góc/bóng riêng: từ khi trang chi tiết chia thành các khối rời trên nền xám,
   * chính khối đã là tấm thẻ. Giữ thêm một thẻ nữa ở đây là thẻ lồng trong thẻ — hai đường
   * viền cho một ranh giới, và khối người bán trông như bị thụt vào so với ba khối kia.
   */
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  sub: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 3 },
  chevron: { fontFamily: F.uiBold, fontSize: 20, color: C.inkSoft },
});
