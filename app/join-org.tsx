import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { OrgGrid, type OrgGridSection } from '@/components/OrgGrid';
import { useMyOrgs } from '@/queries/org';
import { normalizeVi } from '@/api/location';
import type { MyOrg } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Nhóm của tôi — CHỈ những nhóm mình đang ở trong, lưới hai cột, ô tìm lọc đúng danh sách đó.
 *
 * Không còn phần "Gợi ý cho bạn" và không còn tra mã ở đây: hai thứ đó là việc TÌM nhóm mới,
 * còn màn này trả lời "tôi đang ở những nhóm nào". Trộn hai câu hỏi vào một danh sách là lý do
 * bản trước phải loại nhóm mình khỏi kết quả tìm — và người dùng gõ tên nhóm mình thì không
 * thấy nó ở đâu.
 *
 * Lọc tại chỗ vì `useMyOrgs` đã tải trọn danh sách; `normalizeVi` để "hung" ra "Hùng Vương".
 */

const roleOf = (org: MyOrg) => (org.role === 'admin' ? 'Quản trị nhóm' : 'Thành viên');

export default function MyOrgs() {
  const router = useRouter();
  const [term, setTerm] = useState('');

  /*
   * `isLoading` chứ KHÔNG `isPending`: `useMyOrgs` tắt query khi chưa đăng nhập, mà query tắt
   * thì `isPending` là `true` mãi mãi — khách lạc vào đây sẽ nhìn một vòng xoay không bao giờ
   * dừng. `isLoading` chỉ đúng khi query THẬT SỰ đang bay.
   */
  const { data: mine, error, isLoading } = useMyOrgs();

  const needle = normalizeVi(term);
  const myOrgs = (mine ?? []).filter((o) => !needle || normalizeVi(o.name).includes(needle));

  const sections: OrgGridSection[] = [
    {
      key: 'mine',
      title: `Nhóm của bạn (${myOrgs.length})`,
      cards: myOrgs.map((o) => ({
        key: o.id,
        id: o.id,
        name: o.name,
        avatarUrl: o.avatarUrl,
        coverUrl: o.coverUrl,
        // `/organizations/mine` không trả số thành viên hay mã — thẻ tự giấu hai ô đó.
        where: o.provinceCode ?? undefined,
        action: 'joined',
        role: roleOf(o),
        onPress: () => router.push(`/org/${o.id}`),
      })),
    },
  ];

  return (
    // `SafeAreaView` chứ không `View`: `ScreenHeader` không tự chừa lề trên — xem docblock của nó.
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cork }} edges={['top']}>
      <ScreenHeader title="Nhóm của tôi" />

      <View style={styles.search}>
        <Text style={styles.searchGlyph}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Tìm trong nhóm của bạn..."
          placeholderTextColor={C.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <OrgGrid
        sections={sections}
        empty={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState
              icon="👥"
              text={term ? `Không có nhóm nào của bạn khớp "${term}"` : 'Bạn chưa tham gia nhóm nào'}
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
    marginBottom: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.lineInput,
  },
  searchGlyph: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: F.ui, fontSize: 14, color: C.ink },
});
