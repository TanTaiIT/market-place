import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn } from '@/components/AdminPicker';
import { Avatar, EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { initialsOf } from '@/api/client';
import { useOrgRoster, useRemoveMember } from '@/queries/org';
import type { Member } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Danh bạ thành viên của tổ chức đang thao tác — ai đang ở trong nhóm, và gỡ người ra.
 *
 * Trước màn này, vòng đời thành viên chỉ có chiều VÀO: duyệt đơn, nhận lời mời, master trao
 * quyền chủ. Chiều ra thì không có đường nào ngoài xoá tài khoản, nên một người vào nhầm nhóm
 * sẽ ở lại đó vĩnh viễn cùng quyền đọc mọi tin nội bộ.
 *
 * KHÔNG phải màn phân quyền: `role` ở đây là THÂN PHẬN hiển thị (`MEMBERSHIP_ROLES`), không
 * phải quyền hạn. Ai duyệt được tin, ai sửa được nhóm — tất cả nằm ở `role_grants`, màn Phân
 * quyền. Gộp hai thứ vào một bảng là chỗ dễ cấp nhầm quyền nhất trong cả hệ thống.
 */

const ROLE_LABEL: Record<Member['role'], string> = {
  admin: 'Quản trị',
  member: 'Thành viên',
  alumni: 'Cựu thành viên',
};

export default function AdminMembers() {
  const toast = useToast();
  const roster = useOrgRoster();
  const remove = useRemoveMember();

  const confirmRemove = (m: Member) =>
    // Gỡ người là thao tác CẮT quyền đọc mọi tin nội bộ của họ, có hiệu lực ngay — cùng hạng
    // với khoá tổ chức, nên nó hỏi lại.
    Alert.alert(
      'Gỡ khỏi nhóm?',
      `${m.name} sẽ mất quyền xem tin nội bộ ngay lập tức. Họ vẫn xin vào lại được.`,
      [
        { text: 'Thôi', style: 'cancel' },
        {
          text: 'Gỡ',
          style: 'destructive',
          onPress: () =>
            remove.mutate(m.userId, {
              onSuccess: () => toast(`✓ Đã gỡ ${m.name} khỏi nhóm`),
              onError: (e: Error) => toast(`⚠️ ${e.message}`),
            }),
        },
      ],
    );

  return (
    <AdminScreen title="Thành viên" note="ai đang ở trong nhóm" org>
      <ScrollView contentContainerStyle={styles.body}>
        {roster.isLoading ? (
          <Loading onDark />
        ) : roster.members.length === 0 ? (
          <EmptyState icon="👥" onDark text="Nhóm chưa có thành viên nào." />
        ) : (
          <View style={{ gap: 10 }}>
            {roster.members.map((m) => (
              <View key={m.userId} style={styles.row}>
                <View style={styles.head}>
                  <Avatar text={initialsOf(m.name)} url={m.avatar || undefined} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.name}>
                      {m.name}
                    </Text>
                    <Text style={styles.meta}>
                      {ROLE_LABEL[m.role]}
                      {m.trustLevel !== undefined ? ` · uy tín ${m.trustLevel}` : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.acts}>
                  <AdminSmallBtn label="Gỡ khỏi nhóm" onPress={() => confirmRemove(m)} />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.note}>
          Đây là danh bạ, không phải phân quyền. Ai duyệt được tin hay sửa được nhóm nằm ở màn
          Phân quyền — đổi nhóm con ở đây không cấp thêm quyền nào.
        </Text>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32, paddingTop: 12 },
  row: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  meta: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim, marginTop: 3 },
  acts: { flexDirection: 'row', gap: 7 },
  note: {
    fontFamily: F.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.deskTxtDim,
    marginTop: 18,
  },
});
