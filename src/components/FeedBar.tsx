import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, TapeChip } from './ui';
import type { MyOrg } from '@/api/org';
import { gradOf } from '@/api/client';
import { C, F, shadow } from '@/theme';

/**
 * Phần đầu bảng tin: tiêu đề, avatar, ô tìm, hàng nhóm của mình, hàng danh mục.
 *
 * Tách khỏi route vì `feed.tsx` đã vượt trần 250 dòng (HARD#11) từ trước khi thêm hàng nhóm.
 * Khối này thuần trình bày — hoạt ảnh ẩn/hiện thanh vẫn ở lại màn hình, nơi giữ shared value.
 */
export function FeedBar({
  avatar,
  avatarUrl,
  myOrgs,
  categories,
  categoryId,
  onCategory,
  onSearch,
  onProfile,
  onOrg,
  onFindOrg,
  onTitleLayout,
}: {
  avatar: string;
  avatarUrl?: string;
  myOrgs: MyOrg[];
  categories: { id: string; name: string; icon?: string | null }[];
  categoryId: string;
  onCategory: (id: string) => void;
  onSearch: () => void;
  onProfile: () => void;
  onOrg: (slug: string) => void;
  onFindOrg: () => void;
  /** Chiều cao dòng chữ tay, để màn hình biết cuộn bao nhiêu thì nó đi hết. */
  onTitleLayout: (height: number) => void;
}) {
  return (
    <>
        {/*
          Dòng chữ tay: nó CUỘN ĐI như một phần nội dung, không phải ẩn hiện theo trạng thái.

          Màn hình dịch cả thanh lên đúng bằng số pixel đã cuộn, tối đa bằng chiều cao dòng
          này (xem `collapse` trong `feed.tsx`). Nhờ vậy mép dưới thanh bám sát mép trên nội
          dung suốt quá trình — không có khe hở, và cũng không có cú nhảy ở thời điểm nó biến
          mất. Ẩn nó bằng một cờ boolean thì đúng ở hai đầu nhưng hở một dải ở giữa.
        */}
        <View
          style={styles.brandRow}
          onLayout={(e) => onTitleLayout(e.nativeEvent.layout.height)}
        >
          <Text style={styles.brand}>Bảng tin của bạn</Text>
        </View>

        {/*
          Ô tìm và avatar CHUNG một hàng, và không còn tiêu đề lớn "Bảng tin của bạn".

          Tiêu đề đó lặp lại thứ `TabBar` đã ghi ngay dưới đáy màn hình (🏠 Bảng tin) —
          nó tốn gần 50dp chỉ để nói lại một điều người dùng đang nhìn thấy. Hai thao tác
          THẬT của hàng này là tìm kiếm và mở hồ sơ, cả hai đều vừa một dòng.
        */}
        <View style={styles.topRow}>
          <Pressable style={styles.searchBar} onPress={() => onSearch()}>
            <Text style={styles.searchText}>🔍  Tìm trên bảng tin của bạn...</Text>
          </Pressable>

          <Pressable onPress={() => onProfile()}>
            <Avatar text={avatar} url={avatarUrl} size={34} ring />
          </Pressable>
        </View>

        {/*
          Hàng nhóm của mình, đứng TRÊN hàng danh mục vì nó lọc ở mức khác: chọn nhóm là
          đổi chỗ đang đứng, chọn danh mục là lọc trong chỗ đó. Luôn có "+ Tìm nhóm" kể cả
          khi chưa vào nhóm nào — đó là lúc lối đi ấy cần thiết nhất.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rail}
          contentContainerStyle={styles.orgRow}
          keyboardShouldPersistTaps="handled"
        >
          {myOrgs.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => onOrg(o.slug)}
              style={({ pressed }) => [styles.orgChip, pressed && { opacity: 0.75 }]}
            >
              <View style={[styles.orgDot, { backgroundColor: gradOf(o.slug)[1] }]} />
              <Text numberOfLines={1} style={styles.orgChipText}>
                {o.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => onFindOrg()}
            style={({ pressed }) => [styles.orgFind, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.orgFindText}>+ Tìm nhóm</Text>
          </Pressable>
        </ScrollView>

        {/* Chỉ hiện khi BE trả về danh mục — hỏng hoặc rỗng thì giấu hẳn hàng chip thay
            vì để một hàng trơ ra không bấm được gì. */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rail}
            contentContainerStyle={styles.chipRow}
          >
            <TapeChip
              label="Tất cả"
              index={0}
              active={categoryId === ''}
              onPress={() => onCategory('')}
            />
            {categories.map((c, i) => (
              <TapeChip
                key={c.id}
                label={c.icon ? `${c.icon} ${c.name}` : c.name}
                index={i + 1}
                active={categoryId === c.id}
                onPress={() => onCategory(c.id)}
              />
            ))}
          </ScrollView>
        )}
    </>
  );
}

const styles = StyleSheet.create({
  /*
   * DÙNG CHUNG cho cả hai hàng cuộn ngang trong thanh này.
   *
   * React Native gán sẵn `flexGrow: 1, flexShrink: 1` cho MỌI ScrollView
   * (`ScrollView.js` → `baseHorizontal`). Thanh đầu là một cột, nên thiếu dòng này thì hai
   * hàng cuộn co giãn tranh chỗ với nhau và với hàng tìm kiếm — hàng nhóm từng thiếu nó.
   */
  rail: { flexGrow: 0, flexShrink: 0 },
  brandRow: { paddingHorizontal: 16, paddingBottom: 10 },
  brand: { fontFamily: F.hand, fontSize: 26, color: C.ink },
  // Lề riêng: danh sách đã bỏ lề chung để mỗi tin chạy hết bề ngang màn hình.
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchBar: {
    // `flex: 1` để ô tìm nuốt hết chỗ còn lại sau avatar — avatar giữ nguyên kích thước.
    flex: 1,
    backgroundColor: C.paperWarm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.corkDark,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    ...shadow,
  },
  searchText: { fontFamily: F.ui, fontSize: 13.5, color: C.inkSoft },
  orgRow: { flexDirection: 'row', gap: 8, paddingTop: 9, paddingRight: 4, paddingLeft: 16 },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 175,
    backgroundColor: C.paperWarm,
    borderRadius: 20,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    ...shadow,
  },
  orgDot: { width: 20, height: 20, borderRadius: 10 },
  orgChipText: { flexShrink: 1, fontFamily: F.uiBold, fontSize: 12, color: C.ink },
  orgFind: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: C.corkDark,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(250,248,240,0.55)',
  },
  orgFindText: { fontFamily: F.uiBold, fontSize: 12, color: C.corkDark },
  chipRow: { paddingTop: 9, paddingBottom: 2, paddingLeft: 16, paddingRight: 8 },
});
