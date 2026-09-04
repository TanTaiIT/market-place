import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { expiryLabel, gradOf } from '@/api/client';
import type { StaleListing } from '@/api/db';
import { ListingPhoto } from './ListingPhoto';
import { PinButton } from './ui';
import { C, F, shadow } from '@/theme';

/**
 * Chặn trước khi đăng tin mới: hỏi về tin cũ đã hết hạn / sắp hết hạn.
 *
 * Vì sao chặn ở ĐÂY chứ không nhắc ở màn "Tin đã đăng": đây là lúc duy nhất chắc chắn người
 * bán đang mở app và đang CẦN thứ gì đó từ mình. Một dòng nhắc ở màn khác thì họ cuộn qua.
 *
 * Không có nút "để sau": mỗi tin đều có lối trả lời thuận ("vẫn còn" → gia hạn ngay), nên đây
 * là một câu hỏi trả lời được, không phải một bức tường. Bù lại phải có `Vẫn còn cả` — người
 * có 15 tin thật thì bắt bấm 15 lần là biến câu hỏi thành hình phạt.
 *
 * Màn này KHÔNG tự quyết định khi nào hiện: `post.tsx` chỉ mount nó khi `needsReconcile` không
 * rỗng, nên lỗi mạng (quota chưa về) là đăng tin bình thường — hàng rào không được chặn người
 * dùng chỉ vì một request hỏng.
 */
export function ReconcileGate({
  items,
  onSold,
  onRenew,
  onRenewAll,
  busyId,
  busyAll,
}: {
  items: StaleListing[];
  onSold: (id: string) => void;
  onRenew: (id: string) => void;
  onRenewAll: () => void;
  /** Tin đang chờ server trả lời — chỉ khoá đúng dòng đó, không khoá cả màn. */
  busyId?: string;
  busyAll?: boolean;
}) {
  const expired = items.filter((l) => l.status === 'expired').length;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={styles.headTitle}>
          {expired > 0
            ? `${expired} tin của bạn đã hết hạn`
            : `${items.length} tin của bạn sắp hết hạn`}
        </Text>
        <Text style={styles.headBody}>
          Tin hết hạn không còn hiện trên bảng. Bán được rồi thì đánh dấu, còn hàng thì gia hạn
          thêm 30 ngày — rồi đăng tin mới.
        </Text>
      </View>

      {items.map((item, index) => (
        <Animated.View
          key={item.id}
          // Trả lời xong dòng đó rời danh sách — `FadeOut` để thấy rõ "đã ghi nhận", thứ mà một
          // dòng biến mất tức thì không nói được.
          entering={FadeInDown.delay(Math.min(index, 4) * 60).duration(320)}
          exiting={FadeOut.duration(200)}
          style={styles.row}
        >
          <ListingPhoto
            photo={gradOf(item.id)}
            photoUrl={item.image}
            style={styles.photo}
            imageStyle={styles.photoRadius}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text numberOfLines={2} style={styles.title}>
              {item.title}
            </Text>
            <Text style={[styles.due, item.status === 'expired' && { color: C.pinDark }]}>
              {/* Trong hàng rào này mọi tin đều trong 7 ngày hoặc đã hết hạn, nên nhãn luôn có
                  — `within` để mặc định là đủ. */}
              {expiryLabel(item.expiresAt, item.status === 'expired') ?? 'Chưa rõ hạn'}
            </Text>
            <View style={styles.actions}>
              <Pressable
                disabled={Boolean(busyId) || busyAll}
                onPress={() => onSold(item.id)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipDown]}
              >
                <Text style={styles.chipText}>✓ Đã bán</Text>
              </Pressable>
              <Pressable
                disabled={Boolean(busyId) || busyAll}
                onPress={() => onRenew(item.id)}
                style={({ pressed }) => [styles.chip, styles.chipKeep, pressed && styles.chipDown]}
              >
                <Text style={[styles.chipText, { color: C.brandTx }]}>
                  {busyId === item.id ? '⏳ Đang lưu' : '↻ Vẫn còn'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ))}

      {items.length > 3 ? (
        <PinButton
          label={busyAll ? 'Đang gia hạn...' : `↻ Vẫn còn cả ${items.length} tin`}
          tone="ok"
          loading={busyAll}
          disabled={Boolean(busyId)}
          onPress={onRenewAll}
          style={{ marginTop: 6 }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { gap: 6, marginBottom: 2 },
  headTitle: { fontFamily: F.uiBold, fontSize: 16, color: C.ink },
  headBody: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 10,
    ...shadow,
  },
  photo: { width: 64, height: 64, borderRadius: 6 },
  photoRadius: { borderRadius: 6 },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.ink },
  due: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft },
  actions: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: C.sand,
    borderWidth: 1,
    borderColor: C.lineInput,
  },
  chipKeep: { backgroundColor: C.brandLt, borderColor: C.brandLt },
  chipDown: { transform: [{ scale: 0.97 }] },
  chipText: { fontFamily: F.uiBold, fontSize: 11.5, color: C.inkSoft },
});
