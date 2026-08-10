import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Conversation, Message } from '@/api/db';
import { qk } from './keys';

export function useConversations() {
  return useQuery({ queryKey: qk.conversations(), queryFn: api.getConversations });
}

export function useConversation(id: number) {
  return useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.getConversation(id),
    enabled: Number.isFinite(id),
  });
}

export function useOpenConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: number) => api.openConversationFor(listingId),
    onSuccess: (c) => {
      qc.setQueryData(qk.conversation(c.id), c);
      qc.invalidateQueries({ queryKey: qk.conversations() });
    },
  });
}

/**
 * Gửi tin nhắn: đẩy bong bóng lên UI ngay (optimistic),
 * rồi tự động chờ đối phương "đang nhập..." và trả lời.
 */
export function useSendMessage(conversationId: number) {
  const qc = useQueryClient();
  const key = qk.conversation(conversationId);

  return useMutation({
    mutationFn: async (text: string) => {
      await api.sendMessage(conversationId, text);
      return api.fetchReply(conversationId);
    },
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Conversation>(key);
      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        from: 'me',
        text,
        time: new Date().toTimeString().slice(0, 5),
      };
      qc.setQueryData<Conversation>(key, (old) =>
        old ? { ...old, messages: [...old.messages, optimistic], lastMsg: text, time: 'Vừa xong' } : old,
      );
      return { prev };
    },
    onError: (_e, _text, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (reply) => {
      qc.setQueryData<Conversation>(key, (old) =>
        old
          ? { ...old, messages: [...old.messages, reply], lastMsg: reply.text, time: 'Vừa xong' }
          : old,
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.conversations() });
    },
  });
}
