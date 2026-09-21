import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { OrgGrid, type OrgGridSection } from '@/components/OrgGrid';
import { useToast } from '@/components/Toast';
import { useMyOrgs, useRequestJoin } from '@/queries/org';
import { useOrgDiscover } from '@/queries/org-discover';
import { useProfile } from '@/queries/listings';
import type { OrgRow } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Tìm nhóm MỚI — gợi ý công khai, tìm theo tên, và gõ mã để vào thẳng một nhóm.
 *
 * Tách khỏi `/join-org` ("Nhóm của tôi"): hai màn trả lời hai câu hỏi khác nhau — "tôi đang ở
 * đâu" và "tôi có thể vào đâu". Gộp chung một danh sách là lý do bản cũ phải loại nhóm mình
 * khỏi kết quả tìm, rồi người dùng gõ tên nhóm mình mà không thấy nó ở đâu. Ở đây nhóm mình
 * cũng bị loại, nhưng là ĐÚNG NGHĨA: chúng không còn là thứ để tìm và xin vào.
 *
 * Cái mã là đường DUY NHẤT vào nhóm riêng tư: gõ mã vào chính ô này sẽ ra đúng nhóm đó. Nhóm
 * riêng tư không bao giờ xuất hiện theo tên — BE lọc `isPublic` ở repository, nên gõ đúng tên
 * một nhóm kín cũng không lộ ra nó có tồn tại.
 */

/** "Quận 1, Hồ Chí Minh" — bỏ phần vắng thay vì để lại dấu phẩy cụt. */
const whereOf = (org: OrgRow) => [org.district, org.provinceCode].filter(Boolean).join(', ');

export default function FindOrg() {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState('');

  const { data: profile } = useProfile();
  const { data: mine } = useMyOrgs();
  const { data, error, isPending } = useOrgDiscover(term);
  const join = useRequestJoin();

  const myIds = new Set((mine ?? []).map((o) => o.id));
  const suggested = (data ?? []).filter((o) => !myIds.has(o.id));
  /* Gõ trúng mã thì BE trả đúng một dòng — dấu hiệu đủ chắc để gọi tên nó ra ở tiêu đề mục. */
  const exactCode = term.trim().length >= 4 && suggested.length === 1;

  /*
   * Mang MÃ theo khi mở hồ sơ: nhóm riêng tư 404 với người ngoài, và mã là chìa khoá duy nhất
   * mở được nó. Thẻ ở đây chỉ có mã khi người dùng vừa gõ trúng nó, nên gắn kèm là đưa lại
   * đúng thứ họ vừa đưa cho app — không phải rò rỉ gì mới.
   */
  const open = (org: OrgRow) =>
    router.push(`/org/${org.id}?code=${encodeURIComponent(org.joinCode)}`);

  /*
   * Gửi đơn thẳng từ danh sách. Tên khai báo lấy từ hồ sơ: bắt gõ lại tên mình ngay trong một
   * danh sách đang lướt là chặn đúng thao tác vừa mở ra cho nhanh.
   *
   * GỬI BẰNG MÃ, KHÔNG BẰNG ID. Đường `orgId` bên BE cố ý chỉ nhận nhóm CÔNG KHAI: id nằm
   * trong mọi đường link, nên cho gửi đơn bằng id là mở lại đúng bề mặt spam mà cái mã sinh ra
   * để chặn. Nhưng danh sách này CÓ nhóm riêng tư — `discover` trả chúng khi người dùng gõ
   * trúng mã, và đó là chủ ý. Gửi id cho một nhóm như vậy ăn 404 "Không tìm thấy nhóm công
   * khai này", một câu vô nghĩa với người vừa dán đúng mã của nhóm.
   *
   * Mã là thứ người dùng THẬT SỰ đưa ra để chứng minh mình được phép hỏi — gửi đúng nó thì
   * nhóm công khai vẫn vào thẳng, nhóm riêng tư sinh đơn chờ quản trị duyệt, và BE không phải
   * nới một dòng nào.
   */
  const requestJoin = (org: OrgRow) =>
    join.mutate(
      { code: org.joinCode, claimedName: profile?.name ?? '' },
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

  const sections: OrgGridSection[] = [
    {
      key: 'suggest',
      title: exactCode ? `Khớp mã ${suggested[0].joinCode}` : 'Gợi ý cho bạn',
      cards: suggested.map((o) => ({
        key: o.id,
        id: o.id,
        name: o.name,
        avatarUrl: o.avatarUrl,
        coverUrl: o.coverUrl,
        memberCount: o.memberCount,
        where: whereOf(o),
        joinCode: o.joinCode,
        action: o.allowJoinRequests ? 'join' : 'closed',
        // Nhóm không nhận đơn chỉ lọt vào đây qua đường gõ đúng mã, nên ổ khoá đi cùng ca đó.
        locked: exactCode && !o.allowJoinRequests,
        onPress: () => open(o),
        onJoin: () => requestJoin(o),
      })),
    },
  ];

  return (
    // `SafeAreaView` chứ không `View`: `ScreenHeader` không tự chừa lề trên — xem docblock của nó.
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cork }} edges={['top']}>
      <ScreenHeader title="Tìm nhóm" />

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
        Gõ tên để xem gợi ý, hoặc nhập mã như <Text style={styles.code}>HV-CHO</Text> để vào
        thẳng nhóm.
      </Text>

      <OrgGrid
        sections={sections}
        empty={
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /*
   * Viền `lineInput`, không phải `pin`: `pin` là `#FF4D4D`, trùng byte với `C.danger`. Một ô
   * tìm kiếm viền đỏ đọc ra là "ô này đang lỗi" trước khi người ta gõ chữ nào.
   */
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.lineInput,
  },
  searchGlyph: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: F.ui, fontSize: 14, color: C.ink },
  /*
   * `inkSoft`, không phải `sand`: `sand` là `#F5F6F7` còn nền màn là `cork` `#F1F2F4` — hai sắc
   * cách nhau bốn bậc, tức dòng gợi ý này TRẮNG TRÊN TRẮNG và chưa ai từng đọc được nó. `sand`
   * là token của hệ nền tối cũ, nơi nó là chữ sáng trên bần nâu.
   */
  hint: {
    fontFamily: F.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.inkSoft,
    marginHorizontal: 16,
    marginTop: 8,
  },
  code: { fontFamily: F.monoBold, color: C.brandTx },
});
