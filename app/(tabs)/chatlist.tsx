import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, EmptyState, Loading, PagedFooter, TabHeader } from '@/components/ui';
import { GuestGate } from '@/components/GuestGate';
import { ListingPhoto } from '@/components/ListingPhoto';
import { useIsAuthenticated } from '@/stores/auth';
import { chatColor } from '@/api/client';
import { useConversations } from '@/queries/chat';
import { C, F, shadow } from '@/theme';

export default function ChatList() {
  const router = useRouter();
  const { data, error, isLoading, refetch, loadMore, isFetchingNextPage } = useConversations();

  const isAuthenticated = useIsAuthenticated();

  // Khách xem được bảng tin, nhưng hộp thư luôn là hộp thư của MỘT tài khoản — không có gì để
  // hiện, và mọi endpoint chat đều đòi token.
  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Tin nhắn"
        message="Hỏi giá, hẹn gặp và giữ lại lịch sử trao đổi với người bán — tất cả cần một tài khoản."
      />
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TabHeader title="Tin nhắn" />
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 70).duration(340)}>
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Avatar text={item.avatar} url={item.avatarUrl} size={46} color={chatColor(item.name)} />
              <View style={{ flex: 1 }}>
                <View style={styles.top}>
                  <Text style={[styles.name, item.unread && { color: C.pin }]}>{item.name}</Text>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.preview, item.unread && { color: C.ink, fontFamily: F.uiSemi }]}
                >
                  {item.lastMsg}
                </Text>
                {!!item.listingTitle && <Text style={styles.tag}>Về: {item.listingTitle}</Text>}
              </View>
              {/*
                Ảnh món đồ, ở mép PHẢI — trái đã là avatar người kia, và hai ảnh tròn cạnh nhau
                thì không ai đọc ra cái nào là người, cái nào là hàng. Vuông bo góc cũng là hình
                dạng mà thẻ tin trên bảng đang dùng, nên mắt nhận ra ngay đó là một tin đăng.

                `ListingPhoto` lo luôn nhánh không ảnh (dải màu suy từ id tin) — dùng lại thay vì
                tự viết `photoUrl ? … : …` ở đây, để mọi chỗ vẽ ảnh tin rơi về cùng một bậc cuối.
              */}
              <ListingPhoto
                photo={item.listingPhoto}
                photoUrl={item.listingImage}
                style={styles.thumb}
                imageStyle={styles.thumbRadius}
              />
              {item.unread && <View style={styles.dot} />}
            </Pressable>
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} onRetry={() => void refetch()} />
          ) : (
            <EmptyState icon="💬" text="Chưa có cuộc trò chuyện nào" />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 12,
    ...shadow,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: F.uiBold, fontSize: 13.5, color: C.ink },
  time: { fontFamily: F.mono, fontSize: 10, color: C.muted },
  preview: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: 3 },
  tag: { fontFamily: F.monoBold, fontSize: 9.5, color: C.moss, marginTop: 2 },
  /** Vuông 46px, bằng đúng chiều cao avatar bên trái — hai đầu dòng cân nhau. */
  thumb: { width: 46, height: 46, borderRadius: 8, overflow: 'hidden' },
  thumbRadius: { borderRadius: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.pin },
});
