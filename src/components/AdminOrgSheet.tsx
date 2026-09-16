import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Loading, PagedFooter, nearEnd } from './ui';
import { initialsOf } from '@/api/client';
import { useOrgManagers, useOrgMemberList } from '@/queries/org-admin';
import type { Organization } from '@/api/org-admin';
import { C, F } from '@/theme';

/**
 * Chi tiết một tổ chức — ngăn trượt từ dưới, mở từ bảng tổ chức của master.
 *
 * Đây là thứ thay cho nút "Thao tác trong" của bản trước. Nút đó chuyển org đang thao tác của
 * cả app rồi để master đi vòng qua nhóm menu TỔ CHỨC để xem danh bạ — mà nhóm menu đó nay không
 * còn hiện với master nữa. Ngăn này trả lời cùng câu hỏi tại chỗ, và không đổi chỗ đứng của
 * người đang xem: hai query bên dưới gắn org vào từng lượt gọi, không vào trạng thái của app.
 *
 * `org = null` để đóng, cùng lối `AdminListingSheet`: một nguồn sự thật, không dựng được trạng
 * thái "mở nhưng không có tổ chức nào".
 */

const STATUS_LABEL: Record<Organization['status'], string> = {
  active: 'Đang mở',
  suspended: 'Đang khoá',
  pending_admin: 'Chờ trao quyền',
};

const ORG_TYPE_LABEL: Record<Organization['orgType'], string> = {
  school: 'Trường học',
  company: 'Doanh nghiệp',
  community: 'Cộng đồng',
  generic: 'Khác',
};

const TIER_LABEL: Record<Organization['verificationTier'], string> = {
  unverified: 'Chưa xác minh',
  claimed: 'Đã nhận quản lý',
  verified: 'Đã xác minh',
};

const ROLE_LABEL: Record<'admin' | 'member' | 'alumni', string> = {
  admin: 'Quản trị',
  member: 'Thành viên',
  alumni: 'Cựu thành viên',
};

