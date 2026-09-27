import {
  supportMarkRead,
  supportMyThread,
  supportQueue,
  supportReply,
  supportSend,
  supportThread,
} from './generated';
import type { MySupportThread, SupportQueueItem, SupportThread } from './generated';
import { PAGE_SIZE, unwrap, unwrapPage } from './client';
import type { Page } from './client';
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

  /**
   * Một TRANG hàng đợi, 10 luồng — trần chung của mọi danh sách (`PAGINATION.MAX_LIMIT` bên BE).
   *
   * Bản trước xin `limit: 100` một lượt với ý "thấy trọn hàng đợi". Ý đó chưa bao giờ thành: BE
   * vẫn kẹp về 10, nên master chỉ thấy 10 luồng đầu mà không có dấu hiệu nào; và từ khi schema
   * chặn cứng ở 10 thì nó thành lỗi 400. Phân trang thật (cuộn tới đâu tải tới đó) là đường duy
   * nhất vừa đúng luật chung vừa không cắt mất việc của master.
   */
  async queue(waiting: boolean, page: number): Promise<Page<SupportQueueItem>> {
    const res = await withAuthRetry(() =>
      supportQueue({
        query: {
          // Chuỗi chứ không boolean: BE nhận `'true' | 'false'` vì `Boolean('false')` là `true`.
          waiting: waiting ? 'true' : 'false',
          page,
          limit: PAGE_SIZE,
        },
      }),
    );
    return unwrapPage(res, 'Không tải được hàng đợi hỗ trợ', (t) => t);
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
