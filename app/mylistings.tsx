import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, SlideOutRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingPhoto } from '@/components/ListingPhoto';
import { EmptyState, Loading, PagedFooter, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { expiryLabel } from '@/api/client';
import type { Listing } from '@/api/db';
import {
  useDeleteListing,
  useMarkListingSold,
  useMyListings,
  useQuota,
  useRenewListing,
} from '@/queries/listings';
import { C, F, shadow } from '@/theme';

/**
 * Nhãn + bảng màu cho BỐN trạng thái người bán thấy được.
 *
 * Một bảng tra chứ không chuỗi ba tầng ternary trong JSX: thêm trạng thái thứ năm ở đây là
 * thêm một dòng, còn trong JSX là sửa ba biểu thức lồng nhau ở ba chỗ khác nhau.
 */
const BADGE: Record<Listing['status'], { label: string; bg: string; fg: string }> = {
  live: { label: 'Đang hiển thị', bg: C.mossLight, fg: C.moss },
  pending: { label: 'Chờ duyệt', bg: '#FDEFD9', fg: C.corkDark },
  expired: { label: 'Hết hạn', bg: C.dangerLt, fg: C.pinDark },
  sold: { label: 'Đã bán', bg: C.sand, fg: C.inkSoft },
};

/**
 * Tông màu theo `review.state` — nhãn thì lấy nguyên `review.title` BE gửi.
 *
 * Tin bị từ chối / bị ẩn với app vẫn là `status: 'pending'` (chủ tin không có nút nào để bấm),
 * nhưng huy hiệu KHÔNG được nói "Chờ duyệt" với họ: đó là bảo họ đợi một hàng đợi không còn giữ
 * tin của họ. Bị từ chối mang màu cảnh báo, bị ẩn mang màu lặng — hai chuyện khác nhau.
 */
const REVIEW_TONE: Record<NonNullable<Listing['review']>['state'], { bg: string; fg: string }> = {
  pending: BADGE.pending,
  rejected: { bg: C.dangerLt, fg: C.pinDark },
  hidden: { bg: C.sand, fg: C.inkSoft },
};

function StatusBadge({ item }: { item: Listing }) {
  const badge = item.review
    ? { label: item.review.title, ...REVIEW_TONE[item.review.state] }
    : BADGE[item.status];
  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
    </View>
  );
}

