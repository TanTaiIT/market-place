import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { OrgCreateForm } from '@/components/OrgCreateForm';
import { SlugField } from '@/components/SlugField';
import { EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAllOrgs,
  useChangeOrganizationSlug,
  useCreateOrganization,
  useSetOrganizationStatus,
} from '@/queries/org-admin';
import { STATUS_LABEL } from '@/api/org-admin';
import type { Organization, OrgStatus } from '@/api/org-admin';
import { useOrgSlug, useSetActiveOrg } from '@/stores/auth';
import { C, F } from '@/theme';

/**
 * Bàn quản trị tổ chức (master).
 *
 * Danh sách là `GET /organizations` — mọi tổ chức, kể cả tổ chức master không tham gia. Bản
 * trước đọc `/organizations/mine` vì đó là route duy nhất trả `id`, mà master cố ý KHÔNG là
 * thành viên của org nào, nên bảng gần như luôn rỗng.
 *
 * Vì thế màn này cũng là nơi master CHỌN tổ chức đang thao tác: mọi màn org-scoped đọc
 * `X-Org-Slug`, mà `OrgSwitcher` trên hồ sơ thì dựng từ danh bạ thành viên.
 */

const STATUS_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang mở' },
  { value: 'suspended', label: 'Đang khoá' },
  { value: 'pending_admin', label: 'Chờ người phụ trách' },
];

export default function AdminOrganizations() {
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('all');

  const { data, error, isPending } = useAllOrgs({
    q: term,
    status: status === 'all' ? undefined : (status as OrgStatus),
  });
  const create = useCreateOrganization();
  const setOrgStatus = useSetOrganizationStatus();
  const changeSlug = useChangeOrganizationSlug();

  const activeSlug = useOrgSlug();
  const setActiveOrg = useSetActiveOrg();

  /** Tổ chức đang đổi slug; `null` = panel dưới đang ở chế độ tạo mới. */
  const [editing, setEditing] = useState<Organization | null>(null);
  const [slug, setSlug] = useState('');

  const fail = (e: Error) => toast(`⚠️ ${e.message}`);
  const rows = data ?? [];

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
          placeholder="Tìm theo tên hoặc slug…"
          placeholderTextColor={C.deskTxtDim}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {rows.length > 0 && <Text style={styles.searchCount}>{rows.length}</Text>}
      </View>

      <AdminFilter options={STATUS_FILTER} value={status} onChange={setStatus} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isPending ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState icon="🏫" onDark text="Không có tổ chức nào khớp bộ lọc" />
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((org) => {
              const acting = org.slug === activeSlug;
              return (
                <View key={org.id} style={[styles.row, acting && styles.rowActing]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name}>{org.name}</Text>
                    <Text style={styles.meta}>
                      /{org.slug} · {STATUS_LABEL[org.status]}
                    </Text>
                  </View>
                  <View style={styles.acts}>
                    {/*
                     * Chọn tổ chức đang thao tác — đường DUY NHẤT của master tới các màn
                     * org-scoped: chúng đọc `X-Org-Slug`, mà bộ chuyển tổ chức trên hồ sơ thì
                     * dựng từ danh bạ thành viên, nơi master không có dòng nào.
                     */}
                    <AdminSmallBtn
                      label={acting ? '✓ Đang thao tác' : 'Thao tác trong'}
                      onPress={() => setActiveOrg(acting ? null : org.slug)}
                    />
                    <AdminSmallBtn
                      label="Đổi slug"
                      onPress={() => {
                        setEditing(org);
                        // Mở ra ô TRỐNG chứ không nạp slug hiện tại: nạp vào thì lượt kiểm tra
                        // đầu tiên báo "đã có tổ chức dùng slug này" — mà tổ chức đó chính là nó.
                        setSlug('');
                      }}
                    />
                    {/*
                     * Một nút phản ánh trạng thái THẬT, không còn là cặp Khoá/Mở đoán mò:
                     * `GET /organizations` trả `status`, thứ `/organizations/mine` không có.
                     */}
                    <AdminSmallBtn
                      label={org.status === 'suspended' ? 'Mở lại' : 'Khoá'}
                      onPress={() => toggleStatus(org)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          {editing ? (
            <AdminPanel
              title={`Đổi slug cho ${editing.name}`}
              note={`/${editing.slug} sẽ thành redirect 301`}
            >
              <SlugField value={slug} onChange={setSlug} />
              <View style={adminFormStyles.formActs}>
                <PinButton
                  label="Lưu slug mới"
                  loading={changeSlug.isPending}
                  style={{ flex: 1 }}
                  onPress={() =>
                    changeSlug.mutate(
                      { id: editing.id, slug: slug.trim() },
                      {
                        onSuccess: (o) => {
                          // Tổ chức đang thao tác vừa đổi địa chỉ: giữ slug cũ trong store là
                          // mọi request sau đó mang một `X-Org-Slug` không còn tồn tại.
                          if (editing.slug === activeSlug) setActiveOrg(o.slug);
                          setEditing(null);
                          toast(`✓ ${o.name} giờ ở /${o.slug}`);
                        },
                        onError: fail,
                      },
                    )
                  }
                />
                <Pressable
                  onPress={() => setEditing(null)}
                  style={({ pressed }) => [adminFormStyles.cancel, pressed && { opacity: 0.7 }]}
                >
                  <Text style={adminFormStyles.smallText}>Huỷ</Text>
                </Pressable>
              </View>
            </AdminPanel>
          ) : (
            <AdminPanel title="Tạo tổ chức mới" note="người chủ phải có tài khoản trước">
              <OrgCreateForm
                busy={create.isPending}
                onSubmit={(values, reset) =>
                  create.mutate(values, {
                    onSuccess: (o) => {
                      reset();
                      toast(`✓ Đã tạo ${o.name} (/${o.slug})`);
                    },
                    onError: fail,
                  })
                }
              />
            </AdminPanel>
          )}
        </View>
      </ScrollView>
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
  rowActing: { borderColor: C.pin, borderWidth: 1.5 },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  meta: {
    fontFamily: F.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: C.deskTxtDim,
    marginTop: 3,
  },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
