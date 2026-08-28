import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingAttrs } from '@/components/ListingAttrs';
import { ListingGallery } from '@/components/ListingGallery';
import { ListingSuggestions } from '@/components/ListingSuggestions';
import { ReportButton } from '@/components/ReportButton';
import { Avatar, EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useRequireAuth } from '@/components/GuestGate';
import { useIsAuthenticated } from '@/stores/auth';
import { useListing, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useOpenConversation } from '@/queries/chat';
import { useCreateReport } from '@/queries/report';
import { C, F, shadow } from '@/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // ObjectId của BE là chuỗi 24 hex — `Number()` ở đây sẽ ra NaN.
  const listingId = id ?? '';
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const isAuthenticated = useIsAuthenticated();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const { data: listing, error, isLoading } = useListing(listingId);
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const openChat = useOpenConversation();
  const report = useCreateReport();

  const saved = !!savedIds?.includes(listingId);

  /*
   * Mô tả rút gọn 4 dòng.
   *
   * Không phải để cho đẹp: mô tả dài đẩy thẻ người bán, thuộc tính và tin gợi ý xuống dưới
   * màn hình thứ hai, mà đó mới là thứ quyết định có nhắn tin hay không. Người muốn đọc hết
   * bấm một lần; người không muốn thì không phải cuộn qua.
   */
  const [descOpen, setDescOpen] = useState(false);

  /*
   * Số điện thoại người bán — CÓ THẬT trong payload (`posterContact`), và trước bản này bị vứt đi.
   *
   * BE chỉ trả nó khi người bán bật `showPhone`, nên chuỗi rỗng là một lựa chọn của họ, không
   * phải dữ liệu thiếu. Nút chính vì thế phải đổi theo: có số thì GỌI được thật, không có số
   * thì nhắn tin lên làm việc chính — chứ không phải một cái nút "Liên hệ" bắn ra toast rồi
   * thôi, đúng thứ nó đang làm.
   */
  const phone = listing?.contact?.replace(/[^+d]/g, "") ?? "";

  const share = () =>
    // Không `catch` im lặng: bấm Huỷ trên sheet chia sẻ cũng vào đây, mà đó không phải lỗi.
    void Share.share({ message: `${listing?.title ?? ''} — ${listing?.price ?? ''}` }).catch(() => {});

  // @keyframes saveBounce — phóng to + xoay nhẹ rồi về chỗ cũ
  const bounce = useSharedValue(1);
  const rot = useSharedValue(0);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }, { rotate: `${rot.value}deg` }],
  }));

  /*
   * Khách xem được tin này nhưng không lưu/nhắn được: cả hai đều là hành động CỦA một tài khoản
   * (`POST /favorites`, `POST /chats` đều đòi token). Chặn ngay ở đầu hành động chứ không để
   * mutation bay rồi hiện 401 — người dùng cần biết phải làm gì, không cần biết mã lỗi.
   */
  const onToggleSave = () =>
    requireAuth(() => {
      bounce.value = withSequence(withSpring(1.3, { damping: 6 }), withSpring(1));
      rot.value = withSequence(withSpring(-10, { damping: 6 }), withSpring(0));
      toggleSaved.mutate(
        { id: listingId, saved: !saved },
        { onError: (e) => toast(`⚠️ ${e.message}`) },
      );
    }, 'Đăng nhập để lưu tin');

  const onMessage = () =>
    requireAuth(() => {
      openChat.mutate(listingId, {
        onSuccess: (c) => router.push(`/chat/${c.id}`),
        onError: (e: Error) => toast(`📌 ${e.message}`),
      });
    }, 'Đăng nhập để nhắn cho người bán');

  if (isLoading) return <Loading />;
  // `isLoading` chỉ true ở lần fetch đầu: query hỏng hoặc id không tồn tại đều rơi xuống đây,
  // nếu không có nhánh này màn hình đứng ở spinner vĩnh viễn và lỗi không hiện ở đâu cả.
  if (error || !listing) {
    return <EmptyState icon="📡" text={(error as Error | null)?.message ?? 'Không tìm thấy tin này'} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <ListingGallery photo={listing.photo} photoUrls={listing.photoUrls} style={styles.hero}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))}
            style={[styles.circleBtn, { top: insets.top + 8, left: 16 }]}
          >
            <Text style={{ fontSize: 16 }}>←</Text>
          </Pressable>

          <Pressable
            onPress={share}
            style={[styles.circleBtn, { top: insets.top + 8, right: 60 }]}
            hitSlop={8}
          >
            <Text style={{ fontSize: 15 }}>↗</Text>
          </Pressable>

          <Animated.View style={[styles.circleBtn, { top: insets.top + 8, right: 16 }, saveStyle, saved && { backgroundColor: C.pin }]}>
            <Pressable onPress={onToggleSave} hitSlop={8}>
              <Text style={{ fontSize: 15 }}>{saved ? '❤️' : '🤍'}</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(120)} style={styles.priceFloat}>
            <Text style={styles.priceFloatText}>{listing.price}</Text>
          </Animated.View>
        </ListingGallery>

        <Animated.View entering={FadeInDown.duration(380)} style={styles.body}>
          {!!listing.cat && (
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{listing.cat}</Text>
            </View>
          )}

          <Text style={styles.title}>{listing.title}</Text>

          {/*
            Ba mảnh RỜI thay cho một chuỗi `meta` mờ.

            Lượt xem trước đây chỉ có trên thẻ ở bảng tin, không có ở đây — đúng chỗ người mua
            cần nó nhất để đoán tin còn sống hay đã nguội. Khu vực tách riêng vì nó là thứ
            quyết định có đi xem hàng được không.
          */}
          <View style={styles.metaRow}>
            {!!listing.province && <Text style={styles.metaItem}>📍 {listing.province}</Text>}
            <Text style={styles.metaItem}>🕘 {listing.meta}</Text>
            <Text style={styles.metaItem}>👁 {listing.viewCount} lượt xem</Text>
            {listing.favoriteCount > 0 && (
              <Text style={styles.metaItem}>📌 {listing.favoriteCount} quan tâm</Text>
            )}
          </View>

          {/* Tin của chính mình không mở hồ sơ: hồ sơ công khai là chỗ để soi NGƯỜI LẠ trước khi
              giao dịch, còn tự soi mình thì đã có tab Hồ sơ với đủ thông tin hơn hẳn. */}
          <Pressable
            disabled={listing.mine}
            onPress={() => router.push(`/user/${listing.sellerId}`)}
            style={({ pressed }) => [styles.sellerCard, pressed && { opacity: 0.7 }]}
          >
            <Avatar text={listing.avatar} url={listing.avatarUrl} size={42} color={C.amber} textColor={C.amberInk} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{listing.seller}</Text>
              {!!listing.contact && <Text style={styles.sellerOrg}>{listing.contact}</Text>}
            </View>
            {!listing.mine && <Text style={styles.sellerChevron}>›</Text>}
          </Pressable>

          {/*
            Thuộc tính đứng TRƯỚC mô tả.

            Người mua hỏi "có đúng thứ tôi cần không" trước khi hỏi "người bán nói gì" — mà câu
            đầu do bảng thông số trả lời trong hai giây, còn câu sau là một đoạn văn. Xếp ngược
            lại là bắt họ đọc hết đoạn văn mới biết mình xem nhầm tin.
            Tự ẩn khi tin không có thuộc tính nào — tin cũ đăng trước hệ template là ca thường.
          */}
          <ListingAttrs listing={listing} />

          <Text style={styles.label}>Mô tả</Text>
          <Text style={styles.desc} numberOfLines={descOpen ? undefined : 4}>
            {listing.desc}
          </Text>
          {/*
            Nút chỉ dựng khi mô tả ĐỦ DÀI để bị cắt. Đo bằng độ dài chuỗi chứ không đo layout:
            `onTextLayout` cho con số chính xác hơn nhưng phải render một lượt rồi mới biết, và
            cái nút nhấp nháy hiện ra sau đó tệ hơn hẳn một ngưỡng xấp xỉ.
          */}
          {!descOpen && listing.desc.length > 160 && (
            <Pressable onPress={() => setDescOpen(true)} hitSlop={8}>
              <Text style={styles.more}>Xem thêm</Text>
            </Pressable>
          )}

          {/* Tin của mình thì không: BE trả 400 cho tự báo cáo chính mình, hiện nút ra chỉ để
              người ta bấm vào một lỗi. */}
          {!listing.mine && isAuthenticated && (
            <ReportButton
              label="⚑ Báo cáo tin này"
              target="tin này"
              pending={report.isPending}
              onSubmit={(values, close) =>
                report.mutate(
                  { targetType: 'listing', targetId: listingId, ...values },
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
          )}
        </Animated.View>

        <ListingSuggestions current={listing} />
      </ScrollView>

      {/*
        Tin của CHÍNH MÌNH thì không có ai để liên hệ — chỗ đó thành đường sửa tin.
        Bản cũ hiện "Liên hệ người bán" trên cả tin của mình, tức là mời người ta tự gọi mình.
      */}
      <View style={[styles.cta, { paddingBottom: insets.bottom || 14 }]}>
        {listing.mine ? (
          <PinButton
            label="✎ Sửa tin này"
            depth={5}
            style={{ flex: 1 }}
            onPress={() => router.push(`/listing/edit/${listingId}`)}
          />
        ) : (
          <>
            {/* Nút biểu tượng CHỈ dựng khi nút chính là "gọi": không có số thì nhắn tin đã là
                nút chính, và hai đường dẫn tới cùng một chỗ chỉ làm người ta phân vân. */}
            {!!phone && (
              <Pressable
                onPress={onMessage}
                style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.6 }]}
              >
                <Text style={{ fontSize: 17 }}>💬</Text>
              </Pressable>
            )}
            {phone ? (
              <PinButton
                // Nhãn nói HÀNH ĐỘNG, không nhắc lại số: số đã nằm trên thẻ người bán ngay
                // trên kia, và một số dài sẽ đẩy nhãn xuống hai dòng trên máy hẹp.
                label="📞 Gọi người bán"
                depth={5}
                style={{ flex: 1 }}
                onPress={() => {
                  // `canOpenURL` bỏ qua: máy không gọi điện được (tablet, giả lập) sẽ ném ở
                  // `openURL`, và một câu báo lỗi thật vẫn hơn một nút im lặng không phản ứng.
                  void Linking.openURL(`tel:${phone}`).catch(() =>
                    toast('⚠️ Máy này không gọi điện được — thử nhắn tin'),
                  );
                }}
              />
            ) : (
              <PinButton
                label="💬 Nhắn cho người bán"
                depth={5}
                style={{ flex: 1 }}
                onPress={onMessage}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  hero: { height: 260 },
  circleBtn: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(250,248,240,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    ...shadow,
  },
  priceFloat: {
    position: 'absolute',
    bottom: -18,
    left: 20,
    backgroundColor: C.moss,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderBottomLeftRadius: 0,
    ...shadow,
  },
  priceFloatText: { color: '#fff', fontFamily: F.monoBold, fontSize: 16 },
  body: { paddingHorizontal: 20, paddingTop: 32 },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.tape,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 3,
    transform: [{ rotate: '-1.5deg' }],
    marginBottom: 12,
  },
  catBadgeText: { fontFamily: F.uiBold, fontSize: 11, color: C.tapeInk },
  title: { fontFamily: F.uiBlack, fontSize: 19, color: C.ink, lineHeight: 26, marginBottom: 6 },
  /*
   * `flexWrap` là bắt buộc, không phải đề phòng: bốn mảnh cộng lại vượt bề ngang máy hẹp,
   * và một hàng không xuống dòng sẽ cắt cụt "lượt xem" ở đúng máy nhỏ nhất.
   */
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8, marginBottom: 20 },
  metaItem: { fontFamily: F.mono, fontSize: 11.5, color: C.inkSoft },
  more: { fontFamily: F.uiBold, fontSize: 13, color: C.moss, marginTop: 8 },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    ...shadow,
  },
  sellerName: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink },
  sellerOrg: { fontFamily: F.ui, fontSize: 11, color: C.inkSoft, marginTop: 1 },
  sellerChevron: { fontFamily: F.uiBold, fontSize: 20, color: C.inkSoft },
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
    marginBottom: 8,
  },
  desc: { fontFamily: F.ui, fontSize: 13.5, color: C.ink, lineHeight: 23 },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  ctaSecondary: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.lineInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
