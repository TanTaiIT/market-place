import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageFromSocket } from '@/api/client';
import { connectSocket, disconnectSocket, getSocket } from '@/api/socket';
import type { Message } from '@/api/db';
import { useAuthStore } from '@/stores/auth';
import { qk } from './keys';

export function useConversations() {
  return useQuery({ queryKey: qk.conversations(), queryFn: api.getConversations });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.getConversation(id),
    enabled: id.length > 0,
  });
}

/** Lịch sử tin nhắn. Tin mới về qua socket (`useConversationRoom`), không cần polling. */
export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: qk.messages(conversationId),
    queryFn: () => api.getMessages(conversationId),
    enabled: conversationId.length > 0,
  });
}

/**
 * Mở/đóng kết nối Socket.IO theo phiên đăng nhập. Gọi **một lần** ở `app/_layout.tsx`.
 *
 * Nằm ở `queries/**` chứ không phải `api/**` vì nó phải đọc store (folder.convention §6 cho
 * phép chiều này). Token đổi — đăng nhập, refresh, đăng xuất — là mở lại kết nối, vì BE
 * verify JWT ngay ở handshake chứ không đọc lại giữa chừng.
 */
export function useChatSocket(): void {
  const token = useAuthStore((s) => s.session?.accessToken ?? null);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    connectSocket(token);
    return () => disconnectSocket();
  }, [token]);
}

/**
 * Vào phòng của một hội thoại và đẩy tin nhận được thẳng vào cache.
 *
 * Chống trùng bằng `id`: BE phát cho **cả người gửi**, nên tin của chính mình sẽ về hai lần —
 * một từ response REST, một từ socket.
 */
export function useConversationRoom(conversationId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return;

    const onMessage = (payload: unknown) => {
      const message = messageFromSocket(payload);
      if (!message) return;

      qc.setQueryData<Message[]>(qk.messages(conversationId), (old = []) =>
        old.some((m) => m.id === message.id) ? old : [...old, message],
      );
      // Dòng tóm tắt + thứ tự ở màn danh sách do BE tính, không dựng lại ở client.
      qc.invalidateQueries({ queryKey: qk.conversations() });
    };

    socket.emit('chat:join', conversationId);
    socket.on('chat:message', onMessage);

    return () => {
      socket.emit('chat:leave', conversationId);
      socket.off('chat:message', onMessage);
    };
  }, [conversationId, qc]);
}

export function useOpenConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => api.openConversationFor(listingId),
    onSuccess: (conversation) => {
      qc.setQueryData(qk.conversation(conversation.id), conversation);
      qc.invalidateQueries({ queryKey: qk.conversations() });
    },
  });
}

/**
 * Gửi tin nhắn — đẩy bong bóng lên ngay rồi mới đồng bộ.
 *
 * Refetch contract: `onSettled` invalidate cả `messages(id)` (thay bong bóng tạm bằng bản ghi
 * thật của BE, kèm id và giờ chính xác) lẫn `conversations()` (dòng tóm tắt + thứ tự danh sách).
 */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const key = qk.messages(conversationId);

  return useMutation({
    mutationFn: (text: string) => api.sendMessage(conversationId, text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Message[]>(key);
      const now = new Date();
      const optimistic: Message = {
        id: `tmp-${now.getTime()}`,
        from: 'me',
        text,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      };
      qc.setQueryData<Message[]>(key, (old) => [...(old ?? []), optimistic]);
      return { prev };
    },
    onError: (_e, _text, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qk.conversations() });
    },
  });
}

/** Tắt huy hiệu chưa đọc. Gọi khi mở màn chat, không cần chờ kết quả. */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.markConversationRead(conversationId),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.conversations() }),
  });
}
