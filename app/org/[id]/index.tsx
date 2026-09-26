import { useState } from 'react';
import { FlatList, Share, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { OrgMemberSheet } from '@/components/OrgMemberSheet';
import { GroupFeed, OrgListingRow, OrgSearchBox, OrgShell } from '@/components/OrgProfileParts';
import { EmptyState, Loading } from '@/components/ui';
import { Header } from '@/components/OrgProfileCard';
import { useToast } from '@/components/Toast';
import { useRequireAuth } from '@/components/GuestGate';
import { useRequestJoin } from '@/queries/org';
import {
  useLeaveOrg,
  useOrgListingSearch,
  useOrgPeek,
  useOrgProfile,
} from '@/queries/org-discover';
import { useMyGrants } from '@/queries/admin';
import { canAdminOrg } from '@/api/admin';
import { useProfile, useSavedIds, useToggleSaved } from '@/queries/listings';
import { C, F } from '@/theme';

/**
 * Hồ sơ một nhóm công khai — nơi người dùng đọc trước khi quyết định xin vào.
 *
 * Đây là thứ thay cho luồng cũ "gõ mã rồi gửi đơn ngay": bây giờ họ nhìn thấy nhóm bao nhiêu
 * người, đăng bao nhiêu tin một tuần, nội quy ra sao, RỒI mới bấm.
 *
 * Nhóm riêng tư vào đây sẽ nhận 404 từ BE — không phân biệt được với id không tồn tại, nên
 * không ai quét id để lập danh sách nhóm kín được. TRỪ khi đường dẫn mang `?code=`: mã đúng
 * của chính nhóm đó là chìa khoá mở hồ sơ, và màn Tìm nhóm gắn sẵn nó vào link khi người dùng
 * vừa gõ trúng mã. Mã sai vẫn 404 như thường.
 *
 * Phần trình bày thuần (khung, ô tìm, hàng tin, chỗ trống) ở `OrgProfileParts` — route chỉ giữ
 * hook dữ liệu và mutation (HARD#11).
 */
export default function OrgProfileScreen() {
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
  const router = useRouter();
  const toast = useToast();
  /* `null` = ngăn đóng; mở ra thì chính id này là thứ bật query danh bạ — không có cờ thứ hai. */
  const [membersOrgId, setMembersOrgId] = useState<string | null>(null);
  /** Từ khoá tìm tin TRONG nhóm. Rỗng = khối xem trước như cũ. */
  const [term, setTerm] = useState('');

  const { data: org, error, isPending } = useOrgProfile(id ?? '', code);
  const { data: me } = useProfile();
  const join = useRequestJoin();
  const leave = useLeaveOrg(id ?? '', code);
  /*
   * Đang tìm hay đang xem trước — MỘT biến quyết định cả nguồn dữ liệu lẫn câu nói khi rỗng.
   *
   * Đọc `term` chứ không `search.data`: người vừa gõ xong mà kết quả chưa về thì vẫn là đang
   * tìm, và rơi về khối xem trước lúc đó là nháy một danh sách không liên quan tới thứ họ gõ.
   *
   * Khai ở ĐÂY, trên mọi nhánh `return` sớm: hook không được gọi có điều kiện — đặt sau nhánh
   * "đang tải"/"404" là thứ tự hook đổi giữa hai lượt render, React vỡ ở lần trạng thái đổi.
   */
  const searching = term.trim().length > 0;
  const search = useOrgListingSearch(id ?? '', term, searching);
  /*
   * Tin trong nhóm bày bằng `ListingCard` (qua `OrgListingRow`) — CÙNG một thẻ với mọi bề mặt
   * công khai. Vẫn KHÔNG đọc `feedLayout` của nhóm: thiết lập đó chọn giữa thẻ lớn và lưới hai
   * cột cho bảng tin của nhóm, còn ở đây thẻ lớn là lựa chọn duy nhất — hồ sơ nhóm là chỗ người
   * ta đọc để quyết định xin vào, mà lưới hai cột cắt mất đúng những thứ dùng để quyết định.
   */
  const peek = useOrgPeek(id ?? '', Boolean(org?.joined));
  /*
   * Ba thứ `ListingCard` cần ngoài `item`. `useSavedIds` tự tắt khi chưa đăng nhập (khách vẫn
   * mở được hồ sơ nhóm công khai) — trái tim hiện rỗng, chạm vào thì `requireAuth` đưa sang màn
   * đăng nhập. Cùng cách màn kết quả tìm kiếm đang làm, không dựng thêm luật mới ở đây.
   */
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const requireAuth = useRequireAuth();
  const saved = new Set(savedIds ?? []);
  /* Ai được sửa: master, hoặc người giữ grant `manager` trên ĐÚNG nhóm này — xem `canAdminOrg`. */
  const { data: grants } = useMyGrants();

  if (isPending)
    return (
      <OrgShell>
        <Loading />
      </OrgShell>
    );
  if (error || !org) {
    return (
      <OrgShell>
        <EmptyState
          icon="🔒"
          // 404 gộp ba ca: id sai, nhóm đã đóng, và nhóm riêng tư mà mình không thuộc về.
          // Đổ hết cho 'riêng tư' là nói sai với hai ca đầu — BE cố tình không phân biệt được
          // ba ca này để không ai quét id lập danh sách nhóm kín.
          text="Không mở được nhóm này. Địa chỉ có thể sai, nhóm đã đóng, hoặc đây là nhóm riêng tư mà bạn chưa tham gia — lúc đó cần mã tham gia."
        />
      </OrgShell>
    );
  }

  /*
   * Cầm mã thì gửi đơn BẰNG MÃ. Đường `orgId` bên BE cố ý chỉ nhận nhóm công khai (id nằm
   * trong mọi link — xem `joinRequestService.create`), nên với nhóm kín mở bằng mã thì gửi id
   * sẽ ăn 404 ngay sau khi người dùng vừa nhìn thấy hồ sơ.
   */
  const requestJoin = () =>
    join.mutate(
      code
        ? { code, claimedName: me?.name ?? '' }
        : { orgId: org.id, claimedName: me?.name ?? '' },
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

  const leaveOrg = () =>
    leave.mutate(undefined, {
      onSuccess: () => toast(`✓ Đã rời ${org.name}`),
      onError: (e: Error) => toast(`⚠️ ${e.message}`),
    });

  const invite = () =>
    void Share.share({
      message: `Vào nhóm "${org.name}" trên Ghim — mã tham gia: ${org.joinCode}`,
    }).catch(() => {});

  const rows = searching ? (search.data ?? []) : (peek.data?.listings ?? []);

  return (
    <OrgShell>
      <FlatList
        data={rows}
        keyExtractor={(l) => l.id}
        // `gap: 14` khớp nhịp của màn kết quả tìm kiếm.
        contentContainerStyle={[styles.body, { gap: 14 }]}
        ListHeaderComponent={
          <>
            <Header
              org={org}
              members={peek.data?.members ?? []}
              onJoin={requestJoin}
              onInvite={invite}
              /*
               * Nhóm nhận được tin từ người này không: thành viên thì luôn được, người ngoài
               * chỉ khi nhóm bật `allowOutsiderPosts` — tắt thì `routeListing` trả 400, và một
               * cái nút dẫn thẳng tới lỗi thì tệ hơn không có nút.
               */
              onPost={
                org.joined || org.allowOutsiderPosts
                  ? () => router.push(`/post?org=${org.id}`)
                  : undefined
              }
              onEdit={
                canAdminOrg(grants, org.id) ? () => router.push(`/org/${org.id}/edit`) : undefined
              }
              onOpenMembers={() => setMembersOrgId(org.id)}
              onLeave={org.joined ? leaveOrg : undefined}
              busy={join.isPending || leave.isPending}
            />
            {/* Chỉ khi người xem ĐỌC ĐƯỢC tin của nhóm — người ngoài một nhóm kín không có gì để tìm. */}
            {org.joined && <OrgSearchBox term={term} onChange={setTerm} />}
          </>
        }
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        // Gõ xong bấm ra ngoài để đóng bàn phím mà không mất phím vừa chạm.
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <OrgListingRow
            item={item}
            index={index}
            saved={saved.has(item.id)}
            onPress={() => router.push(`/listing/${item.id}`)}
            onToggleSave={() =>
              requireAuth(
                () => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) }),
                'Đăng nhập để lưu tin',
              )
            }
          />
        )}
        ListEmptyComponent={
          searching ? (
            <Text style={styles.noHit}>
              {search.isPending ? 'Đang tìm…' : `Không có tin nào khớp “${term.trim()}”`}
            </Text>
          ) : (
            <GroupFeed org={org} />
          )
        }
      />

      <OrgMemberSheet
        orgId={membersOrgId}
        total={org.memberCount}
        onClose={() => setMembersOrgId(null)}
        /*
         * Đóng ngăn TRƯỚC khi đi: `Modal` của RN là một cửa sổ riêng nằm trên mọi thứ, nên đẩy
         * route mới trong lúc nó còn mở sẽ để màn hồ sơ người dùng bị che sau tấm scrim.
         */
        onOpenMember={(userId) => {
          setMembersOrgId(null);
          router.push(`/user/${userId}`);
        }}
      />
    </OrgShell>
  );
}

const styles = StyleSheet.create({
  noHit: {
    fontFamily: F.ui,
    fontSize: 13,
    color: C.inkSoft,
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  body: { paddingBottom: 32 },
});
