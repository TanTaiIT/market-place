import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { initialsOf } from '@/api/client';
import { displayUrl } from '@/api/cloudinary';
import { Avatar, PinButton } from './ui';
import { SectionHead } from './SectionHead';
import type { Member, OrgProfile } from '@/api/org';
import { C, F, R, S, T, shadow } from '@/theme';

/**
 * Phần đầu hồ sơ nhóm: ảnh bìa, thẻ nhận dạng, hàng hành động, giới thiệu, nội quy.
 *
 * Tách khỏi route vì route chạm trần 250 dòng (HARD#11), và khối này thuần trình bày: mọi
 * quyết định (ai xem được gì, gọi endpoint nào) ở lại màn hình.
 *
 * **Bố cục theo một luật: mỗi màn MỘT nút chính.** Bản trước xếp ba nút tràn ngang chồng lên
 * nhau — "Xin vào nhóm", "Đăng tin vào nhóm này", cộng nút "Mời" viền đứt cạnh nút đầu — nên
 * không cái nào nổi lên, và người mở hồ sơ để quyết định có vào nhóm hay không phải tự tìm ra
 * đâu là việc chính. Giờ chỉ "Xin vào nhóm" giữ hình nút; đăng tin, mời, sửa hạ xuống hàng chip
 * nhẹ bên dưới — chúng là việc làm SAU khi đã vào, không phải việc của lần mở đầu tiên.
 */
