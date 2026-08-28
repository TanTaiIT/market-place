import React, { useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface } from '@/components/Surface';
import { FeedBar } from '@/components/FeedBar';
import { PerkStrip, PromoStrip } from '@/components/FeedStrips';
import { ListingCard } from '@/components/ListingCard';
import { NoteCard } from '@/components/NoteCard';
import { useRequireAuth } from '@/components/GuestGate';
import { useHideOnScroll } from '@/components/useHideOnScroll';
import { EmptyState, Loading } from '@/components/ui';
import { useCategories, useListings, useProfile, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useMyOrgs } from '@/queries/org';
import { useActiveOrg } from '@/queries/org-discover';
import { EMPTY_SEARCH, searchToParams } from '@/api/db';
import type { ProvinceName } from '@/api/location';
import { C } from '@/theme';

export default function Feed() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  // Chuỗi rỗng = "Tất cả". Giữ id chứ không giữ tên: BE lọc theo ObjectId của danh mục.
  const [categoryId, setCategoryId] = useState('');
  const { data: categories } = useCategories();
  const { data, error, isLoading, isRefetching, refetch } = useListings(categoryId);
  const { data: profile } = useProfile();
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const { data: myOrgs } = useMyOrgs();

  /*
   * BE không snapshot tên tổ chức vào tin, chỉ có `organizationId`. Tra từ danh sách tổ
   * chức của CHÍNH người đang xem là đủ và trung thực: tin nội bộ chỉ đến tay thành viên
   * của tổ chức đó. Tra không ra (tin công khai, hoặc master không thuộc tổ chức nào) thì
   * thẻ tự bỏ dòng đó — thà thiếu một dòng còn hơn bịa tên một tổ chức.
   */
  const orgNameById = new Map((myOrgs ?? []).map((o) => [o.id, o.name]));

  /*
   * Kiểu bày do QUẢN TRỊ NHÓM đặt (`PATCH /organizations/current`), không phải người xem.
   *
   * Qua `useActiveOrg` chứ không tự tra `myOrgs`: phép tra đó có hai luật ngầm (nhóm duy
   * nhất thì BE tự suy, và master không nằm trong `myOrgs`) — viết lại tại chỗ là chép lại
   * cả hai lỗi, đúng thứ đã xảy ra ở màn cấu hình cách bày.
   */
  const { layout } = useActiveOrg();
  const grid = layout === 'grid';
  const saved = new Set(savedIds ?? []);

  const activeCategory = categories?.find((c) => c.id === categoryId);

  /*
   * Nút "Tìm tin" của thẻ đầu trang.
   *
   * Có tiêu chí thì sang thẳng trang kết quả; chưa chọn gì thì mở FORM tiêu chí, vì trang kết quả
   * không tiêu chí chỉ là một ô rỗng — `useSearch` không bay khi không có ràng buộc nào.
   */
  const openSearch = (province: ProvinceName | null) =>
    router.push({
      pathname: categoryId || province ? '/search/results' : '/search',
      params: searchToParams({ ...EMPTY_SEARCH, categoryId: categoryId || null, province }),
    });

  // Thanh đầu nổi: khối xanh cuộn đi như nội dung, hàng chip trốn/hiện theo hướng cuộn.
  const bar = useHideOnScroll();

  return (
    <Surface>
      <Animated.FlatList
        // `numColumns` không đổi tại chỗ được: RN yêu cầu dựng lại danh sách, và `key` là
        // đòn bẩy duy nhất làm việc đó.
        key={layout}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? { gap: 14, paddingHorizontal: 16 } : undefined}
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        onScroll={bar.onScroll}
        // 16ms = mỗi khung hình. Không phải để thanh bám tay (nó không bám nữa) mà để nhận ra
        // hướng cuộn kịp lúc: Android mặc định bắn sự kiện rất thưa, và ngưỡng `SCROLL_SLOP`
        // sẽ chỉ đạt được sau khi người dùng đã cuộn qua cả một tin.
        scrollEventThrottle={16}
        contentContainerStyle={{
          // Chừa đúng chiều cao thanh nổi: nó nằm NGOÀI danh sách nên không tự đẩy nội dung
          // xuống. `insets.top` đã nằm trong con số đo được, không cộng lại lần nữa.
          paddingTop: bar.height,
          paddingBottom: 32,
          ...(grid ? {} : { paddingHorizontal: 16 }),
          // 22 chứ không 8: đinh ghim nhô lên khỏi mép thẻ, thiếu chỗ thì nó đè lên thẻ trên.
          gap: 14,
        }}
        refreshControl={
          // Bọc `refetch` chứ không truyền thẳng: RefreshControl gọi handler không tham số nhưng
          // `refetch` nhận `RefetchOptions`, và nó trả Promise mà prop này không nhận.
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={C.brandTx}
            progressViewOffset={bar.height}
          />
        }
        renderItem={({ item, index }) =>
          grid ? (
            // Ô thumbnail của lưới 2 cột — cùng component mà `/saved` và trang cá nhân dùng,
            // nên hai kiểu bày không phải nuôi hai bản layout riêng.
            <NoteCard item={item} index={index} onPress={() => router.push(`/listing/${item.id}`)} />
          ) : (
            <ListingCard
              item={item}
              index={index}
              orgName={item.organizationId ? orgNameById.get(item.organizationId) : undefined}
              saved={saved.has(item.id)}
              onPress={() => router.push(`/listing/${item.id}`)}
              onToggleSave={() =>
                requireAuth(
                  () => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) }),
                  'Đăng nhập để lưu tin',
                )
              }
            />
          )
        }
        /*
          Hai dải trang trí của bản mẫu. Ở chế độ lưới, `contentContainerStyle` không có lề
          ngang (lề nằm ở `columnWrapperStyle` của từng hàng), nên header/footer phải tự bù —
          thiếu bước này thì banner dính sát mép màn.
        */
        ListHeaderComponent={<PromoStrip grid={grid} />}
        ListFooterComponent={<PerkStrip grid={grid} />}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message || 'Chưa tải được bảng tin'} />
          ) : (
            <EmptyState
              icon="📌"
              text={
                activeCategory
                  ? `Chưa có tin nào trong mục ${activeCategory.name}`
                  : 'Chưa có tin nào để hiển thị'
              }
            />
          )
        }
      />

      {/*
        Thanh đầu nằm NGOÀI danh sách và phủ lên trên nó.
        `pointerEvents="box-none"` để khoảng trống của thanh không nuốt cú chạm rơi vào tin
        phía dưới — chỉ những ô thật sự bấm được (thẻ tìm, avatar, chip) mới nhận.
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
          // Khách không có hồ sơ (query tự tắt khi chưa đăng nhập) — khối chào đọc `undefined`
          // là khách và đổi lời chào, không phải hiện tên rỗng.
          name={profile?.name}
          avatar={profile?.avatar ?? '·'}
          avatarUrl={profile?.avatarUrl}
          myOrgs={myOrgs ?? []}
          categories={categories ?? []}
          categoryId={categoryId}
          onCategory={setCategoryId}
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
   * Thanh đầu nổi. `position: absolute` để nó KHÔNG chiếm chỗ trong dòng chảy — danh sách
   * cuộn phía dưới nó, và `paddingTop` của danh sách mới là thứ chừa chỗ.
   *
   * Có nền riêng: thanh trượt lên xuống trên nội dung, để trong suốt thì chữ tin đè lên chữ
   * thanh trong suốt quá trình trượt.
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
