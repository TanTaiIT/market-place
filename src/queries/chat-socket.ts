import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { messageFromSocket } from '@/api/client';
import {
  connectSocket,
  disconnectSocket,
  joinConversation,
  leaveConversation,
  onSocketEvent,
  reconnectSocket,
} from '@/api/socket';
import type { Message } from '@/api/db';
import { useAuthStore } from '@/stores/auth';
import { qk } from './keys';
import { appendToNewest, mapPages, type PagedCache } from './paged';

/**
 * Tầng REALTIME của chat: giữ kết nối Socket.IO, vào/ra phòng hội thoại, và đổ sự kiện nhận
 * được vào cache TanStack.
 *
 * Tách khỏi `chat.ts` vì nó là một domain khác chứ không phải để chia cho đủ trần 200 dòng
 * (query.convention §8): `chat.ts` trả lời "hỏi BE cái gì", còn file này trả lời "BE đẩy về thì
 * làm gì". Hai bên đổi vì hai lý do khác nhau — thêm một endpoint không đụng tới đây, còn đổi
 * tên một sự kiện socket không đụng tới bên kia.
 *
 * Vẫn nằm ở `queries/**` chứ không phải `api/**` vì nó đọc store và ghi cache — hai chiều mà
 * `api/**` không được phép (folder.convention §6).
 */

/**
 * Tín hiệu "có tin nhắn mới" khi người dùng đang ở BẤT KỲ màn nào.
 *
 * Nghe `chat:inbox` — sự kiện BE phát vào phòng riêng của từng người nhận. Khác `chat:message`
 * của `useConversationRoom`: sự kiện kia đi vào phòng hội thoại nên chỉ tới được người đang mở
 * đúng màn chat đó, tức không bao giờ báo được cho người đang lướt bảng tin.
 *
 * Không tự đếm, không giữ state riêng: nó chỉ `invalidateQueries`. Số chưa đọc đã có đúng MỘT
 * nguồn là `qk.conversations()` (BE trả cờ `unread` cho từng hội thoại), nên dựng thêm một bộ
 * đếm ở client là hẹn ngày hai chỗ nói hai số khác nhau — và cái sai sẽ là cái badge, thứ người
 * dùng nhìn thấy. Đổi lại một lượt gọi REST mỗi tin nhắn đến, đúng thứ `staleTime` sinh ra để
 * gộp khi tin về dồn dập.
 *
 * Gọi MỘT lần ở `app/_layout.tsx`, cạnh `useChatSocket` — đặt trong màn chat thì nó chết ngay
 * khi người dùng rời màn đó, tức đúng lúc cần nó nhất.
 *
 * Nhận `qc` qua THAM SỐ chứ không `useQueryClient()`: thân `RootLayout` nằm NGOÀI
 * `<QueryClientProvider>` — provider do chính nó render ra trong JSX bên dưới. Gọi hook đó ở
 * đấy thì app chết ngay lúc mở với "No QueryClient set". Cùng lý do `useSyncAccessToken` và
 * `useValidateSession` đứng cạnh cũng nhận `queryClient` qua tham số.
 */
export function useInboxSignal(qc: QueryClient): void {
  useEffect(() => {
    const off = onSocketEvent('chat:inbox', () => {
      void qc.invalidateQueries({ queryKey: qk.conversations() });
    });
    return off;
  }, [qc]);
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

      qc.setQueryData<PagedCache<Message>>(qk.messages(conversationId), (old) => {
        const seen = old?.pages.flatMap((pg) => pg.items) ?? [];
        if (seen.some((m) => m.id === message.id)) return old;

        // Tin của CHÍNH MÌNH về qua socket chính là bản thật của bong bóng lạc quan đang hiển
        // thị — `clientMsgId` khớp là bằng chứng chắc chắn, không phải suy đoán theo nội dung.
        // Nối thêm thì màn chat hiện hai tin y hệt, rồi lượt refetch của `onSettled` xoá bớt
        // còn một. Thay tại chỗ để giữ nguyên vị trí tin, không đẩy nó xuống cuối.
        const pending = !!message.clientMsgId && seen.some((m) => m.clientMsgId === message.clientMsgId);
        if (pending) {
          return mapPages(old, (items) =>
            items.map((m) => (m.clientMsgId === message.clientMsgId ? message : m)),
          );
        }

        // Tin mới nhất vào trang ĐẦU (trang mới nhất) — xem `appendToNewest`.
        return appendToNewest(old, message);
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