export function AdminOrgSheet({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  /*
   * `useSafeAreaInsets()` chứ KHÔNG `<SafeAreaView>` — bên trong `<Modal>` thì component đó
   * báo insets bằng 0, còn hook thì vẫn đúng vì React context đi xuyên được Modal.
   */
  const insets = useSafeAreaInsets();

  /*
   * Hook phải gọi TRƯỚC mọi nhánh return (luật hooks), nên khoá bằng chuỗi rỗng thay vì bằng
   * điều kiện: ngăn đóng thì `enabled: false` và không lượt nào bay đi.
   */
  const managers = useOrgManagers(org?.id ?? '');
  const members = useOrgMemberList(org?.slug ?? '');

  return (
    <Modal visible={!!org} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      {!!org && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>Chi tiết tổ chức</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            // Danh bạ ở cuối ngăn tải theo trang — dò đáy để lấy trang sau.
            onScroll={(e) => nearEnd(e) && members.loadMore()}
            scrollEventThrottle={160}
          >
            <View style={styles.identity}>
              <Avatar
                text={initialsOf(org.name)}
                url={org.avatarUrl ?? undefined}
                size={52}
                color={C.mossDeep}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{org.name}</Text>
                <Text style={styles.slug}>
                  /{org.slug} · {STATUS_LABEL[org.status]}
                  {org.isPublic ? '' : ' · 🙈 riêng tư'}
                </Text>
              </View>
            </View>

            {!!org.description && <Text style={styles.desc}>{org.description}</Text>}

            <View style={styles.dl}>
              <Row label="Loại" value={ORG_TYPE_LABEL[org.orgType]} />
              <Row label="Xác minh" value={TIER_LABEL[org.verificationTier]} />
              <Row label="Tỉnh / thành" value={org.provinceCode ?? '—'} />
              <Row label="Mã tham gia" value={org.joinCode} mono />
            </View>

            {/*
              Người phụ trách đọc từ `role_grants`, KHÔNG từ `role` trong danh bạ bên dưới — xem
              `orgAdminApi.managers`. Hai nguồn lệch được, và đúng lúc lệch thì danh bạ nói sai.
            */}
            <Section title="Người phụ trách" note="quyền thật, đọc từ phân quyền" />
            {managers.isLoading ? (
              <Loading onDark />
            ) : managers.error ? (
              <Text style={styles.bad}>{(managers.error as Error).message}</Text>
            ) : (managers.data ?? []).length === 0 ? (
              <Text style={styles.warn}>
                ⚠️ Nhóm này không còn ai phụ trách. Hàng đợi duyệt tin, báo cáo và đơn gia nhập
                của nó hiện không ai xử lý — trao lại quyền ở bàn Phân quyền.
              </Text>
            ) : (
              (managers.data ?? []).map((m) => (
                <View key={m.userId} style={styles.person}>
                  <Avatar
                    text={initialsOf(m.name ?? '?')}
                    url={m.avatar ?? undefined}
                    size={32}
                    color={C.cork}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* `name` rỗng = grant còn hiệu lực mà tài khoản đã xoá. Nói ra, đừng ẩn dòng. */}
                    <Text numberOfLines={1} style={styles.personName}>
                      {m.name ?? '(tài khoản đã xoá)'}
                    </Text>
                    <Text numberOfLines={1} style={styles.personSub}>
                      {m.email ?? '—'} · từ {dayOf(m.grantedAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Section
              title="Thành viên"
              // `total` của BE — số đã tải chỉ là một trang.
              note={members.data ? `${members.total} người` : ''}
            />
            {members.isLoading ? (
              <Loading onDark />
            ) : members.error ? (
              <Text style={styles.bad}>{(members.error as Error).message}</Text>
            ) : (members.data ?? []).length === 0 ? (
              <Text style={styles.empty}>Chưa có ai trong nhóm này.</Text>
            ) : (
              (members.data ?? []).map((m) => (
                <View key={m.userId} style={styles.person}>
                  {/*
                    `Member.avatar` là URL, không phải chữ viết tắt — chữ phải tự dựng từ tên.
                    Cùng cách `OrgProfileCard` và `admin/members` đang làm.
                  */}
                  <Avatar
                    text={initialsOf(m.name)}
                    url={m.avatar || undefined}
                    size={32}
                    color={C.moss}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.personName}>
                      {m.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.personSub}>
                      {ROLE_LABEL[m.role]}
                      {m.trustLevel !== undefined ? ` · uy tín ${m.trustLevel}` : ''}
                      {m.joinedAt ? ` · vào ${dayOf(m.joinedAt)}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
            <PagedFooter loading={members.isFetchingNextPage} onDark />
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

/**
 * `dd/mm/yyyy` ghép tay, không `toLocaleDateString`: Hermes không mang đủ dữ liệu Intl nên hàm
 * đó cho ra định dạng khác nhau giữa các máy — cùng lý do các chỗ khác trong app tự ghép.
 */
function dayOf(iso: string): string {
  const at = new Date(iso);
  const dd = String(at.getDate()).padStart(2, '0');
  const mm = String(at.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${at.getFullYear()}`;
}

function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!note && <Text style={styles.sectionNote}>{note}</Text>}
      <View style={styles.sectionRule} />
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: F.mono }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: C.deskPanel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  headTitle: { flex: 1, fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  close: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.deskHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 12, color: C.deskTxtSoft },

  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: F.uiBold, fontSize: 16, color: C.paper },
  slug: { fontFamily: F.mono, fontSize: 11, color: C.deskTxtDim, marginTop: 3 },
  desc: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.deskTxtSoft, marginTop: 12 },

  dl: { marginTop: 14, gap: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 6 },
  rowLabel: {
    width: 104,
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: C.deskTxtDim,
  },
  rowValue: { flex: 1, fontFamily: F.ui, fontSize: 12.5, color: C.paper },

  section: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 20, marginBottom: 9 },
  sectionTitle: { fontFamily: F.uiBold, fontSize: 13, color: C.paper },
  sectionNote: { fontFamily: F.ui, fontSize: 10.5, color: C.deskTxtDim },
  sectionRule: { flex: 1, height: 1, backgroundColor: C.deskLine },

  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  personName: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.paper },
  personSub: { fontFamily: F.ui, fontSize: 10.5, color: C.deskTxtDim, marginTop: 2 },

  warn: {
    fontFamily: F.ui,
    fontSize: 12,
    lineHeight: 18,
    color: C.paper,
    backgroundColor: C.deskHi,
    borderLeftWidth: 3,
    borderLeftColor: C.pin,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bad: { fontFamily: F.ui, fontSize: 12, color: C.badText },
  empty: { fontFamily: F.ui, fontSize: 12, color: C.deskTxtDim },
});
