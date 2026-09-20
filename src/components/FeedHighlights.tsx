import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CategoryLogo } from './CategoryLogo';
import { ListingSlide, SlideRow } from './ListingSlide';
import { OrgFace } from './OrgFace';
import type { Category, Listing, Profile } from '@/api/db';
import type { OrgRow } from '@/api/org';
import { SectionHead } from './SectionHead';
import { C, F, S, T, shadow } from '@/theme';

/**
 * Các dải DỮ LIỆU của màn Khám phá — khác `FeedStrips` (trang trí thuần, chữ hardcode):
 *
 * - `FeaturedStrip` "Tin nổi bật": xếp theo mức quan tâm thật (tim + lượt xem của BE).
 * - `CategoryStrip` "Danh mục sôi động": đếm tin theo danh mục, bấm là mở kết quả lọc.
 * - `OrgNearbyStrip` "Nhóm quanh bạn": nhóm công khai cùng tỉnh với KHU VỰC ĐÃ GIẢI của người xem
 *   (`profile.area` — tự khai, hoặc suy từ nơi họ đã đăng tin).
 *
 * Mọi dải TỰ GIẤU khi chưa có gì để bày — dải trống với một tiêu đề trơ trọi trông như màn
 * hình lỗi, và người dùng mới (chưa xem tin nào, chưa khai tỉnh) là người dễ gặp nhất.
 */

/** Trần chung của các hàng vòng tròn: để LƯỚT, không phải danh bạ đầy đủ. */
const MAX_CIRCLES = 6;

/**
 * Điểm nổi bật: tim nặng hơn lượt xem — lưu tin là hành động có chủ đích, còn lượt xem
 * tăng cả khi người ta bấm nhầm. Hệ số 3 là ước lượng, không phải hằng số nghiệp vụ.
 */
const score = (l: Listing) => l.favoriteCount * 3 + l.viewCount;

/* -------------------------------- Tin nổi bật -------------------------------- */

/** Một hàng lướt được, không phải bảng tin thứ hai. */
/*
 * 4 chứ không 8. Dải ngang 8 thẻ thì 6 thẻ nằm ngoài mép phải và không có gì cho biết còn
 * bao nhiêu nữa — người dùng vuốt mò hoặc bỏ qua cả dải. Bày 4 rồi đưa lối 'Xem tất cả ›'
 * (xem `SectionHead`) nói đúng thứ cần nói: đây là mẫu, muốn hết thì có một trang riêng.
 */
const MAX_FEATURED = 4;

export function FeaturedStrip({
  listings,
  grid,
  onOpen,
  onSeeAll,
}: {
  listings: Listing[];
  grid?: boolean;
  onOpen: (id: string) => void;
  /** Mở trang kết quả không kèm bộ lọc — dải chỉ bày `MAX_FEATURED` tin đầu. */
  onSeeAll?: () => void;
}) {
  // Chỉ tin ĐÃ có người quan tâm: hệ mới toanh mà vẫn bày "nổi bật" thì đó là 8 tin
  // ngẫu nhiên đội lốt — thà giấu dải còn hơn dạy người dùng rằng nhãn này vô nghĩa.
  const top = listings
    .filter((l) => score(l) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX_FEATURED);

  if (top.length === 0) return null;

  return (
    <View style={[styles.block, grid && styles.inset]}>
      <SectionHead title="Tin nổi bật 🔥" onSeeAll={onSeeAll} />
      <SlideRow>
        {top.map((item) => (
          <ListingSlide key={item.id} item={item} onPress={() => onOpen(item.id)} />
        ))}
      </SlideRow>
    </View>
  );
}

/* ------------------------------ Danh mục sôi động ------------------------------ */

