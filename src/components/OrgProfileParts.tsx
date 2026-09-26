import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingCard } from './ListingCard';
import { ScreenHeader } from './ui';
import type { OrgProfile } from '@/api/org';
import { C, F } from '@/theme';

/**
 * Mảnh trình bày của màn hồ sơ nhóm (`app/org/[id]`) — tách ra vì route chạm trần 250 dòng
 * (HARD#11). Không hook dữ liệu, không mutation: mọi quyết định ở lại route.
 */

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
export function OrgShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cork }} edges={['top']}>
      <ScreenHeader title="Nhóm" />
      {children}
    </SafeAreaView>
  );
}

/**
 * Ô tìm tin TRONG nhóm. Nằm dưới phần hồ sơ và ngay trên danh sách: nó thuộc về khối tin,
 * không phải khối nhận diện nhóm. Route chỉ dựng nó khi người xem ĐỌC ĐƯỢC tin của nhóm.
 */
export function OrgSearchBox({ term, onChange }: { term: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.search}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        value={term}
        onChangeText={onChange}
        placeholder="Tìm tin trong nhóm…"
        placeholderTextColor={C.muted}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
      />
      {/* Nút xoá thay cho việc bắt người dùng xoá từng ký tự để về lại xem trước. */}
      {term.length > 0 && (
        <Text onPress={() => onChange('')} style={styles.searchClear}>
          ✕
        </Text>
      )}
    </View>
  );
}

/**
 * Chỗ trống của danh sách tin trong nhóm.
 *
 * Tin của nhóm là dữ liệu SCOPE THEO ORG — `GET /listings` đối chiếu tư cách thành viên với
 * `X-Org-Id`. Người chưa vào không đọc được, và đó là đúng: tin nội bộ của một trường không
 * phải thứ ai lướt qua hồ sơ cũng xem. Hai ca phải nói khác nhau — "chưa được xem" và "nhóm
 * chưa có tin" nhìn giống hệt nhau nếu dùng chung một câu.
 */
export function GroupFeed({ org }: { org: OrgProfile }) {
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

type CardProps = React.ComponentProps<typeof ListingCard>;

/**
 * Một tin trong nhóm — CÙNG `ListingCard` với mọi bề mặt công khai, để cùng một tin đọc ở hai
 * nơi không ra hai hình dạng.
 *
 * TẮT viên "🏫 tên nhóm", dù ở đây biết chắc nó là gì: viên đó có nghĩa ở bảng tin và kết quả
 * tìm kiếm vì tin ở đó đến từ nhiều nguồn. Trên chính hồ sơ nhóm thì câu trả lời đã nằm ở tiêu
 * đề trang, in lại trên từng thẻ chỉ là lặp N lần một thông tin không ai còn hỏi.
 *
 * Lề đặt trên TỪNG thẻ (16, khớp màn kết quả tìm kiếm) chứ không trên container của danh sách:
 * ảnh bìa + thẻ hồ sơ ở `ListHeaderComponent` phải tràn hết bề ngang.
 */
export function OrgListingRow({
  item,
  index,
  saved,
  onPress,
  onToggleSave,
}: {
  item: CardProps['item'];
  index: number;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  return (
    <View style={styles.post}>
      <ListingCard
        item={item}
        index={index}
        showOrg={false}
        saved={saved}
        onPress={onPress}
        onToggleSave={onToggleSave}
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
    marginTop: 14,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.lineInput,
  },
  searchIcon: { fontSize: 13, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: F.ui, fontSize: 13, color: C.ink },
  searchClear: { fontFamily: F.uiBold, fontSize: 13, color: C.inkSoft, paddingHorizontal: 4 },
  post: { marginHorizontal: 16 },
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
