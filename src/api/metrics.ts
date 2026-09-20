import { metricsSystem } from './generated';
import type { SystemMetrics } from './generated';
import { unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Số liệu toàn nền tảng — bàn của master.
 *
 * Tách khỏi `api/admin.ts` (vốn đã 370 dòng) vì nó không cùng phạm vi: mọi thứ trong đó là dữ
 * liệu của MỘT tổ chức và đọc `X-Org-Id`, còn ở đây thì header đó không ảnh hưởng gì —
 * `requireMaster` bên BE không nhìn tới nó.
 *
 * KHÔNG map lại hình dạng: BE đã trả về đúng những khối màn hình cần, nên một mapper ở đây chỉ
 * là một chỗ nữa để hai bên lệch nhau. Type lấy thẳng từ SDK sinh tự động.
 */
export type { SystemMetrics };

export const metricsApi = {
  async system(): Promise<SystemMetrics> {
    const res = await withAuthRetry(() => metricsSystem());
    return unwrap(res, 'Không tải được số liệu hệ thống');
  },
};
