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
}) {
  return (
    <>
        <View style={styles.header}>
          <Text style={styles.title}>Bảng tin của bạn</Text>

          <Pressable onPress={() => onProfile()}>
            <Avatar text={avatar} url={avatarUrl} ring />
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => onSearch()}>
          <Text style={styles.searchText}>🔍  Tìm trên bảng tin của bạn...</Text>
        </Pressable>

        {/*
          Hàng nhóm của mình, đứng TRÊN hàng danh mục vì nó lọc ở mức khác: chọn nhóm là
          đổi chỗ đang đứng, chọn danh mục là lọc trong chỗ đó. Luôn có "+ Tìm nhóm" kể cả
          khi chưa vào nhóm nào — đó là lúc lối đi ấy cần thiết nhất.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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
            style={styles.chipBar}
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
  chipBar: { flexGrow: 0, flexShrink: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    // Lề riêng: danh sách đã bỏ lề chung để mỗi tin chạy hết bề ngang màn hình.
    paddingHorizontal: 16,
  },
  title: { fontFamily: F.hand, fontSize: 26, color: C.ink },
  searchBar: {
    backgroundColor: C.paperWarm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.corkDark,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 14,
    marginHorizontal: 16,
    ...shadow,
  },
  searchText: { fontFamily: F.ui, fontSize: 13.5, color: C.inkSoft },
  orgRow: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingRight: 4 },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: 175,
    backgroundColor: C.paperWarm,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    ...shadow,
  },
  orgDot: { width: 22, height: 22, borderRadius: 11 },
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
  chipRow: { paddingBottom: 6, paddingLeft: 16, paddingRight: 8 },
});