export default function MyListings() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, loadMore, isFetchingNextPage } = useMyListings();
  const del = useDeleteListing();
  const renew = useRenewListing();
  const sold = useMarkListingSold();
  const quota = useQuota();

  /*
   * Cùng một cửa lỗi cho ba mutation — toast, không alert. Ba nút này đều là hành động một
   * bước trên một dòng, không có gì để xác nhận lại.
   */
  const showError = (e: Error) => toast(`⚠️ ${e.message}`);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Tin đã đăng" />

      {/* Hạn mức đếm theo tin ĐANG CHỜ DUYỆT, không phải tổng số tin. Không nói ra con số này
          thì lúc bị chặn người dùng chỉ thấy một lỗi và tưởng app hỏng. */}
      {quota.data ? (
        <View style={[styles.quota, !quota.data.allowed && styles.quotaFull]}>
          <Text style={styles.quotaText}>
            {quota.data.allowed
              ? `Còn ${quota.data.remaining}/${quota.data.limit} lượt đăng — tin chờ duyệt xong sẽ trả lại lượt`
              : `Đã dùng hết ${quota.data.limit} lượt đăng · chờ duyệt xong rồi đăng tiếp`}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={data ?? []}
        keyExtractor={(l) => String(l.id)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
        renderItem={({ item, index }) => (
          /*
            Bấm vào HÀNG là mở form sửa — không còn nút ✏️ riêng.

            `Animated.View` giữ animation vào/ra, `Pressable` bên trong giữ layout của hàng
            (`styles.row`) và nhận cú chạm. Ba nút thao tác vẫn ăn cú chạm của riêng chúng:
            `Pressable` lồng nhau trong RN không cho sự kiện nổi lên như DOM.
          */
          <Animated.View
            entering={FadeInDown.delay(index * 80).duration(340)}
            exiting={SlideOutRight.duration(280)}
          >
            <Pressable
              onPress={() => router.push(`/listing/edit/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
            <ListingPhoto
              photo={item.photo}
              photoUrl={item.photoUrls?.[0]}
              style={styles.photo}
              imageStyle={styles.photoRadius}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.title}>
                {item.title}
              </Text>
              <Text style={styles.price}>{item.price}</Text>
              <View style={styles.badgeRow}>
                <StatusBadge item={item} />
                {/* Chỉ hiện khi hạn đã tới hoặc còn dưới 7 ngày — `expiryLabel` tự trả
                    `undefined` cho tin còn dài hạn, đừng nhắc thứ chưa cần nhắc. */}
                {item.status === 'live' || item.status === 'expired' ? (
                  <Text style={styles.due}>{expiryLabel(item.expiresAt, item.status === 'expired')}</Text>
                ) : null}
              </View>
              {/* Lý do tin chưa lên bảng, nguyên văn từ BE. Không rút gọn theo số dòng: một câu
                  bị cắt lửng là một lý do không đọc được, mà cả mục này tồn tại để họ đọc được. */}
              {item.review ? (
                <View style={styles.review}>
                  <Text style={styles.reviewMsg}>{item.review.message}</Text>
                  {item.review.hint ? <Text style={styles.reviewHint}>{item.review.hint}</Text> : null}
                </View>
              ) : null}
            </View>
            <View style={{ gap: 6, justifyContent: 'center' }}>
              {/* Hết hạn thì gia hạn; đang hiển thị thì đánh dấu đã bán. Tin `sold`/`pending`
                  không có phép chuyển nào của chủ tin — BE trả 400, nên đừng vẽ nút. */}
              {item.status === 'expired' ? (
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: C.brandLt }]}
                  onPress={() => renew.mutate(item.id, { onError: showError })}
                >
                  <Text style={{ fontSize: 12 }}>↻</Text>
                </Pressable>
              ) : null}
              {item.status === 'live' ? (
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: C.mossLight }]}
                  onPress={() => sold.mutate(item.id, { onError: showError })}
                >
                  <Text style={{ fontSize: 12 }}>✓</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.iconBtn, { backgroundColor: '#FCE4E1' }]}
                onPress={() =>
                  // Toast nằm trong `onSuccess`: báo "đã xoá" ngay lúc bấm là nói dối khi
                  // request hỏng — optimistic update sẽ rollback mà người dùng không hay.
                  del.mutate(item.id, {
                    onSuccess: () => toast('🗑 Đã xoá tin đăng'),
                    onError: (e: Error) => toast(`⚠️ ${e.message}`),
                  })
                }
              >
                <Text style={{ fontSize: 12 }}>🗑</Text>
              </Pressable>
            </View>
            </Pressable>
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState icon="📌" text="Bạn chưa ghim tin nào lên bảng" />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  quota: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.paperWarm,
  },
  quotaFull: { backgroundColor: C.pinLight },
  quotaText: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, lineHeight: 16 },
  screen: { flex: 1, backgroundColor: C.paper },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 10,
    ...shadow,
  },
  photo: { width: 60, height: 60, borderRadius: 6 },
  photoRadius: { borderRadius: 6 },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 3 },
  price: { fontFamily: F.monoBold, fontSize: 12, color: C.moss, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  due: { fontFamily: F.ui, fontSize: 10, color: C.inkSoft },
  badgeText: { fontFamily: F.uiBold, fontSize: 9.5 },
  review: { marginTop: 6, gap: 2 },
  reviewMsg: { fontFamily: F.ui, fontSize: 11, lineHeight: 15, color: C.ink },
  reviewHint: { fontFamily: F.ui, fontSize: 10.5, lineHeight: 14, color: C.inkSoft },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