export function CategoryStrip({
  listings,
  categories,
  grid,
  onOpen,
}: {
  listings: Listing[];
  categories: Category[];
  grid?: boolean;
  onOpen: (categoryId: string) => void;
}) {
  // Đếm tại chỗ mỗi render: mảng tối đa ~50 tin (trần `limit` của BE), memo hoá là thêm
  // một tầng phải đọc cho một phép đếm rẻ hơn cả chính lần render.
  const counts = new Map<string, number>();
  for (const l of listings) {
    if (l.categoryId) counts.set(l.categoryId, (counts.get(l.categoryId) ?? 0) + 1);
  }
  // Join với từ điển danh mục để lấy tên + icon; danh mục đã bị gỡ mà tin cũ còn trỏ tới
  // thì rơi khỏi dải — không vẽ nổi một vòng tròn không tên.
  const top = categories
    .map((cat) => ({ cat, count: counts.get(cat.id) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CIRCLES);

  if (top.length === 0) return null;

  return (
    <View style={[styles.block, grid && styles.inset]}>
      {/* Không có `onSeeAll`: dải này ĐÃ là toàn bộ danh mục sôi động, không có trang nào sâu hơn. */}
      <SectionHead title="Danh mục sôi động" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {top.map(({ cat, count }) => (
          <Pressable
            key={cat.id}
            onPress={() => onOpen(cat.id)}
            style={({ pressed }) => [styles.circleItem, pressed && { opacity: 0.75 }]}
          >
            {/* Nền, cỡ và bóng đổ của vòng tròn đều do `CategoryLogo` giữ — cùng sắc mà danh
                mục này mang ở hàng chip và ở màn đăng tin. */}
            <View style={styles.circleWrap}>
              <CategoryLogo category={cat} size="lg" />
            </View>
            <Text numberOfLines={1} style={styles.circleName}>
              {cat.name}
            </Text>
            <Text style={styles.circleCount}>{count} tin đang đăng</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* -------------------------------- Nhóm quanh bạn -------------------------------- */


export function OrgNearbyStrip({
  area,
  orgs,
  grid,
  onOpen,
}: {
  /**
   * Khu vực đã giải của người xem, lấy nguyên từ `profile.area` — BE quyết, client không tự
   * nối thang ưu tiên. `null` (khách, hoặc chưa khai và chưa đăng tin nào) thì dải tự ẩn.
   */
  area: Profile['area'];
  orgs: OrgRow[];
  grid?: boolean;
  onOpen: (orgId: string) => void;
}) {
  if (!area) return null;

  // `provinceCode` của nhóm chính là chuỗi BE render ra phần "ở đâu" (xem `whereOf`),
  // nên so thẳng với khu vực đã giải — không có bảng mã riêng nào để tra.
  const nearby = orgs.filter((o) => o.provinceCode === area.province).slice(0, MAX_CIRCLES);

  if (nearby.length === 0) return null;

  return (
    <View style={[styles.block, grid && styles.inset]}>
      {/*
        `note` nói ra khu vực đang dùng, và nói ra khi nó là SUY RA chứ không phải người dùng tự
        khai. Đoán sai mà người xem nhìn thấy dòng này thì họ biết vào hồ sơ sửa; đoán sai âm
        thầm thì họ chỉ thấy một dải toàn nhóm lạ và kết luận app hỏng.
      */}
      <SectionHead
        title="Nhóm quanh bạn"
        note={
          area.source === 'listings'
            ? `${area.province} — theo khu vực các tin bạn đã đăng`
            : area.province
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {nearby.map((org) => (
          <Pressable
            key={org.id}
            onPress={() => onOpen(org.id)}
            style={({ pressed }) => [styles.circleItem, pressed && { opacity: 0.75 }]}
          >
            {/* Chuỗi ba bậc avatar → bìa → chữ viết tắt nằm trong `OrgFace` — cùng một bản với
                hai thẻ nhóm ở màn khám phá, nên một nhóm hiện ra giống nhau ở mọi bề mặt. */}
            <OrgFace
              seed={org.id}
              name={org.name}
              avatarUrl={org.avatarUrl}
              coverUrl={org.coverUrl}
              style={[styles.circle, styles.circleWrap]}
              initialsSize={24}
            />
            <Text numberOfLines={1} style={styles.circleName}>
              {org.name}
            </Text>
            <Text style={styles.circleCount}>{org.memberCount} thành viên</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  /* `S.xl` giữa hai khối, không phải 18: đây là đòn 'thoáng' mạnh nhất của cả màn — khoảng thở
     giữa các mục là thứ mắt đọc ra trước cả màu và cỡ chữ. Đừng hạ để nhồi thêm mục. */
  block: { marginBottom: S.xl },
  /** Chế độ LƯỚI không có lề ngang ở container của danh sách nên dải phải tự bù. */
  inset: { paddingHorizontal: S.lg },
  row: { gap: S.md, paddingRight: S.xs },

  /* Vòng tròn dùng chung cho danh mục và nhóm — hai dải cùng ngôn ngữ "story" như Mioto. */
  circleItem: { alignItems: 'center', width: 96 },
  circle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    // Ảnh vuông nhét vòng tròn phải cắt — thiếu dòng này thì góc ảnh lòi ra ngoài viền.
    overflow: 'hidden',
    marginBottom: S.sm,
    ...shadow,
  },
  /* Khoảng thở dưới vòng tròn. Phải ở lớp bọc chứ không nhét vào `CategoryLogo`/`OrgFace`: cùng
     cỡ đó cũng dùng ở chỗ khác, và lề là việc của bố cục quanh nó. */
  circleWrap: { marginBottom: S.sm },
  circleName: { fontFamily: F.uiBold, ...T.sm, color: C.ink, maxWidth: 96 },
  circleCount: { fontFamily: F.ui, ...T.xs, color: C.muted },
});
