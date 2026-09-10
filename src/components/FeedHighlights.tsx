import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ListingPhoto } from './ListingPhoto';
import { squareUrl } from '@/api/cloudinary';
import { gradOf, initialsOf } from '@/api/client';
import { useRecentListings } from '@/stores/recent';
import type { Category, Listing, Profile } from '@/api/db';
import type { OrgRow } from '@/api/org';
import { SectionHead } from './SectionHead';
import { C, F, R, S, T, shadow } from '@/theme';

/**
 * Các dải DỮ LIỆU của màn Khám phá — khác `FeedStrips` (trang trí thuần, chữ hardcode):
 *
 * - `FeaturedStrip` "Tin nổi bật": xếp theo mức quan tâm thật (tim + lượt xem của BE).
 * - `CategoryStrip` "Danh mục sôi động": đếm tin theo danh mục, bấm là mở kết quả lọc.
 * - `OrgNearbyStrip` "Nhóm quanh bạn": nhóm công khai cùng tỉnh với KHU VỰC ĐÃ GIẢI của người xem
 *   (`profile.area` — tự khai, hoặc suy từ nơi họ đã đăng tin).
 * - `RecentStrip` "Xem gần đây": snapshot tại máy (`@/stores/recent`), ghi mỗi lần mở tin.
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
  const { width: winW } = useWindowDimensions();
  // Chỉ tin ĐÃ có người quan tâm: hệ mới toanh mà vẫn bày "nổi bật" thì đó là 8 tin
  // ngẫu nhiên đội lốt — thà giấu dải còn hơn dạy người dùng rằng nhãn này vô nghĩa.
  const top = listings
    .filter((l) => score(l) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX_FEATURED);

  if (top.length === 0) return null;

  /*
   * Mỗi slide to bằng MỘT thẻ tin của bảng (full bề ngang trừ lề 16 hai bên), chỉ hụt thêm
   * 20px để ló mép thẻ kế — không có mép ló thì thẻ full-width trông như một tin của bảng
   * và chẳng ai biết chỗ này lướt ngang được.
   */
  const cardW = winW - 32 - 20;
  const GAP = 11;

  return (
    <View style={[styles.block, grid && styles.inset]}>
      <SectionHead title="Tin nổi bật 🔥" onSeeAll={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        // Lướt là đậu đúng mép một thẻ, không dừng lửng giữa hai tin.
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
      >
        {top.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item.id)}
            style={({ pressed }) => [styles.featCard, { width: cardW }, pressed && { opacity: 0.9 }]}
          >
            <ListingPhoto
              photo={item.photo}
              photoUrl={item.photoUrls?.[0]}
              style={styles.featPhoto}
              imageStyle={styles.featPhotoRadius}
            >
              <View style={styles.featPrice}>
                <Text style={styles.featPriceText}>{item.price}</Text>
              </View>
            </ListingPhoto>
            <View style={styles.featBody}>
              <Text numberOfLines={2} style={styles.featTitle}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.featMeta}>
                {item.favoriteCount > 0 ? `❤️ ${item.favoriteCount} quan tâm · ` : ''}
                👁 {item.viewCount} lượt xem
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
            {/*
              Nền màu suy từ `cat.id`, cùng bảng với vòng tròn nhóm ngay dưới — hai dải trên
              một màn hình phải cùng một ngôn ngữ, nền trắng phẳng làm dải này trông như chưa
              tải xong.

              Dùng được vì `NEW_PHOTOS` là bộ pastel dịu (`#EFCB9C`…`#D9C2C2`): emoji danh mục
              tự nó đã có màu, nên nền phải NHẠT hơn nó chứ không tranh với nó. Cùng `id` luôn
              ra cùng màu, nên một danh mục giữ đúng màu đó ở mọi lần mở.
            */}
            <LinearGradient
              colors={gradOf(cat.id)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.circle, styles.circleCenter]}
            >
              <Text style={styles.circleIcon}>{cat.icon}</Text>
            </LinearGradient>
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
  onOpen: (slug: string) => void;
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
        {nearby.map((org) => {
          // Avatar nếu có, không thì ảnh bìa. Tính MỘT lần: gọi hai lần rồi `!` để dập cảnh
          // báo null là tự tay tắt đúng thứ đang bảo vệ mình.
          const face = org.avatarUrl || org.coverUrl;
          return (
          <Pressable
            key={org.slug}
            onPress={() => onOpen(org.slug)}
            style={({ pressed }) => [styles.circleItem, pressed && { opacity: 0.75 }]}
          >
            {/*
              Ba bậc: avatar → ẢNH BÌA → chữ viết tắt.

              Bìa làm bậc hai vì màn sửa hồ sơ nhóm hỏi bìa TRƯỚC avatar, nên nhóm có ảnh mà
              chưa đặt avatar là ca thường gặp nhất — bỏ bậc này là hiện chữ viết tắt cho một
              nhóm đang có ảnh hẳn hoi. `squareUrl` cắt theo chủ thể, không cắt giữa mù.
            */}
            {face ? (
              <View style={styles.circle}>
                <Image
                  source={{ uri: squareUrl(face, 200) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <LinearGradient
                colors={gradOf(org.slug)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.circle, styles.circleCenter]}
              >
                <Text style={styles.circleInitials}>{initialsOf(org.name)}</Text>
              </LinearGradient>
            )}
            <Text numberOfLines={1} style={styles.circleName}>
              {org.name}
            </Text>
            <Text style={styles.circleCount}>{org.memberCount} thành viên</Text>
          </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* -------------------------------- Xem gần đây -------------------------------- */

export function RecentStrip({ grid, onOpen }: { grid?: boolean; onOpen: (id: string) => void }) {
  const { width: winW } = useWindowDimensions();
  const items = useRecentListings();
  if (items.length === 0) return null;

  // Cùng số đo slide với `FeaturedStrip` — hai dải thẻ tin trên cùng một màn mà hai cỡ
  // khác nhau thì trông như hai app ghép lại.
  const cardW = winW - 32 - 20;
  const GAP = 11;

  return (
    <View style={[styles.block, grid && styles.inset]}>
      <SectionHead title="Xem gần đây" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item.id)}
            style={({ pressed }) => [styles.featCard, { width: cardW }, pressed && { opacity: 0.9 }]}
          >
            <ListingPhoto
              photo={item.photo}
              photoUrl={item.photoUrl}
              style={styles.featPhoto}
              imageStyle={styles.featPhotoRadius}
            >
              <View style={styles.featPrice}>
                <Text style={styles.featPriceText}>{item.price}</Text>
              </View>
            </ListingPhoto>
            <View style={styles.featBody}>
              <Text numberOfLines={2} style={styles.featTitle}>
                {item.title}
              </Text>
            </View>
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

  featCard: { backgroundColor: C.paperWarm, borderRadius: R.md, ...shadow },
  featPhoto: { height: 200, borderTopLeftRadius: R.md, borderTopRightRadius: R.md },
  featPhotoRadius: { borderTopLeftRadius: R.md, borderTopRightRadius: R.md },
  /** Nhãn giá đè góc ảnh — cùng thủ pháp `priceTag` của NoteCard, người dùng đã quen mắt. */
  featPrice: {
    position: 'absolute',
    left: S.lg,
    bottom: -2,
    backgroundColor: C.brandDark,
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 1,
    borderRadius: R.sm,
    borderBottomLeftRadius: 0,
  },
  featPriceText: { color: '#fff', fontFamily: F.monoBold, ...T.sm },
  featBody: { padding: S.lg },
  /* Tiêu đề thẻ về `T.md` (15/22) từ 19/25. Cỡ 19 trên một thẻ ngang 280pt ăn hết hai dòng cho
     một tiêu đề, đẩy phần meta xuống và làm thẻ trông đầy; 15 với `lineHeight` 1.47× vừa gọn
     vừa đủ chỗ cho dấu tiếng Việt. */
  featTitle: { fontFamily: F.uiBold, ...T.md, color: C.ink },
  featMeta: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginTop: S.sm },

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
  circleCenter: { alignItems: 'center', justifyContent: 'center' },

  /* Hai dòng này là HÌNH, không phải chữ — emoji danh mục và chữ cái đầu trong vòng tròn 74px.
     Chúng cố tình đứng ngoài thang `T`: buộc chúng vào thang chữ là để một vòng tròn trang trí
     kéo theo cả phân cấp tiêu đề. */
  circleIcon: { fontSize: 30 },
  circleInitials: { fontFamily: F.uiBold, fontSize: 24, color: '#fff' },
  circleName: { fontFamily: F.uiBold, ...T.sm, color: C.ink, maxWidth: 96 },
  circleCount: { fontFamily: F.ui, ...T.xs, color: C.muted },
});
