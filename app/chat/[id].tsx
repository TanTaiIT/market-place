import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, EmptyState, Loading } from '@/components/ui';
import { chatColor } from '@/api/client';
import {
  useConversation,
  useConversationRoom,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/queries/chat';
import { useListing } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // ObjectId 24 hex của BE — `Number()` ở đây sẽ ra NaN.
  const conversationId = id ?? '';
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState('');

  const { data: conversation, error, isLoading } = useConversation(conversationId);
  const { data: messages } = useMessages(conversationId);
  // Vào phòng để nhận tin của người kia ngay, không chờ lượt refetch nào.
  useConversationRoom(conversationId);
  // Chuỗi rỗng = chưa có hội thoại -> `useListing` tự tắt qua `enabled`.
  const { data: listing } = useListing(conversation?.listingId ?? '');
  const send = useSendMessage(conversationId);

  const markRead = useMarkConversationRead();
  const markReadRef = useRef(markRead.mutate);
  markReadRef.current = markRead.mutate;
  // Tắt huy hiệu chưa đọc đúng một lần khi mở màn. Qua ref để `mutate` đổi identity mỗi
  // render không kéo theo một lượt gọi mới.
  useEffect(() => {
    if (conversationId) markReadRef.current(conversationId);
  }, [conversationId]);

  // Tin mới và bong bóng "đang nhập" đều làm đổi chiều cao nội dung, nên `onContentSizeChange`
  // của FlatList đã phủ hết các nhịp cần cuộn — không cần effect theo dõi riêng.
  const scrollToEnd = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

  const onSend = () => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setText('');
    send.mutate(t);
    scrollToEnd();
  };

  if (isLoading) return <Loading />;
  if (error || !conversation) {
    return <EmptyState icon="💬" text={(error as Error | null)?.message ?? 'Cuộc trò chuyện không tồn tại'} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/chatlist'))}
            style={styles.backBtn}
          >
            <Text style={{ fontSize: 16 }}>←</Text>
          </Pressable>
          <Avatar text={conversation.avatar} size={36} color={chatColor(conversation.name)} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{conversation.name}</Text>
            <Text style={styles.sub}>Đang hoạt động</Text>
          </View>
        </View>

        {listing && (
          <Pressable
            onPress={() => router.push(`/listing/${listing.id}`)}
            style={({ pressed }) => [styles.context, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={listing.photo}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.contextPhoto}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.contextTitle}>
                {listing.title}
              </Text>
              <Text style={styles.contextPrice}>{listing.price}</Text>
            </View>
          </Pressable>
        )}

        <FlatList
          ref={listRef}
          data={messages ?? []}
          // `clientMsgId` trước `id`: bong bóng vừa gửi và bản thật của nó từ server là hai
          // object khác `id` nhưng cùng `clientMsgId`. Lấy `id` làm khoá thì lúc thay bản thật,
          // FlatList coi là phần tử mới, unmount rồi mount lại và `entering` chạy lần nữa —
          // đúng dòng người dùng vừa gửi bị nháy. Tin cũ không có `clientMsgId` thì `id` vốn
          // đã ổn định.
          keyExtractor={(m) => m.clientMsgId ?? m.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const mine = item.from === 'me';
            return (
              <Animated.View
                entering={FadeInDown.delay(Math.min(index, 6) * 30).duration(260)}
                style={[styles.msgRow, mine && { alignItems: 'flex-end' }]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{item.text}</Text>
                </View>
                <Text style={styles.msgTime}>{item.time}</Text>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.msgEmpty}>📌 Bắt đầu trò chuyện với {conversation.name} nhé!</Text>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Nhắn tin..."
            placeholderTextColor={C.muted}
            style={styles.input}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={onSend}
            style={({ pressed }) => [styles.sendBtn, pressed && { transform: [{ translateY: 3 }] }]}
          >
            <Text style={{ color: '#fff', fontSize: 15 }}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  name: { fontFamily: F.hand, fontSize: 19, color: C.ink },
  sub: { fontFamily: F.uiSemi, fontSize: 10.5, color: C.moss },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 9,
    marginHorizontal: 16,
    marginBottom: 6,
    ...shadow,
  },
  contextPhoto: { width: 38, height: 38, borderRadius: 6 },
  contextTitle: { fontFamily: F.uiBold, fontSize: 11.5, color: C.ink },
  contextPrice: { fontFamily: F.monoBold, fontSize: 11, color: C.moss },
  msgRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14 },
  bubbleThem: { backgroundColor: C.paperWarm, borderBottomLeftRadius: 4, ...shadow },
  bubbleMe: {
    backgroundColor: C.pin,
    borderBottomRightRadius: 4,
    shadowColor: C.pin,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bubbleText: { fontFamily: F.ui, fontSize: 13, lineHeight: 20, color: C.ink },
  msgTime: { fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 4, paddingHorizontal: 4 },
  msgEmpty: {
    textAlign: 'center',
    fontFamily: F.ui,
    fontSize: 12.5,
    color: C.inkSoft,
    paddingVertical: 30,
  },
  typing: { flexDirection: 'row', gap: 4, paddingHorizontal: 15, paddingVertical: 12 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.inkSoft, opacity: 0.6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    backgroundColor: C.sand,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontFamily: F.ui,
    fontSize: 13.5,
    color: C.ink,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.pin,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: C.pinDark,
  },
});
