import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FeedGreeting } from './FeedGreeting';
import { FeedSearchCard } from './FeedSearchCard';
import type { MyOrg } from '@/api/org';
import type { Category } from '@/api/db';
import type { ProvinceName } from '@/api/location';
import { C, F, R } from '@/theme';

/**
 * Phần đầu bảng tin: khối chào nền xanh tràn lên đỉnh máy (dòng chào + nhóm + thẻ tìm), rồi hàng
 * chip danh mục.
 *
 * **Hai tầng chuyển động, theo đúng hai vai trò.** Khối xanh là NỘI DUNG: nó cuộn đi một lần rồi
 * thôi, nên `onTitleLayout` đo đúng khối đó (xem `collapse` trong `feed.tsx`). Hàng chip là CÔNG
 * CỤ lọc nên nó ở lại, chỉ trốn/hiện theo hướng cuộn — đó là lý do hai thứ không nằm chung một
 * View đo được.
 *
 * Thuần trình bày, mọi lối đi đều qua props (`component.convention`); hoạt ảnh ẩn/hiện thanh ở
 * lại màn hình, nơi giữ shared value.
 */
export function FeedBar({
  topInset,
  name,
  avatar,
  avatarUrl,
  myOrgs,
  categories,
  categoryId,
  onCategory,
  onSearch,
  onProfile,
  onSignIn,
  onSaved,
  onMyListings,
  onOrg,
  onFindOrg,
  onTitleLayout,
}: {
  /** Chiều cao tai thỏ. Nền xanh phải chạy lên tận đỉnh, nên inset nằm TRONG nền chứ không ngoài. */
  topInset: number;
  /** Tên người đang đăng nhập. `undefined` = khách — vẫn xem được bảng tin. */
  name?: string;
  avatar: string;
  avatarUrl?: string;
  myOrgs: MyOrg[];
  categories: Category[];
  categoryId: string;
  onCategory: (id: string) => void;
  onSearch: (province: ProvinceName | null) => void;
  onProfile: () => void;
  onSignIn: () => void;
  onSaved: () => void;
  onMyListings: () => void;
  onOrg: (slug: string) => void;
  onFindOrg: () => void;
  /** Chiều cao khối xanh, để màn hình biết cuộn bao nhiêu thì nó đi hết. */
  onTitleLayout: (height: number) => void;
}) {
  return (
    <>
      <View onLayout={(e) => onTitleLayout(e.nativeEvent.layout.height)}>
        <LinearGradient
          colors={[C.brand, C.brandDark]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.hero, { paddingTop: topInset + 10 }]}
        >
          {/* Vòng sáng mờ thay cho ảnh banner của bản mẫu: không có asset nào để dùng, mà một
              mảng xanh phẳng cao 300dp thì trông như ảnh chưa tải xong. */}
          <View pointerEvents="none" style={styles.glow} />

          <FeedGreeting
            name={name}
            avatar={avatar}
            avatarUrl={avatarUrl}
            myOrgs={myOrgs}
            onProfile={onProfile}
            onSignIn={onSignIn}
            onSaved={onSaved}
            onMyListings={onMyListings}
            onOrg={onOrg}
            onFindOrg={onFindOrg}
          />

          <FeedSearchCard
            categories={categories}
            categoryId={categoryId}
            onCategory={onCategory}
            onSearch={onSearch}
          />
        </LinearGradient>
      </View>

      {/* Chỉ hiện khi BE trả về danh mục — hỏng hoặc rỗng thì giấu hẳn hàng chip thay vì để một
          hàng trơ ra không bấm được gì. */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rail}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="Tất cả" on={categoryId === ''} onPress={() => onCategory('')} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.icon ? `${c.icon} ${c.name}` : c.name}
              on={categoryId === c.id}
              onPress={() => onCategory(c.id)}
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * `overflow: hidden` để cắt vòng sáng theo mép bo. Cũng vì thế `paddingBottom` phải đủ rộng:
   * bóng đổ của thẻ tìm bị cắt cụt ngay tại đường bo nếu thẻ nằm sát mép dưới.
   */
  hero: {
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -70,
    right: -60,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  // Xem `rail` bên `FeedGreeting`: RN gán sẵn `flexGrow/flexShrink: 1` cho mọi ScrollView.
  rail: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    flexDirection: 'row',
    gap: 7,
    paddingTop: 10,
    paddingBottom: 2,
    paddingLeft: 16,
    paddingRight: 8,
  },
  chip: {
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.ink },
  chipTextOn: { color: C.paperWarm },
});
