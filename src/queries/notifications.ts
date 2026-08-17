import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Notif } from '@/api/db';
import { qk } from './keys';

/**
 * Thông báo trong tổ chức. Tách khỏi `listings.ts` theo domain (query.convention §8): nó chưa
 * bao giờ là dữ liệu của bảng tin, chỉ ở nhờ đó — và `listings.ts` đã chạm trần 200 dòng.
 */

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications(), queryFn: api.getNotifications });
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
