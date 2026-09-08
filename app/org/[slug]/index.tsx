import { FlatList, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { ListingCard } from '@/components/ListingCard';
import { Header } from '@/components/OrgProfileCard';
import { useToast } from '@/components/Toast';
import { useRequireAuth } from '@/components/GuestGate';
import { useMyOrgs, useRequestJoin } from '@/queries/org';
import { useOrgPeek, useOrgProfile } from '@/queries/org-discover';
import { useMyGrants } from '@/queries/admin';
import { canAdminOrg } from '@/api/admin';
import { useProfile, useSavedIds, useToggleSaved } from '@/queries/listings';
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
   * Tin trong nhóm bày bằng `ListingCard` — CÙNG một thẻ với mọi bề mặt công khai.
   *
   * Trước đây là `ListingRow` (dòng gọn), với lý do "cùng thẻ với màn tìm kiếm". Lý do đó đã
   * hết đúng: màn kết quả tìm kiếm chuyển sang `ListingCard`, nên hồ sơ nhóm thành bề mặt duy
   * nhất còn dùng dòng gọn — cùng một tin đọc ở hai nơi ra hai hình dạng khác nhau, và người
   * dùng đọc ra ngay là "tin trong nhóm" khác loại với "tin ngoài kia".
   *
   * Vẫn KHÔNG đọc `feedLayout` của nhóm: thiết lập đó chọn giữa thẻ lớn và lưới hai cột cho
   * bảng tin của nhóm, còn ở đây thẻ lớn là lựa chọn duy nhất — hồ sơ nhóm là chỗ người ta đọc
   * để quyết định xin vào, mà lưới hai cột thì cắt mất đúng những thứ dùng để quyết định
   * (lượt xem, người quan tâm, khu vực).
   */
  const peek = useOrgPeek(slug ?? '', Boolean(org?.joined));

  /*
   * Ba thứ `ListingCard` cần ngoài `item`, mà `ListingRow` không cần.
   *
   * `useSavedIds` tự tắt khi chưa đăng nhập (khách vẫn mở được hồ sơ nhóm công khai) — trái tim
   * hiện rỗng, chạm vào thì `requireAuth` đưa sang màn đăng nhập. Cùng cách màn kết quả tìm
   * kiếm đang làm, không dựng thêm luật mới ở đây.
   */
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const requireAuth = useRequireAuth();
  const saved = new Set(savedIds ?? []);
  /*
   * Ai được sửa: master, hoặc người giữ grant `manager` trên ĐÚNG nhóm này — xem `canAdminOrg`.
   *
   * Cần `orgId` để so, mà `OrganizationProfile` cố tình không mang `id` (nó là DTO công khai).
   * `useMyOrgs` có cả `id` lẫn `slug` và đã cache sẵn, nên nó là bảng tra rẻ nhất. Master
   * không thuộc nhóm nào thì `orgId` là `undefined` — `canAdminOrg` đã short-circuit trước đó.
   */
  const { data: grants } = useMyGrants();
  const { data: myOrgs } = useMyOrgs();

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
        // Nhóm công khai vào ngay, nhóm riêng tư mới có đơn chờ — xem `orgApi.requestJoin`.
        onSuccess: (res) =>
          toast(
            res.status === 'approved'
              ? `✓ Đã tham gia ${org.name}`
              : `✓ Đã gửi đơn vào ${org.name}`,
          ),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  const invite = () =>
    void Share.share({
      message: `Vào nhóm "${org.name}" trên Ghim — mã tham gia: ${org.joinCode}`,
    }).catch(() => {});

  return (
    <Shell>
      <FlatList
        data={peek.data?.listings ?? []}
        keyExtractor={(l) => l.id}
        // `gap: 14` khớp nhịp của màn kết quả tìm kiếm — xem `styles.post`.
        contentContainerStyle={[styles.body, { gap: 14 }]}
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
        renderItem={({ item, index }) => (
          <View style={styles.post}>
            <ListingCard
              item={item}
              index={index}
              /*
               * KHÔNG truyền `orgName`, dù ở đây biết chắc nó là gì.
               *
               * Viên "🏫 tên nhóm" có nghĩa ở màn kết quả tìm kiếm vì tin ở đó đến từ nhiều
               * nguồn — nó trả lời "tin này của nhóm nào". Trên chính hồ sơ nhóm thì câu trả
               * lời đã nằm ở tiêu đề trang, nên in lại trên từng thẻ chỉ là lặp N lần một
               * thông tin không ai còn hỏi. `ListingCard` tự giấu viên đó khi prop vắng.
               */
              saved={saved.has(item.id)}
              onPress={() => router.push(`/listing/${item.id}`)}
              onToggleSave={() =>
                requireAuth(
                  () => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) }),
                  'Đăng nhập để lưu tin',
                )
              }
            />
          </View>
        )}
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

/**
 * `SafeAreaView edges={['top']}`, không phải `View` trần.
 *
 * `ScreenHeader` KHÔNG tự chừa lề trên (xem docblock của nó), nên `View` trần đặt nút quay lại
 * ở y=0 — nằm dưới đồng hồ và Dynamic Island, và trên iPhone có tai thì vùng đó không nhận
 * được cú chạm. Đúng lỗi "bấm back không được" ở trang này.
 *
 * `['top']` thôi: đáy trang là danh sách tin cuộn được, chừa thêm lề dưới sẽ cắt một dải trống
 * giữa tin cuối và mép màn.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cork }} edges={['top']}>
      <ScreenHeader title="Nhóm" />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /** Khoảng cách hàng do call-site truyền vào — 10, khớp danh sách của màn tìm kiếm. */
  body: { paddingBottom: 32 },
  /** Lề NGOÀI cho thẻ tin, khớp với `inset` của khối hồ sơ phía trên. */
  /*
   * Lề đặt trên TỪNG thẻ, không trên `contentContainerStyle`: ảnh bìa + thẻ hồ sơ nhóm ở
   * `ListHeaderComponent` phải tràn hết bề ngang, mà padding của container thì thụt cả nó vào.
   *
   * 16 để khớp `paddingHorizontal` của màn kết quả tìm kiếm — hai trang bày CÙNG một loại thẻ
   * thì không được lệch nhau vài pixel, người dùng đọc ra ngay là hai màn khác nhau.
   */
  post: { marginHorizontal: 16 },

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
