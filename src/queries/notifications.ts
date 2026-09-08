import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useIsAuthenticated } from '@/stores/auth';
import type { Notif } from '@/api/db';
import { qk } from './keys';

/**
 * Thông báo trong tổ chức. Tách khỏi `listings.ts` theo domain (query.convention §8): nó chưa
 * bao giờ là dữ liệu của bảng tin, chỉ ở nhờ đó — và `listings.ts` đã chạm trần 200 dòng.
 */

/**
 * Hộp thư của người đang đăng nhập.
 *
 * `enabled` KHÔNG phải để tiết kiệm một request — nó chặn một lỗi DÍNH LẠI. Màn Thông báo gọi
 * hook này TRƯỚC cửa `GuestGate` (luật hooks không cho gọi sau một `return` có điều kiện), nên
 * khách mở tab là `GET /notifications` bay đi không token và nhận 401 `Missing access token`.
 * Khách không thấy gì — màn trả về `GuestGate` — nhưng lỗi đó đã nằm trong cache của
 * `qk.notifications()`.
 *
 * Và nó KHÔNG tự đi: đăng nhập không dọn cache (chỉ `useSignOut` gọi `qc.clear()`), tab đã mount
 * thì không remount nên `refetchOnMount` không chạy, còn `refetchOnWindowFocus` thì tắt ở
 * `_layout`. Kết quả là người ĐÃ đăng nhập mở tab Thông báo và đọc "📡 Missing access token" —
 * `notif.tsx` in thẳng `error.message` ra `EmptyState`.
 *
 * Mọi query cần đăng nhập mà khách với tới được đều đã gác đúng thế này (`useProfile`,
 * `useConversations`, `useMyOrgs`, `useMyGrants`); đây là chỗ duy nhất còn sót.
 */
export function useNotifications() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: api.getNotifications,
    enabled: isAuthenticated,
  });
}

/**
 * Đánh dấu đã đọc, cập nhật lạc quan.
 *
 * Optimistic vì đây là thao tác một chiều và không có gì để tranh chấp: chấm chưa đọc phải
 * tắt ngay lúc chạm, chờ một vòng mạng rồi mới tắt sẽ khiến người dùng chạm lần hai.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.notifications() });
      const prev = qc.getQueryData<Notif[]>(qk.notifications());
      qc.setQueryData<Notif[]>(qk.notifications(), (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, unread: false } : n)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notifications(), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
}
