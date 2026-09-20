import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingAttrs } from '@/components/ListingAttrs';
import { ListingGallery } from '@/components/ListingGallery';
import { ListingSeller } from '@/components/ListingSeller';
import { ListingSuggestions } from '@/components/ListingSuggestions';
import { SafetyNote } from '@/components/SafetyNote';
import { ReportButton } from '@/components/ReportButton';
import { EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useRequireAuth, useRequireVerifiedEmail } from '@/components/GuestGate';
import { useIsAuthenticated } from '@/stores/auth';
import { useRecordRecent } from '@/stores/recent';
import { useListing, useSavedIds, useToggleSaved } from '@/queries/listings';
import { useOpenConversation } from '@/queries/chat';
import { ListingHiddenError } from '@/api/client';
import { useCreateReport } from '@/queries/report';
import { C, F, T, shadow } from '@/theme';

export default function ListingDetail() {
  // `mod=1`: mở từ hàng đợi báo cáo của bàn quản trị — đọc qua cửa bàn duyệt (xem `useListing`).
  const { id, mod } = useLocalSearchParams<{ id: string; mod?: string }>();
  // ObjectId của BE là chuỗi 24 hex — `Number()` ở đây sẽ ra NaN.
  const listingId = id ?? '';
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const requireVerified = useRequireVerifiedEmail();
  const isAuthenticated = useIsAuthenticated();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const { data: listing, error, isLoading } = useListing(listingId, mod === '1');
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const openChat = useOpenConversation();
  const report = useCreateReport();

  const saved = !!savedIds?.includes(listingId);

  /*
   * Về đầu trang khi ĐỔI tin.
   *
   * `/listing/[id]` là MỘT màn, và dải tin tương tự chuyển tin bằng `router.replace` cùng
   * route — nên màn không remount, chỉ `id` đổi. Không có lượt cuộn này thì bấm một tin gợi ý
   * xong người xem vẫn đứng nguyên ở chân trang, tức là nhìn thấy dải gợi ý của tin MỚI mà
   * chưa từng thấy chính tin đó. Đúng chỗ khó nhận ra vì màn vẫn đổi nội dung như thường.
   *
   * `animated: false`: đây là một trang khác, không phải người dùng vừa cuộn — cuộn có hiệu ứng
   * sẽ trông như trang tự trôi.
   */
  // `ComponentRef` chứ không `useRef<ScrollView>`: `ScrollView` là component, còn `scrollTo`
  // nằm trên INSTANCE của nó — `useRef<FlatList>` ở màn chat may mắn hợp lệ, ở đây thì không.
  const pageRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    pageRef.current?.scrollTo({ y: 0, animated: false });
  }, [listingId]);

  /*
   * Ghi dấu vết khi tin VỀ ĐẾN nơi, không phải khi màn mount: id sai/404 mà cũng ghi thì bộ
   * gợi ý học từ một tin không tồn tại.
   *
   * Chỉ ghi danh mục + tỉnh, không ghi tiêu đề/giá/ảnh như bản trước: dấu vết này không còn
   * được bày ra màn hình nào nữa, nó chỉ chảy vào bộ xếp hạng — xem `@/stores/recent`.
   */
  const recordRecent = useRecordRecent();
  useEffect(() => {
    if (listing) {
      recordRecent({
        id: listing.id,
        categoryId: listing.categoryId,
        province: listing.province ?? undefined,
      });
    }
  }, [listing, recordRecent]);

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

  /*
   * Hai cửa lồng nhau, và THỨ TỰ là cố ý: hỏi "bạn là ai" trước, rồi mới hỏi "hộp thư đó có
   * thật của bạn không". Đảo lại thì khách chưa đăng nhập bị mời đi xác thực một email họ
   * chưa từng khai.
   */
  const onMessage = () =>
    requireAuth(
      () =>
        requireVerified(() => {
          openChat.mutate(listingId, {
            onSuccess: (c) => router.push(`/chat/${c.id}`),
            onError: (e: Error) => toast(`📌 ${e.message}`),
          });
        }, 'Xác thực email trước khi nhắn cho người bán'),
      'Đăng nhập để nhắn cho người bán',
    );

  if (isLoading) return <Loading />;
  // `isLoading` chỉ true ở lần fetch đầu, nên lỗi và id không tồn tại đều rơi xuống đây. 404 là
  // ổ khoá kèm CẢ HAI khả năng (đã gỡ / nội bộ nhóm) — vì sao không tách: xem `ListingHiddenError`.
  // Khách được nhắc đăng nhập: là thành viên thì đăng nhập là mở được ngay.
  if (error || !listing) {
    const hidden = error instanceof ListingHiddenError;
    const guestHint = isAuthenticated ? '' : ' Nếu bạn là thành viên nhóm đó, hãy đăng nhập rồi mở lại.';
    const fallback = (error as Error | null)?.message ?? 'Không tìm thấy tin này';
    return <EmptyState icon={hidden ? '🔒' : '📡'} text={hidden ? error.message + guestHint : fallback} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={pageRef}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
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

        </ListingGallery>

        {/*
          BỐN KHỐI RỜI trên nền xám, không phải một trang liền.

          Trang chi tiết trả lời bốn câu hỏi khác nhau — "món này là gì", "ai bán", "người bán
          nói gì", "có an toàn không" — mà bản cũ đổ hết vào một dải chữ liền không có ranh giới
          nào. Mắt phải tự tìm chỗ mỗi phần bắt đầu, và trên màn hẹp thì bảng thông số dính
          liền vào đoạn mô tả.

          Khe hở `gap` để lộ nền `C.paper` chính là đường phân chia, nên các khối KHÔNG cần
          viền hay bóng: nền trang làm nốt việc đó, và thêm viền là vẽ hai đường cho một ranh giới.
        */}
        <Animated.View entering={FadeInDown.duration(380)} style={styles.sheet}>
          <View style={styles.block}>
          {!!listing.cat && (
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{listing.cat}</Text>
            </View>
          )}

          <Text style={styles.title}>{listing.title}</Text>

          {/*
            Giá nằm TRONG khối, không còn là nhãn nổi đè lên ảnh.

            Nhãn nổi neo `bottom: -18` nên nó thò xuống dưới ảnh — cách đó chạy được khi phần
            thân không có nền, nhưng từ khi trang chia thành các khối ĐỤC thì khối 1 vẽ đè lên
            đúng chỗ đó và giá bị che mất. Đặt giá thành một dòng thật trong khối vừa hết chồng
            lấn, vừa cho nó đứng đúng thứ tự người ta đọc: tên món → giá → ở đâu, bao giờ.
          */}
          <Text style={styles.price}>{listing.price}</Text>

          {/*
            Ba mảnh RỜI thay cho một chuỗi `meta` mờ.

            Lượt xem trước đây chỉ có trên thẻ ở bảng tin, không có ở đây — đúng chỗ người mua
            cần nó nhất để đoán tin còn sống hay đã nguội. Khu vực tách riêng vì nó là thứ
            quyết định có đi xem hàng được không.
          */}
          <View style={styles.metaRow}>
            {/*
              Tới cấp PHƯỜNG khi có: "Hồ Chí Minh" không nói được gì về việc đi xem hàng có
              tiện không, mà `ward` vốn đã nằm sẵn trong payload — bản cũ chỉ đơn giản là không
              đọc tới nó.
            */}
            {!!listing.province && (
              <Text style={styles.metaItem}>
                📍 {listing.ward ? `${listing.ward}, ${listing.province}` : listing.province}
              </Text>
            )}
            <Text style={styles.metaItem}>🕘 {listing.meta}</Text>
            <Text style={styles.metaItem}>👁 {listing.viewCount} lượt xem</Text>
            {listing.favoriteCount > 0 && (
              <Text style={styles.metaItem}>📌 {listing.favoriteCount} quan tâm</Text>
            )}
          </View>

          {/*
            Thuộc tính đứng TRƯỚC mô tả.

            Người mua hỏi "có đúng thứ tôi cần không" trước khi hỏi "người bán nói gì" — mà câu
            đầu do bảng thông số trả lời trong hai giây, còn câu sau là một đoạn văn. Xếp ngược
            lại là bắt họ đọc hết đoạn văn mới biết mình xem nhầm tin.
            Tự ẩn khi tin không có thuộc tính nào — tin cũ đăng trước hệ template là ca thường.
          */}
          <ListingAttrs listing={listing} />
          </View>

          {/* Khối 2 — AI BÁN. Đứng riêng vì nó là thứ người mua cân nhắc tách khỏi món hàng. */}
          <View style={styles.block}>
            <ListingSeller
              listing={listing}
              onOpen={() => router.push(`/user/${listing.sellerId}`)}
            />
          </View>

          {/* Khối 3 — NGƯỜI BÁN NÓI GÌ. */}
          <View style={styles.block}>
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
          </View>

          {/*
            Khối 4 — CÓ AN TOÀN KHÔNG. Chỉ tin của NGƯỜI KHÁC: nhắc chính mình cẩn thận khi
            giao dịch với chính mình là một câu vô nghĩa nằm chắn giữa chủ tin và nút sửa tin,
            và nếu khối rỗng thì đừng để lại một tấm thẻ trắng trơn.
          */}
          {!listing.mine && (
          <View style={styles.block}>
          <SafetyNote />

          {/* Tin của mình thì không: BE trả 400 cho tự báo cáo chính mình, hiện nút ra chỉ để
              người ta bấm vào một lỗi. */}
          {isAuthenticated && (
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
          </View>
          )}
        </Animated.View>

        {/*
          `key` theo id, cùng lý do với lượt cuộn về đầu ở trên: màn không remount khi đổi tin,
          nên dải gợi ý sẽ giữ nguyên số trang đang xem và vị trí lướt ngang của TIN CŨ. Đổi
          `key` là dựng lại nó sạch — rẻ hơn hẳn việc tự đồng bộ hai thứ trạng thái đó bằng tay.
        */}
        <ListingSuggestions key={listing.id} current={listing} />
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
  /*
   * TỈ LỆ chứ không phải chiều cao cố định.
   *
   * 260px cứng là một con số đúng cho đúng một cỡ máy: trên máy rộng nó thành một dải thấp lè
   * tè so với bề ngang, trên máy hẹp lại chiếm quá nửa màn. 4:3 giữ nguyên tương quan ở mọi
   * máy, và trên máy 390pt nó cho 292px — to hơn hẳn mà vẫn chừa chỗ cho khối 1 ló lên.
   */
  hero: { aspectRatio: 4 / 3 },
  circleBtn: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.glassLift,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    ...shadow,
  },
  /**
   * Con số lớn nhất màn — `T.xl` là bậc chữ chỉ dùng cho MỘT dòng mỗi màn, và ở trang này đúng
   * là giá. `monoBold` để các chữ số đều bề ngang, không nhảy khi giá đổi.
   */
  price: { fontFamily: F.monoBold, ...T.xl, color: C.moss, marginTop: 10 },
  /** Khe hở giữa các khối — chính nó để lộ nền `C.paper` và làm đường phân chia. */
  sheet: { gap: 9 },
  block: { backgroundColor: C.paperWarm, paddingHorizontal: 20, paddingVertical: 18 },
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