export function Header({
  org,
  members,
  onJoin,
  onInvite,
  onEdit,
  onPost,
  onOpenMembers,
  busy,
}: {
  org: OrgProfile;
  members: Member[];
  onJoin: () => void;
  onInvite: () => void;
  /** Mở danh bạ nhóm. Chỉ tới được khi đã tham gia — người ngoài không có hàng mặt người nào. */
  onOpenMembers: () => void;
  /** Chỉ truyền khi người xem là quản trị nhóm — `undefined` thì hàng chip không dựng ô sửa. */
  onEdit?: () => void;
  /** Chỉ truyền khi nhóm này NHẬN được tin từ người đang xem — xem `index.tsx`. */
  onPost?: () => void;
  busy: boolean;
}) {
  const where = [org.district, org.provinceCode].filter(Boolean).join(', ');

  return (
    <View>
      {/* `coverUrl` có thì vẽ ảnh, không thì một dải màu — không dựng khung ảnh rỗng. */}
      {org.coverUrl ? (
        <Image
          source={{ uri: displayUrl(org.coverUrl, 800) }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cover, { backgroundColor: C.brand }]} />
      )}

      {/*
        Thẻ nhận dạng: logo BÊN TRÁI tên, không phải phía trên nó.
        Bản trước đặt avatar đè lên mép thẻ rồi tên xuống dòng dưới — đẹp nhưng ngốn ~90px chiều
        cao cho hai thông tin, mà đây là màn người ta cuộn để đọc tin. Xếp ngang thì cùng lượng
        thông tin đó gói trong một khối cao 64px, và ảnh bìa không còn bị thẻ ăn mất một khúc.
      */}
      <View style={[styles.card, styles.overCover, styles.inset, styles.idRow]}>
        <Avatar text={initialsOf(org.name)} url={org.avatarUrl ?? undefined} size={62} />
        <View style={styles.idText}>
          <Text numberOfLines={2} style={styles.name}>
            {org.name}
          </Text>
          {/*
            Số liệu tách thành DÒNG RIÊNG, không còn nối bằng `·` vào một chuỗi mono 10.5px.
            Chuỗi cũ nhét năm thứ — công khai, số thành viên, tin/tuần, mã tham gia, địa điểm —
            vào một dòng, và trên máy 360dp nó xuống ba dòng mono dày đặc mà không ai đọc hết.
          */}
          <Text style={styles.stat}>
            {org.memberCount.toLocaleString('vi-VN')} thành viên · {org.postsThisWeek} tin/tuần
          </Text>
          {!!where && (
            <Text numberOfLines={1} style={styles.stat}>
              📍 {where}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.inset, styles.stack]}>
        {org.joined ? (
          // Đã vào nhóm thì đây không còn là hành động, chỉ là trạng thái — nên nó là viên nhãn
          // chứ không phải một hình nút không bấm được, thứ luôn khiến người ta thử bấm.
          <View style={styles.joined}>
            <Text style={styles.joinedText}>✓ Bạn là thành viên</Text>
          </View>
        ) : (
          /*
            `PinButton` — cùng nút chính với mọi màn khác của app.
            Bản trước tự dựng nút riêng tô `C.pin`, mà `pin` là `#FF4D4D` và theme ghi thẳng
            "Màu cảnh báo/chú ý. KHÔNG phải màu thương hiệu" — nó trùng byte với `C.danger`.
            Nên hành động thuận nhất của trang mang đúng màu của nút Xoá.
          */
          <PinButton
            label={org.allowJoinRequests ? 'Xin vào nhóm' : 'Nhóm đang không nhận đơn'}
            tone="ok"
            onPress={onJoin}
            disabled={!org.allowJoinRequests}
            loading={busy}
          />
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {!!onPost && <ActionChip icon="📌" label="Đăng tin" onPress={onPost} />}
          {/* Mời = chia sẻ MÃ. Nhóm công khai xin vào được bằng id, nhưng mã vẫn là lối gõ
              nhanh và là thứ duy nhất dùng được nếu nhóm chuyển sang riêng tư sau này. */}
          <ActionChip icon="🔗" label="Mời" onPress={onInvite} />
          {!!onEdit && <ActionChip icon="✎" label="Sửa nhóm" onPress={onEdit} />}
        </ScrollView>

        {/* Mã vẫn phải ĐỌC được, không chỉ chia sẻ được: người ta hay đọc mã cho nhau nghe. Nhưng
            nó là tra cứu, không phải nhận dạng — nên ra khỏi dòng tên, xuống đây. */}
        <Text style={styles.code}>Mã tham gia · {org.joinCode}</Text>
      </View>

      {(!!org.description || members.length > 0) && (
        <View style={[styles.inset, styles.stack]}>
          <SectionHead title="Giới thiệu" />
          <View style={styles.card}>
            {!!org.description && <Text style={styles.desc}>{org.description}</Text>}

            {/* Chỉ dựng khi ĐÃ vào nhóm: danh bạ đòi tư cách thành viên, người ngoài gọi vào chỉ
                nhận 403 — nên `useOrgPeek` không bay và mảng này rỗng. */}
            {/*
              Hàng mặt người là LỐI VÀO danh bạ, không phải hình trang trí. Trước đây nó hiện
              "Bạn và N người khác" mà N không dẫn tới đâu cả — câu đó tự nó là một lời hứa.
            */}
            {members.length > 0 && (
              <Pressable
                onPress={onOpenMembers}
                style={({ pressed }) => [
                  styles.faces,
                  !!org.description && { marginTop: S.md },
                  pressed && { opacity: 0.65 },
                ]}
              >
                {members.map((m, i) => (
                  <View key={m.userId} style={[styles.face, i > 0 && { marginLeft: -9 }]}>
                    {/*
                      `Member.avatar` của BE là URL Cloudinary, KHÔNG phải chữ viết tắt — nó lấy
                      thẳng `User.avatar`. Trước đây chỗ này truyền nó vào `text`, nên ai đã đặt
                      ảnh sẽ hiện hai ký tự đầu của đường dẫn thay vì mặt mình.
                      Chữ viết tắt dựng từ `name`, đúng cách mọi DTO khác làm ở `client.ts`.
                    */}
                    <Avatar text={initialsOf(m.name)} url={m.avatar || undefined} size={28} />
                  </View>
                ))}
                <Text style={styles.facesText}>
                  Bạn và {Math.max(0, org.memberCount - 1).toLocaleString('vi-VN')} người khác
                </Text>
                <Text style={styles.facesChevron}>›</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {org.rules.length > 0 && (
        <View style={[styles.inset, styles.stack]}>
          <SectionHead title="Nội quy nhóm" />
          <View style={styles.card}>
            {org.rules.map((rule, i) => (
              <View key={rule} style={[styles.rule, i > 0 && { marginTop: S.md }]}>
                <Text style={styles.rulePin}>📌</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.inset, styles.stack]}>
        <SectionHead title="Tin trong nhóm" />
      </View>
    </View>
  );
}

/** Hành động phụ. Viền mảnh, nền trắng — cố ý lùi hẳn sau nút chính ngay phía trên. */
function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.65 }]}
    >
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * 16:9 theo bề ngang màn hình, không phải chiều cao cố định.
   *
   * `height: 130` cũ cho ra một dải dẹt trên máy nào cũng vậy, và nó KHÔNG khớp khổ ảnh mà
   * màn sửa ép người dùng cắt (`aspect: [16, 9]`) — ảnh họ vừa canh xong bị cắt lại lần nữa.
   * Tính theo tỉ lệ thì hai đầu nói cùng một khổ.
   */
  cover: { width: '100%', aspectRatio: 16 / 9 },
  card: { backgroundColor: C.paperWarm, borderRadius: R.lg, padding: S.lg, ...shadow },
  /** Đè lên mép dưới ảnh bìa, đúng cách thẻ nổi trên nền trong bản thiết kế. */
  overCover: { marginTop: -28 },
  /*
   * LỀ NGOÀI, không phải đệm trong. `paddingHorizontal` chỉ đẩy nội dung vào trong khi thẻ
   * vẫn chạm hai mép màn hình — đúng lỗi bản trước: thẻ trông như một dải trắng full-width
   * chứ không phải tấm thẻ nổi trên nền.
   */
  inset: { marginHorizontal: 14 },
  /** Khoảng cách giữa các khối của phần đầu. */
  stack: { marginTop: S.lg },

  idRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  idText: { flex: 1, minWidth: 0 },
  name: { fontFamily: F.uiBold, ...T.lg, color: C.ink },
  stat: { fontFamily: F.ui, ...T.xs, color: C.inkSoft, marginTop: 2 },

  joined: {
    alignSelf: 'flex-start',
    backgroundColor: C.brandLt,
    borderRadius: R.pill,
    paddingHorizontal: S.md,
    paddingVertical: 7,
  },
  joinedText: { fontFamily: F.uiBold, ...T.sm, color: C.brandTx },

  chipRow: { flexDirection: 'row', gap: S.sm, paddingTop: S.md, paddingRight: S.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontFamily: F.uiBold, ...T.sm, color: C.ink },
  code: { fontFamily: F.mono, ...T.xs, color: C.muted, marginTop: S.md },

  desc: { fontFamily: F.ui, ...T.sm, color: C.inkSoft },
  faces: { flexDirection: 'row', alignItems: 'center' },
  /** Viền cùng màu nền thẻ để các avatar chồng lên nhau vẫn tách bạch. */
  face: { borderWidth: 2, borderColor: C.paperWarm, borderRadius: 999 },
  facesText: { flex: 1, fontFamily: F.ui, ...T.xs, color: C.inkSoft, marginLeft: 9 },
  facesChevron: { fontFamily: F.uiBold, fontSize: 18, color: C.muted },

  rule: { flexDirection: 'row', gap: 9 },
  rulePin: { fontSize: 10, marginTop: 3 },
  ruleText: { flex: 1, fontFamily: F.ui, ...T.sm, color: C.inkSoft },
});
