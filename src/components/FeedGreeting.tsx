import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassSheen, glassFace } from './GlassSurface';
import { Avatar } from './ui';
import type { MyOrg } from '@/api/org';
import { gradOf, initialsOf } from '@/api/client';
import { squareUrl } from '@/api/cloudinary';
import { C, F, R } from '@/theme';

/**
 * Dòng chào + hàng nhóm của mình, nằm trên nền xanh của khối đầu bảng tin.
 *
 * Cả khối trả lời một câu hỏi: "tôi là ai và đang đứng ở đâu". Vì vậy hàng nhóm ở đây chứ không
 * xuống dưới cạnh hàng danh mục — chọn nhóm là đổi CHỖ ĐANG ĐỨNG, còn chọn danh mục là lọc trong
 * chỗ đó; xếp cạnh nhau thì hai phép lọc khác cấp trông như cùng một hàng công cụ.
 *
 * Khách (chưa đăng nhập) vẫn xem được bảng tin, nên khối này không chặn gì: nó chỉ đổi lời chào
 * và đưa MỘT lối vào đăng nhập, thay vì hai nút mà bấm cái nào cũng ra màn đăng nhập.
 */
export function FeedGreeting({
  me,
  myOrgs,
  onProfile,
  onSignIn,
  onSaved,
  onMyListings,
  onOrg,
  onFindOrg,
}: {
  /**
   * Người đang đăng nhập — `undefined` = khách.
   *
   * Ba mảnh danh tính đi CHUNG một object thay vì ba prop rời: chúng luôn cùng đến từ một
   * `profile`, và tách rời thì dựng được trạng thái không có thật — khách mà vẫn có avatar.
   * Đó đúng là lỗi bản trước: `avatar` là prop bắt buộc nên call-site phải bịa ra một dấu
   * chấm cho khách, và khối này vẽ nó ra thành một vòng tròn rỗng bấm được.
   */
  me?: { name: string; avatar: string; avatarUrl?: string };
  myOrgs: MyOrg[];
  onProfile: () => void;
  onSignIn: () => void;
  onSaved: () => void;
  onMyListings: () => void;
  onOrg: (slug: string) => void;
  onFindOrg: () => void;
}) {
  return (
    <>
      {/*
        MỘT nhánh cho cả hàng, không phải ba ternary trên ba mảnh.

        Khách và người đã đăng nhập khác nhau ở cả ba chỗ (avatar, lời chào, nút bên phải),
        nên tách ra ba phép rẽ là ba chỗ phải nhớ cùng một điều kiện — quên một chỗ thì ra
        đúng trạng thái lai đã có: avatar của người chưa đăng nhập.
      */}
      <View style={styles.hi}>
        {me ? (
          <>
            <Pressable onPress={onProfile} hitSlop={6}>
              <Avatar text={me.avatar} url={me.avatarUrl} size={40} ring />
            </Pressable>
            <View style={styles.hiText}>
              <Text style={styles.hiSmall}>Chào bạn</Text>
              <Text style={styles.hiName} numberOfLines={1}>
                {me.name}
              </Text>
            </View>
            <Icon glyph="♡" onPress={onSaved} />
            <Icon glyph="📋" onPress={onMyListings} />
          </>
        ) : (
          <>
            <View style={styles.hiText}>
              <Text style={styles.hiName}>Chào bạn 👋</Text>
              <Text style={styles.hiSmall}>Xem tin không cần đăng nhập</Text>
            </View>
            <Pressable
              onPress={onSignIn}
              style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
            >
              <Text style={styles.signInText}>Đăng nhập</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Luôn có "+ Tìm nhóm" kể cả khi chưa vào nhóm nào — đó là lúc lối đi ấy cần thiết nhất. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rail}
        contentContainerStyle={styles.orgRow}
        keyboardShouldPersistTaps="handled"
      >
        {myOrgs.map((o) => {
          const face = o.avatarUrl || o.coverUrl;
          return (
          <Pressable
            key={o.id}
            onPress={() => onOrg(o.id)}
            style={({ pressed }) => [styles.orgChip, pressed && styles.pressed]}
          >
            <GlassSheen />
            {/*
              Avatar thật nếu có, không thì ảnh bìa, cuối cùng mới là chấm màu suy từ slug.
              Chấm màu là thứ dựng được khi KHÔNG có ảnh nào — dùng nó cả khi nhóm đã có
              ảnh là vứt đi thứ duy nhất phân biệt được hai nhóm bằng mắt.
            */}
            {face ? (
              <Image source={{ uri: squareUrl(face, 60) }} style={styles.orgDot} />
            ) : (
              <View style={[styles.orgDot, styles.orgDotCenter, { backgroundColor: gradOf(o.id)[1] }]}>
                <Text style={styles.orgDotText}>{initialsOf(o.name)}</Text>
              </View>
            )}
            <Text numberOfLines={1} style={styles.orgChipText}>
              {o.name}
            </Text>
          </Pressable>
          );
        })}
        <Pressable
          onPress={onFindOrg}
          style={({ pressed }) => [styles.orgFind, pressed && styles.pressed]}
        >
          <Text style={styles.orgFindText}>+ Tìm nhóm</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function Icon({ glyph, onPress }: { glyph: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      <GlassSheen />
      <Text style={styles.iconText}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * React Native gán sẵn `flexGrow: 1, flexShrink: 1` cho MỌI ScrollView (`ScrollView.js` →
   * `baseHorizontal`). Khối đầu là một cột, nên thiếu dòng này thì hàng cuộn co giãn tranh chỗ
   * với dòng chào và thẻ tìm.
   */
  rail: { flexGrow: 0, flexShrink: 0 },
  hi: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  // `flex: 1` để dòng tên nuốt hết chỗ giữa avatar và hai nút — có nó thì `numberOfLines` mới cắt
  // được tên dài, thiếu nó thì tên đẩy hai nút ra khỏi màn.
  hiText: { flex: 1 },
  hiSmall: { fontFamily: F.ui, fontSize: 11.5, color: C.glassTx },
  hiName: { fontFamily: F.uiBold, fontSize: 16.5, color: C.paperWarm },
  icon: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    ...glassFace,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 15, color: C.paperWarm },
  signIn: {
    backgroundColor: C.paperWarm,
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.brandTx },
  orgRow: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingLeft: 16, paddingRight: 4 },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 175,
    ...glassFace,
    borderRadius: R.pill,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
  },
  orgDot: { width: 20, height: 20, borderRadius: 10 },
  orgDotCenter: { alignItems: 'center', justifyContent: 'center' },
  /** Hai chữ trong vòng 20px: nhỏ nhất còn đọc được, và chỉ là bậc cuối khi không có ảnh. */
  orgDotText: { fontFamily: F.uiBold, fontSize: 8.5, color: '#fff' },
  orgChipText: { flexShrink: 1, fontFamily: F.uiBold, fontSize: 12, color: C.paperWarm },
  orgFind: {
    borderRadius: R.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: C.glassLine,
  },
  orgFindText: { fontFamily: F.uiBold, fontSize: 12, color: C.paperWarm },
  pressed: { opacity: 0.75 },
});
