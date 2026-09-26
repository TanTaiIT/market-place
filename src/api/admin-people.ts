import {
  userClearRejections,
  userLiftProbation,
  userListForAdmin,
  userRestoreTrust,
  userSetProbation,
  userSetStatus,
  walletAdjust,
} from './generated';
import type { AdminUser as AdminUserDto } from './generated';
import { PAGE_SIZE, initialsOf, relativeTime, unwrap, unwrapPage } from './client';
import type { Page } from './client';
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
  /**
   * Chữ viết tắt để vẽ vòng tròn khi CHƯA có ảnh — KHÔNG phải URL.
   *
   * Field `avatar` của DTO bên BE là ảnh thật (`z.string().url()`), nhưng tên nó trùng với
   * field chữ viết tắt mà `Avatar` component nhận. Tách đôi ngay tại mapper, đúng như
   * `toMeProfile`/`toPublicProfile` bên `client.ts` đã làm và đã ghi rõ lý do: nhồi cả hai
   * vào một field thì call-site phải tự đoán mình đang giữ URL hay hai chữ cái. Đúng cái bẫy
   * đó đã cắn ở bảng người dùng — `text={item.avatar}` vẽ nguyên chuỗi URL vào vòng tròn
   * 38px và không bao giờ tải ảnh.
   */
  avatar: string;
  /** Ảnh thật. `undefined` khi người dùng chưa đặt — BE trả chuỗi rỗng cho ca đó. */
  avatarUrl?: string;
  status: UserStatus;
  /** Bậc uy tín: từ bậc 2 là tin tự lên bảng, chỉ hậu kiểm. Một số DUY NHẤT cho mọi trục. */
  trustLevel: number;
  /**
   * Án quản chế CÒN HIỆU LỰC của master, `null` khi không có. Đang quản chế thì tin của người
   * này không tự lên, máy không duyệt, và họ không tự duyệt được tin của mình dù là admin nhóm —
   * bậc uy tín giữ nguyên, nên hàng phải hiện án này TÁCH khỏi con số bậc.
   */
  probation: { reason: string; until: string | null } | null;
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
  avatar: initialsOf(dto.name),
  avatarUrl: dto.avatar || undefined,
  status: statusOf(dto),
  trustLevel: dto.trustLevel,
  probation: dto.probation
    ? { reason: dto.probation.reason, until: dto.probation.until ?? null }
    : null,
  joined: relativeTime(dto.createdAt),
  lastSeen: dto.lastLoginAt ? relativeTime(dto.lastLoginAt) : null,
});

// ── API ─────────────────────────────────────────────────────────────

export const adminPeopleApi = {
  /** Một trang của bảng người dùng — cuộn tới đâu tải tới đó, ô tìm để thu hẹp. */
  async getUsers(filter: UserFilter, page: number): Promise<Page<AdminUser>> {
    const res = await withAuthRetry(() =>
      userListForAdmin({
        query: {
          q: filter.q?.trim() || undefined,
          status: filter.status,
          page,
          limit: PAGE_SIZE,
        },
      }),
    );
    return unwrapPage(res, 'Không tải được danh sách người dùng', toUser);
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
   * Trả bậc uy tín về trần. Bậc leo lại bằng 5 tin sạch liên tiếp (người duyệt, hoặc máy từ
   * bậc 1) — nhưng bậc 0 thì máy không duyệt hộ, nên một lượt gỡ nhầm hai lần là chờ người
   * duyệt rảnh mới leo lại được. Nút này trả thẳng về trần. KHÔNG gỡ án 7 ngày: đó là
   * `clearRejections`.
   */
  async restoreTrust({ id, reason }: { id: string; reason: string }): Promise<AdminUser> {
    if (reason.trim().length < 3) throw new Error('Nhập lý do phục hồi (ít nhất 3 ký tự)');
    const res = await withAuthRetry(() =>
      userRestoreTrust({ path: { id }, body: { reason: reason.trim() } }),
    );
    return toUser(unwrap(res, 'Không phục hồi được uy tín'));
  },

  /**
   * Đặt quản chế. Nhẹ hơn thu hồi quyền quản trị: người này vẫn duyệt tin của người khác, chỉ
   * tin CỦA HỌ là phải qua người khác. Vô thời hạn — gỡ bằng `liftProbation`.
   */
  async setProbation({ id, reason }: { id: string; reason: string }): Promise<AdminUser> {
    if (reason.trim().length < 3) throw new Error('Nhập lý do quản chế (ít nhất 3 ký tự)');
    const res = await withAuthRetry(() =>
      userSetProbation({ path: { id }, body: { reason: reason.trim() } }),
    );
    return toUser(unwrap(res, 'Không đặt được quản chế'));
  },

  async liftProbation({ id }: { id: string }): Promise<AdminUser> {
    const res = await withAuthRetry(() => userLiftProbation({ path: { id } }));
    return toUser(unwrap(res, 'Không gỡ được quản chế'));
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
