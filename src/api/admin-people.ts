import { userClearRejections, userListForAdmin, userSetStatus, walletAdjust } from './generated';
import type { AdminUser as AdminUserDto } from './generated';
import { relativeTime, unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Bảng người dùng của bàn quản trị — **toàn hệ thống, chỉ master** (`GET /users` gác
 * `requireMaster`). Tài khoản ở v2 là toàn cục, không thuộc tổ chức nào, nên màn này cố tình
 * không có bộ lọc tổ chức: khoá một người là khoá ở mọi nơi, và đó chính là lý do quyền này
 * không nằm trong tay admin org.
 *
 * Trước đây file này là fixture in-memory (danh sách trường, `posts`/`sold`/`rating` bịa).
 * Những field đó KHÔNG có ở BE và đã bỏ hẳn; thứ thay vào là `trustLevel` — con số quyết định
 * tin của người này có tự lên bảng hay không, tức là thứ duy nhất ở đây thật sự đáng nhìn.
 *
 * `verifyUser` cũng bỏ: xác thực email là việc của chính người dùng, BE không có endpoint nào
 * cho quản trị bấm hộ. Thứ gần nhất là gỡ án phạt đăng tin (`clear-rejections`).
 */

// ── TYPES ───────────────────────────────────────────────────────────

/**
 * Ba nhánh gộp từ hai cột của BE (`isActive` + `isEmailVerified`).
 *
 * `unverified` ở đây nghĩa là **chưa xác thực email**, không phải "chờ quản trị duyệt" như bản
 * fixture — không có hàng đợi nào cho việc đó.
 */
export type UserStatus = 'ok' | 'unverified' | 'locked';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: UserStatus;
  /** Bậc uy tín: từ bậc 2 là tin tự lên bảng, chỉ hậu kiểm. Một số DUY NHẤT cho mọi trục. */
  trustLevel: number;
  joined: string;
  /** `null` = chưa đăng nhập lần nào kể từ khi BE bắt đầu ghi cột này. */
  lastSeen: string | null;
};

/** Bộ lọc BE nhận. `status` chỉ có hai nhánh — "chưa xác thực email" không phải điều kiện lọc. */
export type UserFilter = {
  q?: string;
  status?: 'active' | 'locked';
};

export type WalletAdjustInput = {
  userId: string;
  /** Số nguyên khác 0; âm = trừ Xu. */
  amount: number;
  note: string;
  idempotencyKey: string;
};

const statusOf = (dto: AdminUserDto): UserStatus =>
  !dto.isActive ? 'locked' : dto.isEmailVerified ? 'ok' : 'unverified';

const toUser = (dto: AdminUserDto): AdminUser => ({
  id: dto.id,
  name: dto.name,
  email: dto.email,
  avatar: dto.avatar,
  status: statusOf(dto),
  trustLevel: dto.trustLevel,
  joined: relativeTime(dto.createdAt),
  lastSeen: dto.lastLoginAt ? relativeTime(dto.lastLoginAt) : null,
});

// ── API ─────────────────────────────────────────────────────────────

export const adminPeopleApi = {
  /**
   * `limit: 100` (trần của BE) và BỎ `meta`, y hệt `orgAdminApi.listAll`: quá 100 tài khoản thì
   * bảng cắt im lặng, nên ô tìm là đường thu hẹp chính. Vượt mốc đó thì phân trang thật trước.
   */
  async getUsers(filter: UserFilter = {}): Promise<AdminUser[]> {
    const res = await withAuthRetry(() =>
      userListForAdmin({
        query: { q: filter.q?.trim() || undefined, status: filter.status, limit: 100 },
      }),
    );
    return unwrap(res, 'Không tải được danh sách người dùng').map(toUser);
  },

  /**
   * Khoá / mở khoá. Lý do BẮT BUỘC khi khoá — BE trả 400 nếu thiếu, và đúng thế: khoá một tài
   * khoản toàn cục mà không để lại câu nào là thứ không ai giải thích được sau ba tháng.
   */
  async setLock({
    id,
    isActive,
    reason,
  }: {
    id: string;
    isActive: boolean;
    reason: string;
  }): Promise<AdminUser> {
    const note = reason.trim();
    if (!isActive && !note) throw new Error('Nhập lý do khoá trước đã');
    // BE nhận `reason` tối thiểu 5 ký tự, và bỏ trống thì nó phải VẮNG MẶT: gửi chuỗi rỗng là
    // 400 ở nhánh mở khoá, nơi lý do vốn không bắt buộc.
    if (note && note.length < 5) throw new Error('Lý do cần ít nhất 5 ký tự');
    const res = await withAuthRetry(() =>
      userSetStatus({ path: { id }, body: { isActive, ...(note ? { reason: note } : {}) } }),
    );
    return toUser(unwrap(res, 'Không đổi được trạng thái tài khoản'));
  },

  /**
   * Gỡ án phạt đăng tin. Bị 3 tin từ chối trong 7 ngày là quyền đăng bị khoá cho tới hết cửa
   * sổ — đây là đường DUY NHẤT gỡ sớm, và nó tồn tại vì oan sai của máy quét cũng rơi vào cùng
   * bộ đếm đó.
   */
  async clearRejections({ id, reason }: { id: string; reason: string }): Promise<void> {
    if (reason.trim().length < 3) throw new Error('Nhập lý do gỡ án phạt (ít nhất 3 ký tự)');
    const res = await withAuthRetry(() =>
      userClearRejections({ path: { id }, body: { reason: reason.trim() } }),
    );
    unwrap(res, 'Không gỡ được án phạt đăng tin');
  },

  /**
   * Cộng/trừ Xu cho một tài khoản.
   *
   * ⚠️ Master **không đọc được số dư của người khác** — BE cố ý chỉ có `GET /wallet` của chính
   * chủ. Nên đây là thao tác mù: màn hình phải nói ra điều đó thay vì hiện một ô số dư bịa.
   *
   * `idempotencyKey` do màn hình sinh MỘT lần cho mỗi lần mở form: bấm nhầm hai lần với cùng
   * khoá chỉ ra một dòng sổ, và đó là thứ duy nhất ngăn cộng đôi Xu.
   */
  async adjustWallet({ userId, amount, note, idempotencyKey }: WalletAdjustInput): Promise<void> {
    if (!Number.isInteger(amount) || amount === 0) {
      throw new Error('Số Xu phải là số nguyên khác 0');
    }
    if (!note.trim()) throw new Error('Nhập lý do điều chỉnh trước đã');
    const res = await withAuthRetry(() =>
      walletAdjust({
        path: { userId },
        body: { amount, note: note.trim(), idempotencyKey },
      }),
    );
    unwrap(res, 'Không điều chỉnh được ví');
  },
};
