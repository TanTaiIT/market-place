import { FlatList, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { FeedCard } from '@/components/FeedCard';
import { NoteCard } from '@/components/NoteCard';
import { Header } from '@/components/OrgProfileCard';
import { useToast } from '@/components/Toast';
import { useMyOrgs, useRequestJoin } from '@/queries/org';
import { useOrgPeek, useOrgProfile } from '@/queries/org-discover';
import { useMyGrants } from '@/queries/admin';
import { canAdminOrg } from '@/api/admin';
import { useProfile, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useOpenConversation } from '@/queries/chat';
import type { OrgProfile } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Hồ sơ một nhóm công khai — nơi người dùng đọc trước khi quyết định xin vào.
 *
 * Đây là thứ thay cho luồng cũ "gõ mã rồi gửi đơn ngay": bây giờ họ nhìn thấy nhóm bao nhiêu
 * người, đăng bao nhiêu tin một tuần, nội quy ra sao, RỒI mới bấm.
 *
 * Nhóm riêng tư vào đây sẽ nhận 404 từ BE — không phân biệt được với slug không tồn tại, nên
 * không ai quét slug để lập danh sách nhóm kín được.
 */
export default function OrgProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: org, error, isPending } = useOrgProfile(slug ?? '');
  const { data: me } = useProfile();
  const join = useRequestJoin();
  /*
   * Bảng tin trong nhóm bày theo đúng thiết lập của NHÓM ĐÓ, không phải của org người xem
   * đang thao tác: mở hồ sơ trường B thì thấy trường B bày như chủ nhóm B đã chọn.
   *
   * Rơi về `feed` trong lúc hồ sơ còn đang tải — `org` chưa có thì chưa biết hỏi ai.
   */
  const layout = org?.feedLayout ?? 'feed';
  const grid = layout === 'grid';
  const peek = useOrgPeek(slug ?? '', Boolean(org?.joined), layout);
  /*
   * Ai được sửa: master, hoặc người giữ grant `manager` trên ĐÚNG nhóm này — xem `canAdminOrg`.
   *
   * Cần `orgId` để so, mà `OrganizationProfile` cố tình không mang `id` (nó là DTO công khai).
   * `useMyOrgs` có cả `id` lẫn `slug` và đã cache sẵn, nên nó là bảng tra rẻ nhất. Master
   * không thuộc nhóm nào thì `orgId` là `undefined` — `canAdminOrg` đã short-circuit trước đó.
   */
  const { data: grants } = useMyGrants();
  const { data: myOrgs } = useMyOrgs();

  // Cùng ba đường của bảng tin, không phải bản sao rút gọn: thẻ tin ở đây là CÙNG một
  // `FeedCard`, nên ai đã học cách bấm ở bảng tin thì ở đây phải bấm ra cùng thứ.
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const openChat = useOpenConversation();
  const saved = new Set(savedIds ?? []);

  if (isPending) return <Shell><Loading /></Shell>;
  if (error || !org) {
    return (
      <Shell>
        <EmptyState
          icon="🔒"
          // 404 gộp ba ca: slug sai, nhóm đã đóng, và nhóm riêng tư mà mình không thuộc về.
          // Đổ hết cho 'riêng tư' là nói sai với hai ca đầu — BE cố tình không phân biệt được
          // ba ca này để không ai quét slug lập danh sách nhóm kín.
          text="Không mở được nhóm này. Địa chỉ có thể sai, nhóm đã đóng, hoặc đây là nhóm riêng tư mà bạn chưa tham gia — lúc đó cần mã tham gia."
        />
      </Shell>
    );
  }

  const requestJoin = () =>
    join.mutate(
      { slug: org.slug, claimedName: me?.name ?? '' },
      {
        onSuccess: () => toast(`✓ Đã gửi đơn vào ${org.name}`),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  const message = (listingId: string) =>
    openChat.mutate(listingId, {
      onSuccess: (c) => router.push(`/chat/${c.id}`),
      onError: (e: Error) => toast(`⚠️ ${e.message}`),
    });

  const invite = () =>
    void Share.share({
      message: `Vào nhóm "${org.name}" trên Ghim — mã tham gia: ${org.joinCode}`,
    }).catch(() => {});

  return (
    <Shell>
      <FlatList
        data={peek.data?.listings ?? []}
        keyExtractor={(l) => l.id}
        // `numColumns` không đổi tại chỗ được: RN đòi dựng lại danh sách, `key` là đòn bẩy duy nhất.
        key={layout}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? styles.gridRow : undefined}
        contentContainerStyle={[styles.body, { gap: grid ? 14 : 22 }]}
        ListHeaderComponent={
          <Header
            org={org}
            members={peek.data?.members ?? []}
            onJoin={requestJoin}
            onInvite={invite}
            /*
             * Nhóm nhận được tin từ người này không.
             *
             * Thành viên thì luôn được. Người ngoài chỉ khi nhóm bật `allowOutsiderPosts` —
             * tắt thì `routeListing` trả 400, và một cái nút dẫn thẳng tới lỗi thì tệ hơn
             * không có nút.
             */
            onPost={
              org.joined || org.allowOutsiderPosts
                ? () => router.push(`/post?org=${org.slug}`)
                : undefined
            }
            onEdit={
              canAdminOrg(grants, myOrgs?.find((o) => o.slug === org.slug)?.id)
                ? () => router.push(`/org/${org.slug}/edit`)
                : undefined
            }
            busy={join.isPending}
          />
        }
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        renderItem={({ item, index }) =>
          grid ? (
            // Cùng ô thumbnail mà bảng tin dùng ở chế độ lưới — một bộ layout cho cả hai màn.
            <NoteCard item={item} index={index} onPress={() => router.push(`/listing/${item.id}`)} />
          ) : (
            <View style={styles.post}>
              <FeedCard
                item={item}
                index={index}
                orgName={org.name}
                saved={saved.has(item.id)}
                onPress={() => router.push(`/listing/${item.id}`)}
                onToggleSave={() => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) })}
                onMessage={() => message(item.id)}
              />
            </View>
          )
        }
        ListEmptyComponent={<GroupFeed org={org} />}
      />
    </Shell>
  );
}

