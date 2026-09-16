import {
  supportMarkRead,
  supportMyThread,
  supportQueue,
  supportReply,
  supportSend,
  supportThread,
} from './generated';
import type { MySupportThread, SupportQueueItem, SupportThread } from './generated';
import { unwrap } from './client';
import { withAuthRetry } from './http';

export type SupportMessage = MySupportThread['messages'][number];
export type { MySupportThread, SupportQueueItem, SupportThread };

/**
 * Kênh trao đổi với đội ngũ nền tảng — người dùng ↔ master.
 *
 * KHÔNG phải `chat`: hội thoại bên đó bắt buộc gắn một tin đăng (`listingId` required, unique
 * theo `(listingId, buyerId)`), còn đây là một luồng duy nhất cho mỗi người, sống mãi, không
 * thuộc tổ chức nào. Hai thứ khác domain nên khác endpoint.
 */

/** Trần `limit` mà `/support/threads` khai trong spec — xem lý do ở `supportApi.queue`. */
const QUEUE_LIMIT = 100;

export const supportApi = {
  /** Luồng của chính mình. Chưa nhắn bao giờ vẫn trả về hình dạng đầy đủ với `id: null`. */
  async myThread(): Promise<MySupportThread> {
    const res = await withAuthRetry(() => supportMyThread());
    return unwrap(res, 'Không tải được tin nhắn hỗ trợ');
  },

  async send(body: string): Promise<MySupportThread> {
    const res = await withAuthRetry(() => supportSend({ body: { body } }));
    return unwrap(res, 'Không gửi được tin cho đội ngũ hỗ trợ');
  },

  /**
   * Tắt chấm đỏ. Gọi mỗi lần người dùng mở popup — BE chịu được cả khi chưa có luồng nào.
   */
  async markRead(): Promise<void> {
    const res = await withAuthRetry(() => supportMarkRead());
    unwrap(res, 'Không đánh dấu được đã đọc');
  },

  /* ------------------------------ phía master ------------------------------ */

  async queue(waiting: boolean): Promise<SupportQueueItem[]> {
    const res = await withAuthRetry(() =>
      supportQueue({
        query: {
          // Chuỗi chứ không boolean: BE nhận `'true' | 'false'` vì `Boolean('false')` là `true`.
          waiting: waiting ? 'true' : 'false',
          /*
           * Xin thẳng trần của endpoint này.
           *
           * `/support/threads` là ngoại lệ duy nhất trong spec: nó cho `limit` tới 100, còn mọi
           * endpoint danh sách khác chặn ở 10. Không gửi gì thì BE rơi về mặc định 10 và master
           * chỉ thấy 10 luồng đầu mà không có dấu hiệu nào — im lặng cắt mất việc phải làm.
           * Phản hồi có `meta` phân trang; khi hàng đợi vượt 100 thì chỗ này cần phân trang thật.
           */
          limit: QUEUE_LIMIT,
        },
      }),
    );
    return unwrap(res, 'Không tải được hàng đợi hỗ trợ');
  },

  /** Mở một luồng. Lệnh này ĐÁNH DẤU master đã xem, nên luồng rời hàng đợi. */
  async thread(id: string): Promise<SupportThread> {
    const res = await withAuthRetry(() => supportThread({ path: { id } }));
    return unwrap(res, 'Không mở được luồng hỗ trợ');
  },

  async reply(id: string, body: string): Promise<SupportThread> {
    const res = await withAuthRetry(() => supportReply({ path: { id }, body: { body } }));
    return unwrap(res, 'Không gửi được câu trả lời');
  },
};
