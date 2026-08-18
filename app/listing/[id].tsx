import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useListing, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useOpenConversation } from '@/queries/chat';
import { useCreateReport } from '@/queries/report';
import { C, F, shadow } from '@/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // ObjectId của BE là chuỗi 24 hex — `Number()` ở đây sẽ ra NaN.
  const listingId = id ?? '';
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const { data: listing, error, isLoading } = useListing(listingId);
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const openChat = useOpenConversation();
  const report = useCreateReport();

  const saved = !!savedIds?.includes(listingId);

  // @keyframes saveBounce — phóng to + xoay nhẹ rồi về chỗ cũ
  const bounce = useSharedValue(1);
  const rot = useSharedValue(0);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }, { rotate: `${rot.value}deg` }],
  }));

  const onToggleSave = () => {
    bounce.value = withSequence(withSpring(1.3, { damping: 6 }), withSpring(1));
    rot.value = withSequence(withSpring(-10, { damping: 6 }), withSpring(0));
    toggleSaved.mutate(listingId, { onError: (e: Error) => toast(`⚠️ ${e.message}`) });
  };

  const onMessage = () => {
    openChat.mutate(listingId, {
      onSuccess: (c) => router.push(`/chat/${c.id}`),
      onError: (e: Error) => toast(`📌 ${e.message}`),
    });
  };

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
          <Text style={styles.meta}>{listing.meta}</Text>

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

          <Text style={styles.label}>Mô tả</Text>
          <Text style={styles.desc}>{listing.desc}</Text>

          {/* Tự ẩn khi tin không có thuộc tính nào — tin cũ đăng trước hệ template là ca thường. */}
          <ListingAttrs listing={listing} />

          {/* Tin của mình thì không: BE trả 400 cho tự báo cáo chính mình, hiện nút ra chỉ để
              người ta bấm vào một lỗi. */}
          {!listing.mine && (
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

      <View style={[styles.cta, { paddingBottom: insets.bottom || 14 }]}>
        <Pressable
          onPress={onMessage}
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.6 }]}
        >
          <Text style={{ fontSize: 17 }}>💬</Text>
        </Pressable>
        <PinButton
          label="📞 Liên hệ người bán"
          depth={5}
          style={{ flex: 1 }}
          onPress={() => toast('📞 Đang kết nối tới người bán...')}
        />
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
  meta: { fontFamily: F.mono, fontSize: 11.5, color: C.inkSoft, marginBottom: 20 },
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
