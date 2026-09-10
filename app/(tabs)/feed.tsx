import React from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from '@/components/Surface';
import { FeedBar } from '@/components/FeedBar';
import { BannerBoard, GuideStrip, PerkStrip, PromoStrip } from '@/components/FeedStrips';
import {
  CategoryStrip,
  FeaturedStrip,
  OrgNearbyStrip,
  RecentStrip,
} from '@/components/FeedHighlights';
import { useRequireAuth } from '@/components/GuestGate';
import { useCollapsingHeader } from '@/components/useCollapsingHeader';
import { useCategories, useListings, useProfile } from '@/queries/listings';
import { useMyOrgs } from '@/queries/org';
import { useOrgDiscover } from '@/queries/org-discover';
import { EMPTY_SEARCH, searchToParams } from '@/api/db';
import type { Banner } from '@/api/placeholders';
import type { ProvinceName } from '@/api/location';
import { C } from '@/theme';

/**
 * Trang chủ là trang KHÁM PHÁ, không phải bảng tin: các dải nổi bật + khu vực + xem gần
 * đây + banner. Danh sách tin đầy đủ nằm sau tìm kiếm — chip danh mục và thẻ tìm kiếm
 * trên thanh đầu đều dẫn thẳng sang trang kết quả thay vì lọc tại chỗ như bản trước.
 */