/**
 * Chỗ trống của danh sách tin trong nhóm.
 *
 * Tin của nhóm là dữ liệu SCOPE THEO ORG — `GET /listings` đối chiếu tư cách thành viên với
 * `X-Org-Slug`. Người chưa vào không đọc được, và đó là đúng: tin nội bộ của một trường không
 * phải thứ ai lướt qua hồ sơ cũng xem. Hai ca phải nói khác nhau — "chưa được xem" và "nhóm
 * chưa có tin" nhìn giống hệt nhau nếu dùng chung một câu.
 */
function GroupFeed({ org }: { org: OrgProfile }) {
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedGlyph}>{org.joined ? '📭' : '🔒'}</Text>
      <Text style={styles.lockedText}>
        {org.joined
          ? 'Nhóm chưa có tin nào.'
          : 'Đây là nội dung riêng của nhóm. Tham gia để xem tin đăng bên trong.'}
      </Text>
    </View>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.cork }}>
      <ScreenHeader title="Nhóm" />
      {children}
    </View>
  );
}


const styles = StyleSheet.create({
  /*
   * Khoảng cách hàng do call-site truyền vào: lưới xếp sát hơn, còn một-tin-một-dòng phải
   * chừa chỗ cho đinh ghim nhô lên khỏi mép thẻ.
   */
  body: { paddingBottom: 32 },
  /** Lề NGOÀI cho thẻ tin, khớp với `inset` của khối hồ sơ phía trên. */
  post: { marginHorizontal: 14 },
  /** Lưới cần lề ở hàng chứ không ở từng thẻ — `NoteCard` không tự mang lề. */
  gridRow: { gap: 14, paddingHorizontal: 14 },


  section: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.sand, marginTop: 4 },
  rule: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rulePin: { fontSize: 12 },
  ruleText: { flex: 1, fontFamily: F.ui, fontSize: 13, lineHeight: 19, color: C.ink },

  locked: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 34 },
  lockedGlyph: { fontSize: 30, marginBottom: 10 },
  lockedText: {
    fontFamily: F.ui,
    fontSize: 13,
    lineHeight: 21,
    color: C.inkSoft,
    textAlign: 'center',
  },
});
