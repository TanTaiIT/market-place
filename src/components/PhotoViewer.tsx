import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { C, F } from '@/theme';

/**
 * Xem ảnh toàn màn: vuốt ngang đổi ảnh, chụm để phóng to, chạm hai lần để phóng/thu nhanh.
 *
 * Chỉ mount khi thật sự mở (`{open && <PhotoViewer/>}` bên `ListingGallery`) — mỗi ảnh giữ
 * shared value riêng, để nó sống ngầm cả vòng đời màn chi tiết là phí, mà mở lại còn dính
 * mức phóng của lần trước.
 */

const MAX_SCALE = 4;
/** Ngón đi quá ngần này (px) thì không còn là cú chạm nữa — xem §`doubleTap` bên dưới. */
const TAP_SLOP = 20;

export function PhotoViewer({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  /** Ảnh đang chạm vào — mở đúng trang đó thay vì quay về đầu bộ. */
  index: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index);
  // Đang phóng to thì khoá vuốt ngang, nếu không kéo ảnh sang trái/phải sẽ lật trang mất.
  const [zoomed, setZoomed] = useState(false);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Android dựng Modal ở cây view riêng, nằm ngoài `GestureHandlerRootView` của
          `app/_layout.tsx` — thiếu cái bọc này thì chụm/kéo trong đây câm luôn. */}
      <GestureHandlerRootView style={styles.root}>
        <FlatList
          data={urls}
          keyExtractor={(url) => url}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index}
          // FlatList không tự biết bề rộng trang nên `initialScrollIndex` sẽ nhảy sai nếu thiếu.
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <ZoomableImage uri={item} width={width} height={height} onZoomChange={setZoomed} />
          )}
        />

        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Đóng ảnh"
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>

        {urls.length > 1 && (
          <View style={[styles.counter, { bottom: insets.bottom + 18 }]}>
            <Text style={styles.counterText}>
              {page + 1} / {urls.length}
            </Text>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

function ZoomableImage({
  uri,
  width,
  height,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // Giữ ở JS chứ không chỉ shared value: `Gesture.Pan().enabled()` đọc lúc render, không đọc
  // được từ luồng UI. Đây là công tắc để pan không nuốt cú vuốt ngang khi ảnh chưa phóng to.
  const [zoomed, setZoomed] = useState(false);
  const applyZoom = useCallback(
    (z: boolean) => {
      setZoomed(z);
      onZoomChange(z);
    },
    [onZoomChange],
  );

  // `resizeMode="contain"` để lại viền đen hai bên: lấy tỉ lệ thật lúc ảnh load xong, không thì
  // biên kéo tính theo cả khung và người dùng lôi được ảnh ra tận mép màn hình.
  const [ratio, setRatio] = useState(0);
  // Ảnh bè hơn khung thì chạm hai mép trái/phải, cao hơn thì chạm trên/dưới.
  const fit =
    ratio <= 0
      ? { w: width, h: height }
      : ratio > width / height
        ? { w: width, h: width / ratio }
        : { w: height * ratio, h: height };

  // Trả ảnh về đúng khung. Chạy trên luồng UI nên phải là worklet — KHÔNG bọc `useCallback`,
  // bọc vào là plugin Reanimated không workletize được nữa và gesture gọi sẽ nổ.
  const settle = (next: number) => {
    'worklet';
    scale.value = withTiming(next);
    savedScale.value = next;
    if (next === 1) {
      x.value = withTiming(0);
      y.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    }
    scheduleOnRN(applyZoom, next > 1);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
    })
    .onEnd(() => {
      // Nhả tay dưới 1 là người dùng muốn thu về — bật lại đúng khung thay vì để ảnh nhỏ hơn nền.
      settle(scale.value < 1.05 ? 1 : scale.value);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    /*
     * Chưa phóng to thì đòi hai ngón. Không được chỉ `return` trong `onUpdate` — gesture vẫn
     * kích hoạt, vẫn cướp cú chạm khỏi FlatList, và vuốt sang ảnh khác chết cứng.
     *
     * Dùng ngưỡng ngón thay vì `.enabled(zoomed)` để vừa chụm vừa kéo vẫn chạy: một ngón lúc
     * chưa phóng là để FlatList lật trang, hai ngón thì đằng nào cũng đang pinch.
     * Ở mức 1x biên kéo tự ra 0 nên có kéo cũng không xê dịch.
     */
    .minPointers(zoomed ? 1 : 2)
    .onUpdate((e) => {
      // Chỉ cho kéo đúng phần ảnh tràn ra ngoài khung; cạnh nào chưa tràn thì khoá cạnh đó.
      const maxX = Math.max(0, (fit.w * scale.value - width) / 2);
      const maxY = Math.max(0, (fit.h * scale.value - height) / 2);
      x.value = clamp(savedX.value + e.translationX, -maxX, maxX);
      y.value = clamp(savedY.value + e.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    // Không đặt thì Tap không có giới hạn quãng đường: nó ôm cú chạm tới tận `maxDurationMs`
    // (500ms) rồi mới chịu thua, và một cú vuốt chậm sang ảnh khác bị nuốt mất trong lúc đó.
    .maxDistance(TAP_SLOP)
    .onEnd(() => {
      settle(scale.value > 1 ? 1 : 2);
    });

  // Pinch và pan phải chạy song song (chụm hai ngón cũng là kéo). Double-tap đứng TRƯỚC trong
  // `Exclusive`: để sau thì pan giành quyền ngay từ chạm đầu và cú chạm đôi không bao giờ tới.
  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }}>
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
          <Image
            source={{ uri }}
            style={styles.photo}
            resizeMode="contain"
            onLoad={(e) => {
              const s = e.nativeEvent.source;
              if (s?.height) setRatio(s.width / s.height);
            }}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.scrimPhoto },
  photo: { width: '100%', height: '100%' },
  close: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { color: C.paperWarm, fontSize: 16, lineHeight: 20 },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: C.scrim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  counterText: { fontFamily: F.mono, fontSize: 11.5, color: C.paperWarm },
});
