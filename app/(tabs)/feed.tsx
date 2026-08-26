import React, { useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { FeedBar } from '@/components/FeedBar';
import { FeedCard } from '@/components/FeedCard';
import { NoteCard } from '@/components/NoteCard';
import { EmptyState, Loading } from '@/components/ui';
import { useCategories, useListings, useProfile, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useOpenConversation } from '@/queries/chat';
import { useMyOrgs } from '@/queries/org';
import { useActiveOrg } from '@/queries/org-discover';
import { useToast } from '@/components/Toast';
import { C } from '@/theme';

/** Phải cuộn liên tục chừng này pixel theo một hướng thì thanh mới đổi trạng thái. */
const SCROLL_SLOP = 12;
/** Thời gian thanh trốn đi hoặc quay lại. Đủ ngắn để không cảm thấy chờ, đủ dài để thấy nó trôi. */
const HIDE_MS = 220;

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Chuỗi rỗng = "Tất cả". Giữ id chứ không giữ tên: BE lọc theo ObjectId của danh mục.
  const [categoryId, setCategoryId] = useState('');
  const { data: categories } = useCategories();
  const { data, error, isLoading, isRefetching, refetch } = useListings(categoryId);
  const { data: profile } = useProfile();
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const openChat = useOpenConversation();
  const { data: myOrgs } = useMyOrgs();
  const toast = useToast();

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

  const message = (listingId: string) =>
    openChat.mutate(listingId, {
      onSuccess: (c) => router.push(`/chat/${c.id}`),
      onError: (e: Error) => toast(`⚠️ ${e.message}`),
    });

  const activeCategory = categories?.find((c) => c.id === categoryId);

  /*
   * ── Thanh đầu trốn khi cuộn xuống, hiện lại khi cuộn lên ────────────────────────────
   *
   * Mọi giá trị ở đây sống trên UI THREAD (`useSharedValue`), không phải state của React:
   * handler cuộn chạy mỗi khung hình, mà mỗi lần `setState` là một vòng render — thanh sẽ
   * giật và trễ sau ngón tay. Đó là lý do dùng `useAnimatedScrollHandler` chứ không phải
   * `onScroll` thường.
   */
  /** Vị trí cuộn của khung hình TRƯỚC — chỉ để tính được đi lên hay đi xuống bao nhiêu. */
  const lastY = useSharedValue(0);
  /**
   * Chiều cao dòng chữ tay, và phần của nó đã bị cuộn đi.
   *
   * Đây là chuyển động THỨ HAI, độc lập với việc trốn/hiện: dòng chữ tay chỉ là nhãn, nó
   * cuộn đi một lần rồi thôi. Ô tìm, hàng nhóm và hàng danh mục là công cụ nên chúng ở lại.
   */
  const titleH = useSharedValue(0);
  const collapse = useSharedValue(0);
  /** Thanh đang bị đẩy lên bao nhiêu pixel: `0` = hiện hẳn, `barH` = trốn hẳn. */
  const shift = useSharedValue(0);
  /**
   * Đã cuộn liên tục bao nhiêu pixel theo MỘT hướng. Đổi hướng là đếm lại từ 0.
   *
   * Đây là thứ lọc rung tay: cuộn chậm thì ngón tay không đi một chiều, nó đi `+2 −1 +3 −1`.
   * Bản trước bám delta 1:1 nên nó phản chiếu y nguyên cái rung đó — trông đúng như giật.
   */
  const run = useSharedValue(0);
  /** Thanh đang ở trạng thái trốn hay không — để không bắn lại animation mỗi khung hình. */
  const hidden = useSharedValue(false);
  /** Chiều cao thật của thanh, đo bằng `onLayout` — xem `measureBar`. */
  const barH = useSharedValue(0);
  /** Bản dành cho React: `paddingTop` của danh sách là style thường, không đọc được shared value. */
  const [barHeight, setBarHeight] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;

      // Bám ĐÚNG vị trí cuộn (không phải delta): dòng chữ tay đi lên đúng bằng số pixel nội
      // dung đã đi, nên mép dưới thanh luôn khớp mép trên nội dung cho tới khi nó khuất hẳn.
      collapse.value = Math.min(Math.max(y, 0), titleH.value);

      // Sát đỉnh thì LUÔN mở. Không có nhánh này, cú kéo quá đà (bounce) ở iOS cho `dy` âm
      // liên tục và thanh sẽ nhảy ra giữa lúc người dùng còn đang thả tay.
      if (y <= 0) {
        run.value = 0;
        if (hidden.value) {
          hidden.value = false;
          shift.value = withTiming(0, { duration: HIDE_MS });
        }
        return;
      }
      if (dy === 0) return;

      // Đổi hướng thì đếm lại: rung tay không bao giờ tích đủ `SCROLL_SLOP` để nhả.
      if (dy > 0 !== run.value > 0) run.value = 0;
      run.value += dy;
      if (Math.abs(run.value) < SCROLL_SLOP) return;

      /*
       * Chạy MỘT animation trọn vẹn tới đầu hoặc cuối, không bám delta nữa.
       *
       * Bám 1:1 chỉ mượt bằng đúng dòng sự kiện cuộn, mà ở tốc độ thấp dòng đó không đều —
       * Android bắn thưa hơn 60Hz, nên thanh đứng vài khung rồi nhảy 3px. Giao cho
       * `withTiming` thì đường đi do reanimated nội suy mỗi khung hình, độc lập hoàn toàn
       * với việc sự kiện cuộn tới lúc nào.
       */
      const wantHidden = run.value > 0;
      run.value = 0;
      if (wantHidden === hidden.value) return;
      hidden.value = wantHidden;
      shift.value = withTiming(wantHidden ? barH.value : 0, { duration: HIDE_MS });
    },
  });

  /*
   * `max` chứ không phải cộng dồn: hai chuyển động cùng đẩy thanh lên, lấy cái xa hơn.
   *
   * Cộng lại thì lúc trốn hẳn thanh bị đẩy quá đà thêm một đoạn bằng dòng chữ tay — vô hình
   * lúc đó, nhưng khi cuộn lên nó phải bò ngược qua đoạn thừa đó trước khi ló ra.
   */
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(collapse.value, shift.value) }],
  }));

  /** Đo thay vì đóng cứng con số: chiều cao đổi theo cỡ chữ hệ thống và theo việc có hàng chip hay không. */
  const measureBar = (h: number) => {
    if (h === barHeight) return;
    barH.value = h;
    setBarHeight(h);
  };

  return (
    <Corkboard>
      <Animated.FlatList
        // `numColumns` không đổi tại chỗ được: RN yêu cầu dựng lại danh sách, và `key` là
        // đòn bẩy duy nhất làm việc đó.
        key={layout}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? { gap: 14, paddingHorizontal: 16 } : undefined}
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        onScroll={onScroll}
        // 16ms = mỗi khung hình. Không phải để thanh bám tay (nó không bám nữa) mà để nhận ra
        // hướng cuộn kịp lúc: Android mặc định bắn sự kiện rất thưa, và ngưỡng `SCROLL_SLOP`
        // sẽ chỉ đạt được sau khi người dùng đã cuộn qua cả một tin.
        scrollEventThrottle={16}
        contentContainerStyle={{
          // Chừa đúng chiều cao thanh nổi: nó nằm NGOÀI danh sách nên không tự đẩy nội dung
          // xuống. `insets.top` đã nằm trong con số đo được, không cộng lại lần nữa.
          paddingTop: barHeight,
          paddingBottom: 32,
          ...(grid ? {} : { paddingHorizontal: 16 }),
          // 22 chứ không 8: đinh ghim nhô lên khỏi mép thẻ, thiếu chỗ thì nó đè lên thẻ trên.
          gap: grid ? 14 : 22,
        }}
        refreshControl={
          // Bọc `refetch` chứ không truyền thẳng: RefreshControl gọi handler không tham số nhưng
          // `refetch` nhận `RefetchOptions`, và nó trả Promise mà prop này không nhận.
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={C.paperWarm}
            progressViewOffset={barHeight}
          />
        }
        renderItem={({ item, index }) =>
          grid ? (
            // Ô thumbnail của lưới 2 cột — cùng component mà `/saved` và trang cá nhân dùng,
            // nên hai kiểu bày không phải nuôi hai bản layout riêng.
            <NoteCard item={item} index={index} onPress={() => router.push(`/listing/${item.id}`)} />
          ) : (
            <FeedCard
              item={item}
              index={index}
              orgName={item.organizationId ? orgNameById.get(item.organizationId) : undefined}
              saved={saved.has(item.id)}
              onPress={() => router.push(`/listing/${item.id}`)}
              onToggleSave={() => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) })}
              onMessage={() => message(item.id)}
            />
          )
        }
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message || 'Chưa tải được bảng tin'} onDark />
          ) : (
            <EmptyState
              icon="📌"
              text={
                activeCategory
                  ? `Chưa có tin nào trong mục ${activeCategory.name}`
                  : 'Chưa có tin nào để hiển thị'
              }
              onDark
            />
          )
        }
      />

      {/*
        Thanh đầu nằm NGOÀI danh sách và phủ lên trên nó.
        `pointerEvents="box-none"` để khoảng trống của thanh không nuốt cú chạm rơi vào tin
        phía dưới — chỉ những ô thật sự bấm được (ô tìm, avatar, chip) mới nhận.
      */}
      <Animated.View
        pointerEvents="box-none"
        onLayout={(e) => measureBar(e.nativeEvent.layout.height)}
        style={[styles.bar, { paddingTop: insets.top + 8 }, barStyle]}
      >
        <FeedBar
          onTitleLayout={(h) => {
            titleH.value = h;
          }}
          avatar={profile?.avatar ?? '·'}
          avatarUrl={profile?.avatarUrl}
          myOrgs={myOrgs ?? []}
          categories={categories ?? []}
          categoryId={categoryId}
          onCategory={setCategoryId}
          onSearch={() => router.push('/search')}
          onProfile={() => router.push('/(tabs)/profile')}
          onOrg={(slug) => router.push(`/org/${slug}`)}
          onFindOrg={() => router.push('/join-org')}
        />
      </Animated.View>
    </Corkboard>
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
  // Hàng chip là phần DUY NHẤT của khối đầu không lấy lề 16: nó phải cuộn tràn ra mép phải, nên lề
  // trái đặt ở đây còn mép phải để hở.
  // Xem `filterBar` bên `AdminScreen`: RN gán sẵn `flexGrow/flexShrink: 1` cho mọi ScrollView,
  // và trong thanh nổi này nó sẽ co giãn tranh chỗ với hai hàng trên.
});
