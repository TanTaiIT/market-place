import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './ui';
import { initialsOf } from '@/api/client';
import type { ListingOrg as Org } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Nhóm mà tin được đăng trong đó — khối "đăng ở đâu" của trang chi tiết.
 *
 * Đứng riêng khỏi `ListingSeller` vì nó trả lời một câu khác: người bán là AI, nhóm là NƠI tin
 * sống. Dưới thang phủ sóng, một tin có thể vừa nằm trong bảng tin nhóm vừa nằm trên bảng tin
 * chung — nên "nơi" không còn suy được ra từ chỗ người xem đang đứng.
 *
 * Dữ liệu là `listing.org`, do BE tra sẵn theo lô. Component KHÔNG tự hỏi tên nhóm: cách đó chỉ
 * chạy với thành viên, tức là câm với đúng người cần nó nhất — người ngoài vừa thấy tin này
 * trên bảng tin chung.
 */
export function ListingOrg({ org, onOpen }: { org: Org; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <Avatar
        text={initialsOf(org.name)}
        url={org.avatarUrl ?? undefined}
        size={38}
        color={C.moss}
        textColor="#fff"
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>ĐĂNG TRONG NHÓM</Text>
        <Text numberOfLines={1} style={styles.name}>
          {org.name}
        </Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Cùng khuôn với `ListingSeller`: không nền, không bo góc riêng — khối bao ngoài đã là thẻ.
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.1, color: C.moss },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.ink, marginTop: 3 },
  chevron: { fontFamily: F.uiBold, fontSize: 20, color: C.inkSoft },
});
