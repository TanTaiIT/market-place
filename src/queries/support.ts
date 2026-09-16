import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/api/support';
import { onSocketEvent } from '@/api/socket';
import { useIsAuthenticated } from '@/stores/auth';
import { qk } from './keys';

/**
 * Lưới dự phòng cho socket, KHÔNG phải đường chính.
 *
 * Socket rớt là chuyện thường ngày của app mobile (xuống background, đổi Wi-Fi ↔ 4G), và
 * server xoá sạch room membership mỗi lần rớt. Gỡ hẳn polling thì mỗi lần rớt là một khoảng
 * câm không giới hạn; để 5 phút thì trường hợp xấu nhất vẫn có đáy.
 *
 * 60 giây như bản trước là thừa khi đã có socket — đó là nhân 5 lần lưu lượng cho một nhịp
 * mà gần như lần nào cũng trả về đúng thứ client đang có.
 */
const POLL_MS = 5 * 60_000;

/**
 * Luồng hỗ trợ của chính mình — nguồn của CHẤM ĐỎ trên nút nổi.
 *
 * Câu trả lời của master đến từ phía server, không sinh ra bởi bất kỳ thao tác nào của người
 * dùng — nên phải có đường để server ĐÁNH THỨC client:
 *
 * 1. `support:reply` qua socket — đường chính, gần như tức thì.
 * 2. `refetchInterval` — lưới dự phòng cho lúc socket rớt (xem `POLL_MS`).
 *
 * Sự kiện socket KHÔNG mang nội dung, chỉ là tiếng gõ cửa: nghe được thì đi đọc lại
 * `GET /support/me`. Dựng trạng thái từ payload socket là đẻ ra đường thứ hai để tạo ra cùng
 * một dữ liệu, và hai đường sẽ lệch nhau ngay lần đầu một gói tin rớt giữa chừng.
 *
 * KHÔNG chạm tới instance socket: `onSocketEvent` chỉ ghi nhận nguyện vọng, `api/socket`
 * chịu trách nhiệm gắn lại handler sau mỗi lần nối lại — cùng cách `queries/chat` làm.
 *
 * `enabled` theo phiên đăng nhập: khách không có luồng nào, hỏi là ăn 401 mỗi nhịp.
 */
export function useSupportThread() {
  const isAuthenticated = useIsAuthenticated();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    // Người dùng chỉ ở trong phòng RIÊNG của mình, tự vào lúc bắt tay — không có phòng nào để
    // xin vào, và cũng không có id nào để lỡ nghe nhầm luồng của người khác.
    return onSocketEvent('support:reply', () => {
      void qc.invalidateQueries({ queryKey: qk.supportThread() });
    });
  }, [isAuthenticated, qc]);

  return useQuery({
    queryKey: qk.supportThread(),
    queryFn: supportApi.myThread,
    enabled: isAuthenticated,
    refetchInterval: POLL_MS,
  });
}

export function useSendSupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => supportApi.send(body),
    // Server trả về luồng ĐẦY ĐỦ sau khi ghi — ghi thẳng vào cache thay vì bắn thêm một lượt
    // đọc. Tin vừa gửi hiện ra ngay mà không có nhịp trống nào.
    onSuccess: (thread) => qc.setQueryData(qk.supportThread(), thread),
  });
}

/**
 * Đánh dấu đã đọc.
 *
 * `onSettled` chứ không `onSuccess`: mạng hỏng thì chấm đỏ vẫn phải về đúng trạng thái của
 * server ở lượt hỏi kế tiếp, không để nó tắt bằng niềm tin.
 */
export function useMarkSupportRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: supportApi.markRead,
    onSettled: () => qc.invalidateQueries({ queryKey: qk.supportThread() }),
  });
}

/* ------------------------------- phía master ------------------------------- */

export function useSupportQueue(waiting: boolean) {
  return useQuery({
    queryKey: qk.supportQueue(waiting),
    queryFn: () => supportApi.queue(waiting),
  });
}

/**
 * Một luồng cho master đọc.
 *
 * `staleTime: 0` + không cache lâu: mở luồng là một thao tác GHI ở BE (đánh dấu đã xem), nên
 * đọc lại từ cache cũ sẽ hiện một luồng đã rời hàng đợi như thể nó vẫn đang chờ.
 */
export function useSupportThreadDetail(id: string | null) {
  return useQuery({
    queryKey: qk.supportThreadDetail(id ?? ''),
    queryFn: () => supportApi.thread(id!),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useReplySupport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => supportApi.reply(id, body),
    onSuccess: (thread) => {
      qc.setQueryData(qk.supportThreadDetail(thread.id), thread);
      // Trả lời xong thì luồng đó rời hàng đợi — quét cả cụm để danh sách không giữ dòng cũ.
      void qc.invalidateQueries({ queryKey: qk.supportRoot() });
    },
  });
}