export default function Feed() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const { data: categories } = useCategories();
  // Vẫn cần bảng tin (không lọc) làm NGUỒN SỐ LIỆU cho "Tin nổi bật" và "Khu vực sôi nổi",
  // dù không còn bày nó ra thành danh sách.
  const { data: allListings, isRefetching, refetch } = useListings();
  const { data: profile } = useProfile();
  const { data: myOrgs } = useMyOrgs();
  // Nhóm công khai cho dải "Nhóm quanh bạn" — cùng nguồn với màn khám phá nhóm (từ khoá
  // rỗng = danh sách gợi ý), lọc theo tỉnh trong hồ sơ diễn ra ở client.
  const { data: orgs } = useOrgDiscover('');

  /**
   * Mở trang KẾT QUẢ, kể cả khi chưa có tiêu chí nào.
   *
   * Bản trước rẽ sang form `/search` khi cả ba đều rỗng, và đó là một cửa chặn đặt sai chỗ:
   * người bấm ô tìm kiếm muốn THẤY TIN, không muốn khai tờ khai trước. Bộ lọc rỗng nay là một
   * lượt tìm hợp lệ và trả về tất cả tin, còn `SearchCrumbBar` ở trang kết quả luôn có nút "Bộ
   * lọc" — nên form vẫn cách đó đúng một lần bấm, chỉ là không còn nằm chắn ngang đường.
   */
  const openSearch = (q: string, categoryId: string | null, province: ProvinceName | null) =>
    router.push({
      pathname: '/search/results',
      params: searchToParams({ ...EMPTY_SEARCH, q: q.trim(), categoryId, province }),
    });

  const openBanner = (banner: Banner) => {
    const go = () => router.push(banner.route as never);
    if (banner.authMessage) requireAuth(go, banner.authMessage);
    else go();
  };

  // Thanh đầu nổi: khối xanh cuộn đi như nội dung, hàng chip ở lại cố định.
  const bar = useCollapsingHeader();

  return (
    <Surface>
      <Animated.ScrollView
        onScroll={bar.onScroll}
        // 16ms = mỗi khung hình. Thanh bám đúng vị trí cuộn, nên nhịp sự kiện CHÍNH LÀ nhịp
        // chuyển động: để mặc định (Android bắn rất thưa) là thanh đứng vài khung rồi nhảy.
        scrollEventThrottle={16}
        contentContainerStyle={{
          // Chừa đúng chiều cao thanh nổi: nó nằm NGOÀI cuộn nên không tự đẩy nội dung xuống.
          paddingTop: bar.height,
          paddingBottom: 32,
          paddingHorizontal: 16,
        }}
        refreshControl={
          // Bọc `refetch` chứ không truyền thẳng: RefreshControl gọi handler không tham số
          // nhưng `refetch` nhận `RefetchOptions`, và nó trả Promise mà prop này không nhận.
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={C.brandTx}
            progressViewOffset={bar.height}
          />
        }
      >
        <PromoStrip />
        <FeaturedStrip
          listings={allListings ?? []}
          onOpen={(id) => router.push(`/listing/${id}`)}
          onSeeAll={() => openSearch('', null, null)}
        />
        <CategoryStrip
          listings={allListings ?? []}
          categories={categories ?? []}
          onOpen={(id) => openSearch('', id, null)}
        />
        <OrgNearbyStrip
          orgs={orgs ?? []}
          area={profile?.area ?? null}
          onOpen={(slug) => router.push(`/org/${slug}`)}
        />
        <RecentStrip onOpen={(id) => router.push(`/listing/${id}`)} />

        {/*
          Ba khối TIẾP THỊ, LUÔN hiện, đặt ở cuối.

          Nội dung của chúng là hardcode trong `api/placeholders` (`BANNERS`, `GUIDE_STEPS`,
          `PERKS`) — chữ giới thiệu, không phải dữ liệu. Đã có một lượt gác chúng sau cờ
          `isGuest` để bảng tin của người đã đăng nhập gọn còn 5 mục; BỎ vì đó là quyết định
          SẢN PHẨM chứ không phải quyết định layout — nó làm nội dung biến mất khỏi màn mà
          chủ sản phẩm không chờ đợi. Muốn gọn lại thì gác lại, nhưng phải là lựa chọn có ý
          thức, không phải hệ quả kèm theo của một lượt dọn giao diện.

          Việc xếp chúng xuống CUỐI thì giữ: nội dung thật (tin, danh mục, nhóm) lên trước.
        */}
        <BannerBoard onPress={openBanner} />
        <GuideStrip />
        <PerkStrip />
      </Animated.ScrollView>

      {/*
        Thanh đầu nằm NGOÀI vùng cuộn và phủ lên trên nó.
        `pointerEvents="box-none"` để khoảng trống của thanh không nuốt cú chạm rơi vào nội
        dung phía dưới — chỉ những ô thật sự bấm được (thẻ tìm, avatar, chip) mới nhận.
      */}
      <Animated.View
        pointerEvents="box-none"
        onLayout={(e) => bar.measure(e.nativeEvent.layout.height)}
        style={[styles.bar, bar.style]}
      >
        <FeedBar
          onTitleLayout={bar.onTitleLayout}
          // Nền xanh chạy lên tận đỉnh máy, nên tai thỏ do chính khối đó chừa chỗ.
          topInset={insets.top}
          // Khách không có hồ sơ (query tự tắt khi chưa đăng nhập) — `undefined` ở đây là
          // khách, và khối chào bỏ hẳn avatar chứ không vẽ một vòng tròn rỗng bấm được.
          me={profile && { name: profile.name, avatar: profile.avatar, avatarUrl: profile.avatarUrl }}
          myOrgs={myOrgs ?? []}
          categories={categories ?? []}
          // Không còn bảng để lọc tại chỗ: chip là LỐI ĐI sang trang kết quả, nên không chip
          // nào ở trạng thái "đang chọn" ('' = "Tất cả" sáng như mặc định).
          categoryId=""
          onCategory={(id) => id && openSearch('', id, null)}
          onSearch={openSearch}
          onProfile={() => router.push('/(tabs)/profile')}
          onSignIn={() => router.push('/login')}
          onSaved={() => requireAuth(() => router.push('/saved'), 'Đăng nhập để xem tin đã lưu')}
          onMyListings={() =>
            requireAuth(() => router.push('/mylistings'), 'Đăng nhập để xem tin của bạn')
          }
          onOrg={(slug) => router.push(`/org/${slug}`)}
          onFindOrg={() => requireAuth(() => router.push('/join-org'), 'Đăng nhập để vào nhóm')}
        />
      </Animated.View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  /*
   * Thanh đầu nổi. `position: absolute` để nó KHÔNG chiếm chỗ trong dòng chảy — nội dung
   * cuộn phía dưới nó, và `paddingTop` của vùng cuộn mới là thứ chừa chỗ.
   *
   * Có nền riêng: thanh trượt lên xuống trên nội dung, để trong suốt thì chữ bên dưới đè
   * lên chữ thanh trong suốt quá trình trượt.
   */
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: C.cork,
    paddingBottom: 4,
  },
});
