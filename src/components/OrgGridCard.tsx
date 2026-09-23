import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OrgFace } from './OrgFace';
import { C, F, R, S, T, shadow } from '@/theme';

/**
 * Thẻ nhóm trong LƯỚI hai cột của màn "Nhóm" — ảnh lớn ở trên, thông tin ở dưới.
 *
 * MỘT thẻ cho cả hai mục, "Nhóm của bạn" lẫn "Gợi ý cho bạn". Trước đây nhóm mình là thẻ dòng
 * 52px còn gợi ý là lưới ảnh lớn, với lý do "nhóm mình chỉ cần nhận ra". Lý do đó đúng nhưng
 * cái giá là hai hình dạng cho cùng một loại vật trên cùng một màn — người dùng đọc ra là hai
 * LOẠI nhóm, không phải hai trạng thái của một loại. Cùng thẻ, chỉ khác chân thẻ (nút Tham gia
 * hay nhãn vai) thì đúng nghĩa hơn.
 *
 * Số liệu là TUỲ CHỌN vì hai mục có hai nguồn: `/organizations/lookup` trả số thành viên và mã,
 * `/organizations/mine` thì không. Ép một kiểu chung là chỗ thiếu phải bịa `memberCount: 0`,
 * và con số bịa đó hiện thẳng lên mặt người dùng. Ô nào vắng thì không vẽ.
 *
 * Số liệu là các Ô RỜI, không phải một chuỗi nối bằng `·`: trong cột rộng ~170px, chuỗi nối bị
 * cắt ở dòng thứ hai và mất gần hết.
 */
export type OrgGridCardProps = {
  /** Khoá của dải màu dự phòng — cùng nhóm thì luôn ra cùng màu giữa các lần mở. */
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Dự phòng khi nhóm chưa đặt avatar — nhóm có bìa trước avatar là ca thường gặp nhất. */
  coverUrl?: string | null;
  memberCount?: number;
  where?: string;
  joinCode?: string;
  /**
   * `joined` = nhóm mình đã ở trong: chân thẻ là NHÃN VAI (`role`), không có nút. Hai giá trị
   * còn lại là nhóm ngoài — `closed` vẫn hiện nhưng nút không bấm được.
   */
  action: 'join' | 'closed' | 'joined';
  /** Chỉ đọc khi `action === 'joined'`: "Quản trị nhóm" / "Thành viên". */
  role?: string;
  /** Ổ khoá góc ảnh. Người gọi quyết định khi nào — xem `find-org.tsx`. */
  locked?: boolean;
  onPress: () => void;
  /** Bỏ trống với `joined` — không có gì để tham gia nữa. */
  onJoin?: () => void;
};

export function OrgGridCard({
  id,
  name,
  avatarUrl,
  coverUrl,
  memberCount,
  where,
  joinCode,
  action,
  role,
  locked,
  onPress,
  onJoin,
}: OrgGridCardProps) {
  const hasStats = memberCount !== undefined || !!where;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {/* Chuỗi avatar → bìa → chữ viết tắt do `OrgFace` giữ, cùng một bản với dải "Nhóm quanh
          bạn" — xem docblock của nó. */}
      <View>
        <OrgFace
          seed={id}
          name={name}
          avatarUrl={avatarUrl}
          coverUrl={coverUrl}
          style={styles.photo}
          initialsSize={40}
        />
        {locked && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔒 Cần mã</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>
          {name}
        </Text>

        {hasStats && (
          <View style={styles.stats}>
            {memberCount !== undefined && (
              <Text style={styles.stat}>👥 {memberCount.toLocaleString('vi-VN')}</Text>
            )}
            {!!where && (
              <Text numberOfLines={1} style={[styles.stat, styles.statWhere]}>
                📍 {where}
              </Text>
            )}
          </View>
        )}

        {!!joinCode && <Text style={styles.code}>{joinCode}</Text>}

        {action === 'joined' ? (
          // Nhãn chứ không phải nút mờ: một hình nút không bấm được là thứ người ta cứ thử bấm.
          <View style={[styles.foot, styles.footJoined]}>
            <Text style={styles.footJoinedText}>✓ {role ?? 'Thành viên'}</Text>
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
              styles.foot,
              styles.join,
              action === 'closed' && styles.joinOff,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.joinText, action === 'closed' && styles.joinOffText]}>
              {action === 'closed' ? 'Tạm đóng' : 'Tham gia'}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* `flex: 1` để hai thẻ trong một hàng chia đôi bề ngang còn lại sau `gap` của hàng. */
  card: {
    flex: 1,
    backgroundColor: C.paperWarm,
    borderRadius: R.lg,
    overflow: 'hidden',
    ...shadow,
  },
  photo: { width: '100%', aspectRatio: 1 },
  /*
   * Nhãn nằm ĐÈ lên đáy ảnh, bo góc phải — đúng vị trí quen thuộc của nhãn khuyến mãi trên
   * thẻ hàng. Đặt dưới ảnh thì nó ăn thêm một dòng chiều cao của mọi thẻ, kể cả thẻ không có
   * nhãn. Lớp phủ tuyệt đối chứ không phải con của `OrgFace`: nhánh chữ viết tắt của component
   * đó canh giữa nội dung, nên một cái nhãn nhét vào trong sẽ đẩy chữ viết tắt lệch khỏi tâm.
   */
  badge: {
    position: 'absolute',
    left: 0,
    bottom: S.sm,
    backgroundColor: C.orange,
    borderTopRightRadius: R.sm,
    borderBottomRightRadius: R.sm,
    paddingHorizontal: S.sm,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: F.uiBold, ...T.xs, color: C.paperWarm },

  body: { padding: S.md, gap: 6 },
  /** `minHeight` hai dòng: tên một dòng và tên hai dòng phải cho ra thẻ cao bằng nhau, nếu
      không hai cột cạnh nhau lệch đáy và chân thẻ không thẳng. */
  name: { fontFamily: F.uiBold, ...T.sm, color: C.ink, minHeight: 38 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  stat: { fontFamily: F.ui, ...T.xs, color: C.inkSoft },
  /** Chỉ ô địa điểm co lại: số thành viên ngắn và luôn phải đọc được trọn vẹn. */
  statWhere: { flexShrink: 1 },
  code: { fontFamily: F.mono, ...T.xs, color: C.muted },

  /** Chân thẻ chung một khuôn cho cả nút lẫn nhãn, để hai mục cạnh nhau thẳng đáy. */
  foot: { marginTop: 2, borderRadius: R.md, paddingVertical: 9, alignItems: 'center' },
  join: { backgroundColor: C.brandLt },
  joinText: { fontFamily: F.uiBold, ...T.sm, color: C.brandTx },
  joinOff: { backgroundColor: C.chipIdle },
  joinOffText: { color: C.muted },
  /** Nhạt hơn nút Tham gia một bậc: đây là trạng thái đã xong, không mời bấm. */
  footJoined: { backgroundColor: C.chipIdle },
  footJoinedText: { fontFamily: F.uiBold, ...T.sm, color: C.inkSoft },
});
