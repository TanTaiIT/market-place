import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageFromSocket } from '@/api/client';
import {
  connectSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
  onSocketEvent,
  reconnectSocket,
} from '@/api/socket';
import type { Message } from '@/api/db';
import { useAuthStore, useIsAuthenticated } from '@/stores/auth';
import { qk } from './keys';

/**
 * Mã nhận dạng tin nhắn do client tự sinh, gửi kèm lên BE và được trả lại nguyên vẹn.
 *
 * Nó là **khoá render** của tin nhắn suốt vòng đời: bong bóng lạc quan mang mã này ngay lúc bấm
 * gửi, bản thật từ server mang đúng mã đó, nên thay bản này bằng bản kia không làm đổi khoá —
 * danh sách không dựng lại dòng đó và không có cú nháy nào.
 *
 * Không cần chuẩn UUID: phạm vi trùng lặp chỉ trong một hội thoại, và BE giới hạn 64 ký tự.
 */
const newClientMsgId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Khách không có hộp thư — và `TabBar` gọi hook này ở MỌI màn, kể cả màn công khai. */
export function useConversations() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: qk.conversations(),
    queryFn: api.getConversations,
    enabled: isAuthenticated,
  });
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

    /**
     * iOS đình chỉ JS khi app xuống background, nên client không trả lời heartbeat và server
     * đóng kết nối sau 45 giây (pingInterval 25s + pingTimeout 20s). Lúc quay lại foreground,
     * socket.io đang nằm trong một nhịp backoff có thể dài tới 5 giây — gọi thẳng cho nó nối
     * lại để tin nhắn không trễ nguyên nhịp đó. Việc vào lại phòng do `socket.ts` lo.
     */
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconnectSocket();
    });

    return () => {
      subscription.remove();
      disconnectSocket();
    };
  }, [token]);
}

/**
 * Vào phòng của một hội thoại và đẩy tin nhận được thẳng vào cache.
 *
 * BE phát `chat:message` cho **cả người gửi**, nên tin của chính mình về hai đường: một từ
 * response REST (đang là bong bóng lạc quan trên màn hình), một từ socket. Xử lý hai đường đó
 * là phần lắt léo nhất ở đây — xem `onMessage` bên dưới.
 *
 * Không chạm tới instance socket: `joinConversation`/`onSocketEvent` chỉ ghi nhận nguyện vọng,
 * `socket.ts` chịu trách nhiệm dựng lại sau mỗi lần nối lại. Nhờ vậy hook này đúng cả khi socket
 * chưa kịp mở (deep-link thẳng vào màn chat) lẫn khi kết nối rớt giữa chừng.
 */
export function useConversationRoom(conversationId: string): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const onMessage = (payload: unknown) => {
      // Listener nghe sự kiện `chat:message` nói chung, không phải của riêng phòng này: mở
      // chồng hai màn chat (A rồi push sang B) là hai handler cùng sống, thiếu chốt này thì
      // tin của phòng kia rơi vào cache của phòng này.
      if ((payload as { conversationId?: unknown })?.conversationId !== conversationId) return;

      const message = messageFromSocket(payload);
      if (!message) return;

      qc.setQueryData<Message[]>(qk.messages(conversationId), (old = []) => {
        if (old.some((m) => m.id === message.id)) return old;

        // Tin của CHÍNH MÌNH về qua socket chính là bản thật của bong bóng lạc quan đang hiển
        // thị — `clientMsgId` khớp là bằng chứng chắc chắn, không phải suy đoán theo nội dung.
        // Nối thêm thì màn chat hiện hai tin y hệt, rồi lượt refetch của `onSettled` xoá bớt
        // còn một. Thay tại chỗ để giữ nguyên vị trí tin, không đẩy nó xuống cuối.
        const pending = message.clientMsgId
          ? old.findIndex((m) => m.clientMsgId === message.clientMsgId)
          : -1;
        if (pending >= 0) return [...old.slice(0, pending), message, ...old.slice(pending + 1)];

        return [...old, message];
      });

      // Dòng tóm tắt + thứ tự ở màn danh sách do BE tính, không dựng lại ở client.
      //
      // Chỉ làm với tin của người khác: tin mình gửi đã có `useSendMessage.onSettled` invalidate
      // rồi, thêm lượt này là hai `GET /chats` song song cho cùng một sự kiện.
      if (message.from !== 'me') qc.invalidateQueries({ queryKey: qk.conversations() });
    };

    joinConversation(conversationId);
    const off = onSocketEvent('chat:message', onMessage);

    return () => {
      leaveConversation(conversationId);
      off();
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
 * Refetch contract: `onSettled` invalidate cả `messages(id)` (chốt lại id + giờ thật của BE cho
 * trường hợp socket không tới) lẫn `conversations()` (dòng tóm tắt + thứ tự danh sách). Đây là
 * lượt invalidate DUY NHẤT của `conversations()` cho một tin mình gửi — `useConversationRoom`
 * cố tình bỏ qua tin của chính mình để không thành hai lượt cho cùng một sự kiện.
 *
 * Bong bóng lạc quan thường bị thay sớm hơn thế: socket echo về trước và
 * `useConversationRoom` đổi nó thành bản thật tại chỗ, nên lượt refetch bên dưới chỉ xác nhận
 * lại chứ không còn gì để sửa.
 */
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const key = qk.messages(conversationId);

  const mutation = useMutation({
    // Gói object vì `mutationFn` chỉ nhận một tham số, mà `clientMsgId` phải tồn tại TRƯỚC
    // `onMutate` — bong bóng lạc quan cần mang sẵn nó, còn `onMutate` thì không có đường đưa
    // giá trị ngược lại cho `mutationFn`.
    mutationFn: (v: { text: string; clientMsgId: string }) =>
      api.sendMessage(conversationId, v.text, v.clientMsgId),
    onMutate: async ({ text, clientMsgId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Message[]>(key);
      const now = new Date();
      const optimistic: Message = {
        // `id` tạm chỉ để thoả kiểu; khoá render là `clientMsgId`, và nó không đổi khi bản
        // thật về nên danh sách không dựng lại dòng vừa gửi.
        id: clientMsgId,
        clientMsgId,
        from: 'me',
        text,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      };
      qc.setQueryData<Message[]>(key, (old) => [...(old ?? []), optimistic]);
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qk.conversations() });
    },
  });

  // Màn hình vẫn chỉ gọi `send.mutate(text)`: sinh `clientMsgId` là luật của tầng dữ liệu, để
  // route tự sinh là đẩy business logic vào `app/**` (HARD#2) và mỗi call-site lại một kiểu.
  return {
    isPending: mutation.isPending,
    mutate: (text: string) => mutation.mutate({ text, clientMsgId: newClientMsgId() }),
  };
}

/** Tắt huy hiệu chưa đọc. Gọi khi mở màn chat, không cần chờ kết quả. */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.markConversationRead(conversationId),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.conversations() }),
  });
}
