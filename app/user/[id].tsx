import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteCard } from '@/components/NoteCard';
import { ReportButton } from '@/components/ReportButton';
import { Avatar, EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSellerListings, useSellerProfile } from '@/queries/users';
import { useCreateReport } from '@/queries/report';
import { C, F, shadow } from '@/theme';

/**
 * Hồ sơ công khai của một người bán.
 *
 * Không có nút gọi hay nhắn tin: chat mở theo TIN chứ không theo người (`POST /chats` nhận
 * `listingId`), nên đường liên hệ đúng nằm ở từng tin bên dưới. Đặt một nút "nhắn tin" ở đây
 * là hứa một luồng không tồn tại.
 */
export default function SellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sellerId = id ?? '';
  const router = useRouter();
  const toast = useToast();

  const { data: seller, error, isLoading } = useSellerProfile(sellerId);
  const listings = useSellerListings(sellerId);
  const report = useCreateReport();

  // Header nằm NGOÀI nhánh lỗi: hồ sơ hỏng mà màn không còn nút quay lại thì người xem kẹt hẳn
  // trong một trang trắng, phải giết app mới thoát.
  if (isLoading || error || !seller) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ScreenHeader title="Người bán" />
        {isLoading ? (
          <Loading />
        ) : (
          <EmptyState
            icon="📡"
            text={(error as Error | null)?.message ?? 'Không tìm thấy người này'}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Người bán" />
      <FlatList
        data={listings.data ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.card}>
            <Avatar text={seller.avatar} size={56} color={C.amber} textColor={C.amberInk} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{seller.name}</Text>
              <Text style={styles.meta}>
                {/* Số lượt đánh giá đi kèm điểm: 5.0 của một lượt và 4.8 của trăm lượt là hai
                    mức tin cậy khác hẳn nhau, hiện mỗi con điểm là giấu mất điều đó. */}
                {seller.ratingCount > 0
                  ? `⭐ ${seller.rating} · ${seller.ratingCount} đánh giá`
                  : '⭐ Chưa có đánh giá nào'}
              </Text>
              <Text style={styles.meta}>Tham gia từ {seller.joined}</Text>
              {/* Không kiểm "có phải chính mình không" ở đây: màn này chỉ mở được từ tin của
                  NGƯỜI KHÁC (thẻ người bán của tin mình đã bị khoá), còn tự báo cáo chính mình
                  thì BE trả 400 — hai lớp chặn là đủ, thêm lớp thứ ba chỉ để lệch nhau. */}
              <ReportButton
                label="⚑ Báo cáo người này"
                target={seller.name}
                pending={report.isPending}
                onSubmit={(values, close) =>
                  report.mutate(
                    { targetType: 'user', targetId: sellerId, ...values },
                    {
                      onSuccess: () => {
                        close();
                        toast('⚑ Đã gửi báo cáo — quản trị sẽ xem trong 24 giờ');
                      },
                      onError: (e: Error) => toast(`⚠️ ${e.message}`),
                    },
                  )
                }
              />
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <NoteCard item={item} index={index} onPress={() => router.push(`/listing/${item.id}`)} />
        )}
        ListEmptyComponent={
          listings.isLoading ? (
            <Loading />
          ) : (
            <EmptyState icon="📭" text={`${seller.name} chưa có tin nào đang hiển thị`} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 16,
    marginBottom: 18,
    ...shadow,
  },
  name: { fontFamily: F.uiBlack, fontSize: 16, color: C.ink, marginBottom: 4 },
  meta: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, lineHeight: 18 },
});
