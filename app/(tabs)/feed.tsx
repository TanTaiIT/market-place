import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { FeedCard } from '@/components/FeedCard';
import { Avatar, EmptyState, Loading, TapeChip } from '@/components/ui';
import { useCategories, useListings, useProfile, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useOpenConversation } from '@/queries/chat';
import { useMyOrgs } from '@/queries/org';
import { useToast } from '@/components/Toast';
import { C, F, shadow } from '@/theme';

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

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -shift.value }] }));

  /** Đo thay vì đóng cứng con số: chiều cao đổi theo cỡ chữ hệ thống và theo việc có hàng chip hay không. */
  const measureBar = (h: number) => {
    if (h === barHeight) return;
    barH.value = h;
    setBarHeight(h);
  };

  return (
    <Corkboard>
      <Animated.FlatList
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
          gap: 8,
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
        renderItem={({ item, index }) => (
          <FeedCard
            item={item}
            index={index}
            orgName={item.organizationId ? orgNameById.get(item.organizationId) : undefined}
            saved={saved.has(item.id)}
            onPress={() => router.push(`/listing/${item.id}`)}
            onToggleSave={() => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) })}
            onMessage={() => message(item.id)}
          />
        )}
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
        style={[styles.bar, { paddingTop: insets.top + 12 }, barStyle]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Bảng tin của bạn</Text>

          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <Avatar text={profile?.avatar ?? '·'} url={profile?.avatarUrl} ring />
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
          <Text style={styles.searchText}>🔍  Tìm xe đạp, sách, laptop...</Text>
        </Pressable>

        {/* Chỉ hiện khi BE trả về danh mục — hỏng hoặc rỗng thì giấu hẳn hàng chip thay
            vì để một hàng trơ ra không bấm được gì. */}
        {!!categories?.length && (
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
              onPress={() => setCategoryId('')}
            />
            {categories.map((c, i) => (
              <TapeChip
                key={c.id}
                label={c.icon ? `${c.icon} ${c.name}` : c.name}
                index={i + 1}
                active={categoryId === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </ScrollView>
        )}
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
  // Hàng chip là phần DUY NHẤT của khối đầu không lấy lề 16: nó phải cuộn tràn ra mép phải, nên lề
  // trái đặt ở đây còn mép phải để hở.
  chipRow: { paddingBottom: 6, paddingLeft: 16, paddingRight: 8 },
  // Xem `filterBar` bên `AdminScreen`: RN gán sẵn `flexGrow/flexShrink: 1` cho mọi ScrollView,
  // và trong thanh nổi này nó sẽ co giãn tranh chỗ với hai hàng trên.
  chipBar: { flexGrow: 0, flexShrink: 0 },

});
