import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { OrgRowCard } from '@/components/OrgRowCard';
import { useToast } from '@/components/Toast';
import { useMyOrgs, useRequestJoin } from '@/queries/org';
import { useOrgDiscover } from '@/queries/org-discover';
import { useProfile } from '@/queries/listings';
import type { OrgRow } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Khám phá nhóm.
 *
 * Thay hẳn màn "nhập mã để gửi đơn" cũ: giờ tìm theo TÊN, xem gợi ý, mở hồ sơ nhóm rồi mới
 * quyết định vào. Cái mã không mất vai trò — nó vẫn là đường DUY NHẤT vào nhóm riêng tư, và gõ
 * mã vào chính ô này sẽ nhảy thẳng tới hồ sơ nhóm đó.
 *
 * Nhóm riêng tư không bao giờ xuất hiện trong kết quả tìm: BE lọc `isPublic` ở repository, nên
 * gõ đúng tên một nhóm kín cũng không lộ ra nó có tồn tại.
 */

/** Mọi nhóm tới được danh sách này đều công khai — nhóm riêng tư bị BE lọc từ repository. */
function metaOf(org: OrgRow): string {
  const where = [org.district, org.provinceCode].filter(Boolean).join(', ');
  const count = org.memberCount.toLocaleString('vi-VN');
  return [`Công khai · ${count} thành viên`, org.joinCode, where].filter(Boolean).join(' · ');
}

export default function JoinOrg() {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState('');

  const { data: profile } = useProfile();
  const { data: mine } = useMyOrgs();
  const { data, error, isPending } = useOrgDiscover(term);
  const join = useRequestJoin();

  const myOrgs = mine ?? [];
  const mySlugs = new Set(myOrgs.map((o) => o.slug));
  const rows = (data ?? []).filter((o) => !mySlugs.has(o.slug));
  /* Gõ trúng mã thì BE trả đúng một dòng — dấu hiệu đủ chắc để tô đậm nó. */
  const exactCode = term.trim().length >= 4 && rows.length === 1;

  const open = (slug: string) => router.push(`/org/${slug}`);

  /*
   * Gửi đơn thẳng từ danh sách bằng SLUG — chỉ nhóm công khai mới có mặt ở đây, và BE nhận
   * slug cho đúng nhóm đó. Tên khai báo lấy từ hồ sơ: bắt gõ lại tên mình ngay trong một danh
   * sách đang lướt là chặn đúng thao tác vừa mở ra cho nhanh.
   */
  const requestJoin = (org: OrgRow) =>
    join.mutate(
      { slug: org.slug, claimedName: profile?.name ?? '' },
      {
        onSuccess: () => toast(`✓ Đã gửi đơn vào ${org.name}`),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.cork }}>
      <ScreenHeader title="Nhóm" />

      <View style={styles.search}>
        <Text style={styles.searchGlyph}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Tên nhóm hoặc mã nhóm..."
          placeholderTextColor={C.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <Text style={styles.hint}>
        Nhập tên nhóm để xem gợi ý, hoặc nhập mã như <Text style={styles.code}>HV-CHO</Text> để
        vào thẳng nhóm.
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(o) => o.slug}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          exactCode ? (
            <Text style={styles.exactTag}>KHỚP MÃ {rows[0].joinCode}</Text>
          ) : myOrgs.length === 0 ? undefined : (
            <View style={{ gap: 10, marginBottom: 6 }}>
              <Text style={styles.section}>NHÓM CỦA BẠN ({myOrgs.length})</Text>
              {myOrgs.map((o) => (
                // `/organizations/mine` không trả mã hay số thành viên — dòng phụ chỉ nói
                // được vai của mình, và đó là thứ đúng nhất có ở đây.
                <OrgRowCard
                  key={o.id}
                  slug={o.slug}
                  name={o.name}
                  meta={`${o.role === 'admin' ? 'Quản trị nhóm' : 'Thành viên'} · /${o.slug}`}
                  action="joined"
                  onPress={() => open(o.slug)}
                />
              ))}
              <Text style={[styles.section, { marginTop: 8 }]}>GỢI Ý CHO BẠN</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <OrgRowCard
            exact={exactCode}
            // Nhóm riêng tư chỉ lọt vào đây qua đường gõ đúng mã, nên ổ khoá đi cùng ca đó.
            locked={exactCode && !item.allowJoinRequests}
            slug={item.slug}
            name={item.name}
            avatarUrl={item.avatarUrl}
            meta={metaOf(item)}
            action={item.allowJoinRequests ? 'join' : 'closed'}
            onPress={() => open(item.slug)}
            onJoin={() => requestJoin(item)}
          />
        )}
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState
              icon="🔍"
              text={
                term
                  ? `Không có nhóm công khai nào khớp "${term}". Nhóm riêng tư chỉ vào được bằng mã.`
                  : 'Chưa có nhóm công khai nào để gợi ý'
              }
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 1.5,
    borderColor: C.pin,
  },
  searchGlyph: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: F.ui, fontSize: 14, color: C.ink },
  hint: {
    fontFamily: F.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.sand,
    marginHorizontal: 16,
    marginTop: 8,
  },
  code: { fontFamily: F.monoBold, color: C.tape },
  section: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.sand,
    marginTop: 12,
  },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 10 },
  exactTag: {
    alignSelf: 'flex-start',
    fontFamily: F.monoBold,
    fontSize: 9.5,
    color: C.paper,
    backgroundColor: C.moss,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    marginBottom: 4,
  },
});
