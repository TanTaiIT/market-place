import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn } from '@/components/AdminPicker';
import { AdminOrgSheet } from '@/components/AdminOrgSheet';
import { OrgCreateForm } from '@/components/OrgCreateForm';
import { EmptyState, Loading, PagedFooter, nearEnd } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAllOrgs,
  useCreateOrganization,
  useSetOrgVisibility,
  useSetOrganizationStatus,
} from '@/queries/org-admin';
import { STATUS_FILTER, STATUS_LABEL } from '@/api/org-admin';
import type { Organization, OrgStatus } from '@/api/org-admin';
import { C, F } from '@/theme';

/**
 * Bàn quản trị tổ chức (master).
 *
 * Danh sách là `GET /organizations` — mọi tổ chức, kể cả tổ chức master không tham gia. Bản
 * trước đọc `/organizations/mine` vì đó là route duy nhất trả `id`, mà master cố ý KHÔNG là
 * thành viên của org nào, nên bảng gần như luôn rỗng.
 *
 * Bấm một dòng là mở ngăn chi tiết (`AdminOrgSheet`): danh bạ, người phụ trách, mã tham gia —
 * gắn org vào từng lượt gọi, không đổi trạng thái app.
 */

export default function AdminOrganizations() {
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('all');

  const { data, error, isPending, loadMore, isFetchingNextPage } = useAllOrgs({
    q: term,
    status: status === 'all' ? undefined : (status as OrgStatus),
  });
  const create = useCreateOrganization();
  const setOrgStatus = useSetOrganizationStatus();
  const setVisibility = useSetOrgVisibility();

  /** Tổ chức đang mở ngăn chi tiết. Giữ cả object: ngăn dựng phần đầu từ nó, không gọi lại BE. */
  const [detail, setDetail] = useState<Organization | null>(null);

  const fail = (e: Error) => toast(`⚠️ ${e.message}`);
  const rows = data ?? [];

  /*
   * Gạt sang riêng tư là thao tác CÓ HẬU QUẢ RA NGOÀI: nhóm rơi khỏi tìm kiếm và mọi link
   * đã phát chết theo, nên nó phải hỏi lại — cùng lập luận với nút khoá tổ chức ngay dưới.
   * Chiều ngược lại (mở ra công khai) thì không: nó chỉ thêm đường vào, không cắt của ai.
   */
  const toggleVisibility = (org: Organization) => {
    const next = !org.isPublic;
    const run = () =>
      setVisibility.mutate(
        { id: org.id, isPublic: next },
        {
          onSuccess: (o) =>
            toast(o.isPublic ? `🌐 ${o.name} đã công khai` : `🙈 ${o.name} đã thành riêng tư`),
          onError: fail,
        },
      );

    if (next) return run();
    Alert.alert(
      'Chuyển thành nhóm riêng tư?',
      `${org.name} sẽ biến mất khỏi tìm kiếm. Người ngoài mở link nhóm sẽ nhận "không tìm thấy", và chỉ vào được bằng mã tham gia.`,
      [
        { text: 'Thôi', style: 'cancel' },
        { text: 'Chuyển', style: 'destructive', onPress: run },
      ],
    );
  };

  const toggleStatus = (org: Organization) => {
    const next = org.status === 'suspended' ? 'active' : 'suspended';
    const run = () =>
      setOrgStatus.mutate(
        { id: org.id, status: next },
        {
          // Trạng thái thật chỉ có trong response — nói lại đúng thứ BE vừa trả về, không đoán.
          onSuccess: (o) =>
            toast(o.status === 'suspended' ? `🔒 Đã khoá ${o.name}` : `🔓 Đã mở lại ${o.name}`),
          onError: fail,
        },
      );

    // Confirm gốc của hệ điều hành, chỉ cho đúng thao tác này: khoá tổ chức là cắt quyền truy
    // cập của TOÀN BỘ thành viên ngay lập tức, không phải một dòng dữ liệu gỡ nhầm rồi thêm lại.
    if (next === 'active') return run();
    Alert.alert('Khoá tổ chức?', `Mọi thành viên của ${org.name} mất quyền truy cập ngay.`, [
      { text: 'Thôi', style: 'cancel' },
      { text: 'Khoá', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <AdminScreen title="Tổ chức" note="ai đang mở, ai đang khoá">
      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Tìm theo tên…"
          placeholderTextColor={C.deskTxtDim}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {rows.length > 0 && <Text style={styles.searchCount}>{rows.length}</Text>}
      </View>

      <AdminFilter options={STATUS_FILTER} value={status} onChange={setStatus} />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        // Danh sách vẽ bằng `map` trong ScrollView (có ô tìm phía trên), nên tự dò đáy để tải trang sau.
        onScroll={(e) => nearEnd(e) && loadMore()}
        scrollEventThrottle={160}
      >
        {isPending ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState icon="🏫" onDark text="Không có tổ chức nào khớp bộ lọc" />
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((org) => {
              return (
                /*
                  Bấm vào HÀNG mở chi tiết (danh bạ + người phụ trách thật). Bốn nút bên trong
                  vẫn ăn cú chạm của riêng chúng — `Pressable` lồng nhau trong RN không cho sự
                  kiện nổi lên như DOM, nên bấm 'Khoá' không kéo theo một lượt mở ngăn.
                */
                <Pressable
                  key={org.id}
                  onPress={() => setDetail(org)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name}>{org.name}</Text>
                    {/* Chỉ nói khi RIÊNG TƯ: công khai là mặc định, ghi ra chỉ làm loãng dòng. */}
                    <Text style={styles.meta}>
                      {STATUS_LABEL[org.status]}
                      {org.isPublic ? '' : ' · 🙈 RIÊNG TƯ'}
                    </Text>
                    {/* Mã để phát cho người xin vào (`/find-org`). `selectable` thay vì nút
                        Copy: repo không có `expo-clipboard`, thêm native module cho sáu ký tự
                        là không đáng. */}
                    <Text selectable style={styles.code}>
                      Mã tham gia: {org.joinCode}
                    </Text>
                  </View>
                  <View style={styles.acts}>
                    {/*
                      Không còn nút "Thao tác trong": master không giữ "org đang thao tác" nữa
                      (xem `AdminOrgPicker`). Nhìn vào một nhóm = bấm cả dòng → ngăn chi tiết
                      (`AdminOrgSheet`), nơi gắn org vào từng lượt gọi chứ không vào trạng thái app.
                    */}
                    {/*
                     * Một nút phản ánh trạng thái THẬT, không còn là cặp Khoá/Mở đoán mò:
                     * `GET /organizations` trả `status`, thứ `/organizations/mine` không có.
                     */}
                    <AdminSmallBtn
                      label={org.isPublic ? 'Chuyển riêng tư' : 'Mở công khai'}
                      onPress={() => toggleVisibility(org)}
                    />
                    <AdminSmallBtn
                      label={org.status === 'suspended' ? 'Mở lại' : 'Khoá'}
                      onPress={() => toggleStatus(org)}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <AdminPanel title="Tạo tổ chức mới" note="người chủ phải có tài khoản trước">
            <OrgCreateForm
              busy={create.isPending}
              onSubmit={(values, reset) =>
                create.mutate(values, {
                  onSuccess: (o) => {
                    reset();
                    toast(`✓ Đã tạo ${o.name}`);
                  },
                  onError: fail,
                })
              }
            />
          </AdminPanel>
        </View>
        <PagedFooter loading={isFetchingNextPage} onDark />
      </ScrollView>

      {/* Ngoài `ScrollView`: Modal tự phủ toàn màn, nằm trong danh sách cuộn chỉ làm rối cây. */}
      <AdminOrgSheet org={detail} onClose={() => setDetail(null)} />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  searchIcon: { fontSize: 13, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: F.ui, fontSize: 13, color: C.deskTxt },
  searchCount: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },
  row: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 14,
    gap: 11,
  },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  code: {
    fontFamily: F.monoBold,
    fontSize: 11.5,
    letterSpacing: 1,
    color: C.tape,
    marginTop: 5,
  },
  meta: {
    fontFamily: F.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: C.deskTxtDim,
    marginTop: 3,
  },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
