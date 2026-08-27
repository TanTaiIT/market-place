import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { initialsOf } from '@/api/client';
import { Avatar } from './ui';
import type { Member, OrgProfile } from '@/api/org';
import { C, F, shadow } from '@/theme';

/**
 * Thẻ đầu hồ sơ nhóm: ảnh bìa, tên, số liệu, mô tả, hàng avatar, hai nút hành động.
 *
 * Tách khỏi route vì route chạm trần 250 dòng (HARD#11), và khối này thuần trình bày: mọi
 * quyết định (ai xem được gì, gọi endpoint nào) ở lại màn hình.
 */
export function Header({
  org,
  members,
  onJoin,
  onInvite,
  onEdit,
  onPost,
  busy,
}: {
  org: OrgProfile;
  members: Member[];
  onJoin: () => void;
  onInvite: () => void;
  /** Chỉ truyền khi người xem là quản trị nhóm — `undefined` thì hàng nút không dựng ô sửa. */
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
        <Image source={{ uri: org.coverUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, { backgroundColor: C.moss }]} />
      )}

      <View style={[styles.card, styles.overCover, styles.inset]}>
        <Text style={styles.name}>{org.name}</Text>
        <Text style={styles.meta}>
          🌐 Công khai · {org.memberCount.toLocaleString('vi-VN')} thành viên ·{' '}
          {org.postsThisWeek} tin/tuần · {org.joinCode}
          {where ? ` · ${where}` : ''}
        </Text>

        {!!org.description && <Text style={styles.desc}>{org.description}</Text>}

        {/* Chỉ dựng khi ĐÃ vào nhóm: danh bạ đòi tư cách thành viên, người ngoài gọi vào chỉ
            nhận 403 — nên `useOrgPeek` không bay và mảng này rỗng. */}
        {members.length > 0 && (
          <View style={styles.faces}>
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
          </View>
        )}

        <View style={styles.acts}>
          {org.joined ? (
            <View style={[styles.btn, styles.btnDone]}>
              <Text style={styles.btnDoneText}>✓ Đã tham gia</Text>
            </View>
          ) : (
            <Pressable
              onPress={onJoin}
              disabled={busy || !org.allowJoinRequests}
              style={({ pressed }) => [
                styles.btn,
                styles.btnJoin,
                !org.allowJoinRequests && styles.btnOff,
                pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
              ]}
            >
              <Text style={styles.btnJoinText}>
                {org.allowJoinRequests ? 'Xin vào nhóm' : 'Nhóm đang không nhận đơn'}
              </Text>
            </Pressable>
          )}

          {/* Mời = chia sẻ MÃ. Nhóm công khai xin vào được bằng slug, nhưng mã vẫn là lối gõ
              nhanh và là thứ duy nhất dùng được nếu nhóm chuyển sang riêng tư sau này. */}
          <Pressable onPress={onInvite} style={({ pressed }) => [styles.invite, pressed && { opacity: 0.7 }]}>
            <Text style={styles.inviteText}>Mời</Text>
          </Pressable>
        </View>

        {/*
          Đăng tin VÀO nhóm này. Đứng ngay dưới hàng tham gia vì đó là việc chính người ta
          làm sau khi đã vào nhóm — và nó tránh hẳn đường vòng cũ: đổi "nhóm đang thao tác"
          ở trang cá nhân rồi mới bấm nút đăng chung, một quy trình không ai đoán ra được.
        */}
        {!!onPost && (
          <Pressable
            onPress={onPost}
            style={({ pressed }) => [styles.post, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.postText}>📌 Đăng tin vào nhóm này</Text>
          </Pressable>
        )}

        {/*
          Quản trị nhóm. Nằm TRONG thẻ thông tin vì nó sửa đúng những gì thẻ này đang hiện —
          tên, mô tả, ảnh bìa, nội quy. Tách ra thành thẻ riêng thì nó đọc như một mục lạ chen
          giữa hồ sơ và danh sách tin.
          Một dòng dưới vạch kẻ, KHÔNG phải nút thứ ba trong hàng trên: "Đã tham gia" và "Mời"
          là việc của người xem nhóm, còn đây là việc của người quản nhóm — nhồi chung một hàng
          thì trên máy 360dp cả ba đều bị bóp đến mức không đọc nổi.
        */}
        {!!onEdit && (
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [styles.editRow, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.editText}>✎ Sửa thông tin nhóm</Text>
            <Text style={styles.editHint}>ảnh bìa · giới thiệu · nội quy</Text>
          </Pressable>
        )}
      </View>

      {org.rules.length > 0 && (
        <View style={[styles.card, styles.inset, styles.stack]}>
          <Text style={styles.section}>NỘI QUY NHÓM</Text>
          {org.rules.map((rule) => (
            <View key={rule} style={styles.rule}>
              <Text style={styles.rulePin}>📌</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.section, styles.inset, styles.stack]}>TIN TRONG NHÓM</Text>
    </View>
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
  card: { backgroundColor: C.paperWarm, borderRadius: 10, padding: 18, gap: 9, ...shadow },
  /** Đè lên mép dưới ảnh bìa, đúng cách thẻ nổi trên nền trong bản thiết kế. */
  overCover: { marginTop: -22 },
  /*
   * LỀ NGOÀI, không phải đệm trong. `paddingHorizontal` chỉ đẩy nội dung vào trong khi thẻ
   * vẫn chạm hai mép màn hình — đúng lỗi bản trước: thẻ trông như một dải trắng full-width
   * chứ không phải tấm thẻ nổi trên nền.
   */
  inset: { marginHorizontal: 14 },
  faces: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  /** Viền cùng màu nền thẻ để các avatar chồng lên nhau vẫn tách bạch. */
  face: { borderWidth: 2, borderColor: C.paperWarm, borderRadius: 999 },
  facesText: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginLeft: 9 },
  /** Kalam như mọi tiêu đề khác của app — nhóm là một cái tên, không phải một nhãn dữ liệu. */
  name: { fontFamily: F.hand, fontSize: 23, lineHeight: 30, color: C.ink },
  meta: { fontFamily: F.mono, fontSize: 10.5, lineHeight: 16, color: C.moss },
  desc: { fontFamily: F.ui, fontSize: 13.5, lineHeight: 20, color: C.inkSoft, marginTop: 2 },

  acts: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  btnJoin: { backgroundColor: C.pin, borderBottomWidth: 3, borderBottomColor: C.pinDark },
  btnOff: { backgroundColor: C.muted, borderBottomColor: C.inkSoft },
  btnJoinText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  btnDone: { backgroundColor: C.mossLight, borderWidth: 1, borderColor: C.moss },
  btnDoneText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.moss },
  invite: {
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: C.pin,
    borderStyle: 'dashed',
  },
  inviteText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.pin },

  section: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    letterSpacing: 0.5,
    color: C.inkSoft,
  },
  /** Khoảng cách giữa các khối của phần đầu — thay cho `gap` đã bỏ ở wrapper. */
  stack: { marginTop: 14 },
  /*
   * Vạch kẻ chỉ dài bằng phần nội dung thẻ (thẻ có `padding: 18`), đúng kiểu vạch phân mục
   * bên trong một thẻ — kéo hết bề ngang sẽ trông như thẻ bị cắt làm hai.
   */
  post: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: C.moss,
  },
  postText: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  editRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 13,
    marginTop: 5,
  },
  editText: { fontFamily: F.uiBold, fontSize: 13, color: C.moss },
  editHint: { fontFamily: F.mono, fontSize: 9.5, color: C.inkSoft },
  rule: { flexDirection: 'row', gap: 9, marginTop: 9 },
  rulePin: { fontSize: 10, marginTop: 3 },
  ruleText: { flex: 1, fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.inkSoft },
});
