import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/api/client';
import { onSocketEvent } from '@/api/socket';
import { useIsAuthenticated } from '@/stores/auth';
import type { Notif } from '@/api/db';
import { qk } from './keys';
import { mapPages, usePagedList, type PagedCache } from './paged';

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
  return usePagedList(qk.notifications(), api.getNotifications, { enabled: isAuthenticated });
}

/**
 * Tín hiệu "có thông báo mới" khi người dùng đang ở bất kỳ màn nào.
 *
 * Đối xứng với `useInboxSignal` của chat, và cùng một luật: chỉ `invalidateQueries`, không tự
 * đếm. Số chưa đọc có đúng một nguồn là `qk.notifications()` — dựng thêm bộ đếm ở client là hẹn
 * ngày hai chỗ nói hai số khác nhau, mà cái sai sẽ là cái badge người dùng nhìn thấy.
 *
 * Nhận `qc` qua THAM SỐ vì gọi ở thân `RootLayout`, vốn nằm NGOÀI `<QueryClientProvider>` —
 * provider do chính nó render ra bên dưới. Gọi `useQueryClient()` ở đó thì app chết ngay lúc
 * mở với "No QueryClient set"; đã vấp đúng một lần.
 *
 * KHÔNG kèm hiệu ứng chuông ở đây: hiệu ứng sống cùng cái chuông (`TabBar`), còn hook này phải
 * sống kể cả khi thanh tab không hiển thị (màn chi tiết, màn quản trị). Hai việc, hai vòng đời.
 */
export function useNotifSignal(qc: QueryClient): void {
  useEffect(() => {
    const off = onSocketEvent('notif:new', () => {
      void qc.invalidateQueries({ queryKey: qk.notifications() });
    });
    return off;
  }, [qc]);
}

/**
 * Bản lạc quan của luật BE (`markRead`): đánh dấu một dòng TỰ ĐỘNG là đẩy mốc "đã xem" của cả
 * nhóm tới thời điểm dòng đó, nên mọi dòng tự động cũ hơn TRONG NHÓM ĐÓ cũng tắt chấm. Không mô
 * phỏng thì cụm "Tài và 3 người khác vừa đăng 5 tin" còn 4 chấm treo tới khi refetch về.
 * `at` là ISO nên so chuỗi là so thời gian.
 */
const coveredBy = (target: Notif | undefined, n: Notif): boolean =>
  !!target?.actorName && !!n.actorName && n.orgId === target.orgId && n.at <= target.at;

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
      const prev = qc.getQueryData<PagedCache<Notif>>(qk.notifications());
      const target = prev?.pages.flatMap((pg) => pg.items).find((n) => n.id === id);
      qc.setQueryData<PagedCache<Notif>>(qk.notifications(), (old) =>
        mapPages(old, (items) =>
          items.map((n) => (n.id === id || coveredBy(target, n) ? { ...n, unread: false } : n)),
        ),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notifications(), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
}
