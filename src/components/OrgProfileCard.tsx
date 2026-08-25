import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  busy,
}: {
  org: OrgProfile;
  members: Member[];
  onJoin: () => void;
  onInvite: () => void;
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
                <Avatar text={m.avatar} size={28} />
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
  cover: { height: 130, width: '100%' },
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
  rule: { flexDirection: 'row', gap: 9, marginTop: 9 },
  rulePin: { fontSize: 10, marginTop: 3 },
  ruleText: { flex: 1, fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.inkSoft },
});
