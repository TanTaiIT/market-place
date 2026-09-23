import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Message } from '@/api/db';
import { useIsAuthenticated } from '@/stores/auth';
import { qk } from './keys';
import { appendToNewest, usePagedList, type PagedCache } from './paged';

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
  return usePagedList(qk.conversations(), api.getConversations, { enabled: isAuthenticated });
}


export function useConversation(id: string) {
  return useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.getConversation(id),
    enabled: id.length > 0,
  });
}

/**
 * Lịch sử tin nhắn. Trang 1 là 10 tin MỚI nhất; kéo lên đầu là tải trang cũ hơn — nối lên
 * ĐẦU danh sách (`olderPagesFirst`). Tin mới về qua socket (`useConversationRoom`), không polling.
 */
export function useMessages(conversationId: string) {
  return usePagedList(qk.messages(conversationId), (page) => api.getMessages(conversationId, page), {
    enabled: conversationId.length > 0,
    olderPagesFirst: true,
  });
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
      const prev = qc.getQueryData<PagedCache<Message>>(key);
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
      qc.setQueryData<PagedCache<Message>>(key, (old) => appendToNewest(old, optimistic));
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

/**
 * Xoá một hội thoại khỏi hộp thư.
 *
 * Refetch contract: `onSuccess` invalidate `conversations()` (dòng biến mất khỏi danh sách) và
 * `messages(id)` (lịch sử đã bị BE cắt — giữ cache cũ thì mở lại hội thoại sau khi người kia
 * nhắn tiếp sẽ thấy đúng những tin vừa xoá).
 *
 * KHÔNG optimistic: khác `markRead`, đây là thao tác không lùi lại được, và gỡ dòng khỏi danh
 * sách trước khi BE xác nhận là hứa một điều chưa xảy ra.
 */
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.deleteConversation(conversationId),
    onSuccess: (_data, conversationId) => {
      qc.invalidateQueries({ queryKey: qk.conversations() });
      qc.removeQueries({ queryKey: qk.messages(conversationId) });
    },
  });
}

/**
 * Dọn cả hộp thư. Trả về số hội thoại đã xoá.
 *
 * Refetch contract: `onSuccess` invalidate `conversations()`. Lịch sử tin nhắn dọn bằng
 * `conversationRoot()` — không liệt kê được từng id ở đây, mà bỏ sót một cái là mở lại đúng hội
 * thoại đó thấy nguyên những tin vừa xoá.
 */
export function useClearConversations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAllConversations(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.conversations() });
      qc.removeQueries({ queryKey: qk.conversationRoot() });
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
