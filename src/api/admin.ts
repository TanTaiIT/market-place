import {
  moderationActivity,
  moderationCoverage,
  moderationListings,
  moderationPublicQueue,
  moderationRerouteListing,
  moderationOverview,
  moderationPublicOverview,
  moderationRemoveListing,
  moderationSetListingStatus,
  myRoleGrants,
  reportList,
  reportResolve,
} from './generated';
import type { Listing as ListingDto, RerouteListing, RoleGrant } from './generated';
import { reportKindLabel } from './report';
import { formatPrice, gradOf, initialsOf, relativeTime, unwrap } from './client';
import { withAuthRetry } from './http';
import type { Grad } from '@/theme';

/**
 * Bàn quản trị của **một trường**. BE tự scope theo organization trong JWT nên ở đây không có
 * tham số trường nào cả — quản trị đăng nhập bằng tài khoản trường nào thì thấy trường đó.
 *
 * Ba màn Tổng quan / Duyệt tin / Báo cáo đã chạy dữ liệu thật. Danh mục · Gửi thông báo ·
 * Người dùng · Trường & hệ thống · Cài đặt vẫn là fixture — xem
 * `docs/Vue/docs/architecture/admin-console.md` để biết còn thiếu collection nào.
 */

// ── TYPES ───────────────────────────────────────────────────────────

/** Bốn trạng thái bàn duyệt thao tác được. BE còn `draft`/`sold`/`expired` nhưng không đụng. */
/**
 * `pending_unverified` là tin do NGƯỜI NGOÀI gửi vào tổ chức — BE tách hẳn trạng thái để bàn
 * duyệt tách được hai hàng đợi: tin của thành viên và tin của người lạ. Gộp chung thì quản trị
 * không còn phân biệt được, mà đó chính là lý do trạng thái này tồn tại.
 */
export type ModStatus = 'pending' | 'pending_unverified' | 'active' | 'hidden' | 'rejected';

export type ModListing = {
  id: string;
  title: string;
  price: string;
  cat: string;
  photo: Grad;
  seller: string;
  avatar: string;
  /** Snapshot ảnh đại diện lúc tạo tin. Rỗng = rơi về chữ viết tắt. */
  avatarUrl?: string;
  at: string;
  views: number;
  status: ModStatus;
  /** Chỉ có khi `status === 'rejected'`. */
  reason?: string;
  desc: string;
};

export type Report = {
  id: string;
  urgent: boolean;
  target: string;
  kind: string;
  by: string;
  at: string;
  count: number;
  quote: string;
};

export type AdminEvent = {
  /**
   * `_id` của dòng nhật ký. Bắt buộc mang theo vì đây là KHOÁ RENDER: hai lượt duyệt giống
   * hệt nhau trong cùng một giờ cho ra `text` và `time` y như nhau, nên khoá ghép từ nội
   * dung sẽ trùng — React bỏ bớt dòng hoặc vẽ nhầm dòng, im lặng.
   */
  id: string;
  tone: 'ok' | 'alert' | 'note' | 'info' | 'muted';
  text: string;
  time: string;
};

export type AdminKpi = {
  key: 'pending' | 'live' | 'users' | 'reports' | 'hidden' | 'rejected';
  label: string;
  value: number;
  trend: number[];
};

export type TrendPoint = { approved: number; pending: number };
export type CatShare = { cat: string; count: number };

type Overview = {
  kpis: AdminKpi[];
  trend: TrendPoint[];
  cats: CatShare[];
};

/** Màu chấm dòng thời gian theo nhóm hành động. */
const EVENT_TONE: Record<string, AdminEvent['tone']> = {
  'listing.approve': 'ok',
  'listing.reject': 'alert',
  'listing.hide': 'note',
  'listing.unhide': 'ok',
  'listing.remove': 'alert',
  'report.resolve': 'alert',
  'report.dismiss': 'muted',
};

function toModListing(dto: ListingDto, categoryNames: Map<string, string>): ModListing {
  return {
    id: dto._id,
    title: dto.title,
    price: formatPrice(dto.price),
    cat: categoryNames.get(dto.category) ?? '',
    photo: gradOf(dto._id),
    seller: dto.posterName || 'Người bán',
    avatar: initialsOf(dto.posterName || 'Người bán'),
    avatarUrl: dto.posterAvatar || undefined,
    at: relativeTime(dto.createdAt),
    views: dto.viewCount,
    status: dto.status as ModStatus,
    reason: (dto as { moderation?: { reason?: string } }).moderation?.reason,
    desc: dto.description,
  };
}

/** Sparkline cần một chuỗi ngắn: sáu mốc gần nhất của biểu đồ 14 ngày, chốt bằng số hiện tại. */
const tail = (series: number[], last: number) =>
  series.length ? [...series.slice(-6), last] : [last];

// ── API ─────────────────────────────────────────────────────────────

export const adminApi = {
  /** Thẻ số + hai biểu đồ. BE trả số thật, không còn `+4` / `+12%` bịa như prototype. */
  async getOverview(): Promise<Overview> {
    const res = await withAuthRetry(() => moderationOverview());
    const data = unwrap(res, 'Không tải được số liệu');

    // Sparkline cần một chuỗi; dựng từ biểu đồ 14 ngày thay vì bịa số như bản fixture.
    const approved = data.trend.map((d) => d.approved);
    const pendingSeries = data.trend.map((d) => d.pending);

    return {
      kpis: [
        { key: 'pending', label: 'Chờ duyệt', value: data.pending, trend: tail(pendingSeries, data.pending) },
        { key: 'live', label: 'Đang hiển thị', value: data.live, trend: tail(approved, data.live) },
        { key: 'users', label: 'Người dùng', value: data.users, trend: [data.users] },
        { key: 'reports', label: 'Báo cáo mở', value: data.openReports, trend: [data.openReports] },
      ],
      trend: data.trend.map((d) => ({ approved: d.approved, pending: d.pending })),
      cats: data.categories.map((c) => ({ cat: c.name, count: c.count })),
    };
  },

  /**
   * Cùng hình dạng `Overview` với bàn org để dùng lại `AdminKpis`/`TrendChart`, nhưng hai thẻ
   * "Người dùng"/"Báo cáo mở" không tồn tại ở trục này (số của MỘT tổ chức). Chỗ đó thay bằng
   * hai trạng thái người phụ trách ô phải theo: tin đang ẩn và tin đã từ chối.
   */
  async getPublicOverview(): Promise<Overview> {
    const res = await withAuthRetry(() => moderationPublicOverview());
    const data = unwrap(res, 'Không tải được số liệu trục danh mục');

    const approved = data.trend.map((d) => d.approved);
    const pendingSeries = data.trend.map((d) => d.pending);

    return {
      kpis: [
        {
          key: 'pending',
          label: 'Chờ duyệt',
          value: data.pending,
          trend: tail(pendingSeries, data.pending),
        },
        { key: 'live', label: 'Đang hiển thị', value: data.live, trend: tail(approved, data.live) },
        { key: 'hidden', label: 'Đang ẩn', value: data.hidden, trend: [data.hidden] },
        { key: 'rejected', label: 'Đã từ chối', value: data.rejected, trend: [data.rejected] },
      ],
      trend: data.trend.map((d) => ({ approved: d.approved, pending: d.pending })),
      cats: data.categories.map((c) => ({ cat: c.name, count: c.count })),
    };
  },
  async getEvents(): Promise<AdminEvent[]> {
    const res = await withAuthRetry(() => moderationActivity({ query: { limit: 20 } }));
    return unwrap(res, 'Không tải được dòng hoạt động').map((log) => ({
      id: log.id,
      tone: EVENT_TONE[log.action] ?? 'info',
      text: `${log.actorName} · ${log.summary}`,
      time: relativeTime(log.createdAt),
    }));
  },

  /**
   * `status` bỏ trống = mọi trạng thái bàn duyệt thao tác được. Tên danh mục truyền vào từ
   * ngoài (tầng query đã có sẵn `useCategories`) để không gọi `/categories` thêm một lượt.
   */
  async getListings(
    status: ModStatus | undefined,
    categoryNames: Map<string, string>,
  ): Promise<ModListing[]> {
    const res = await withAuthRetry(() =>
      moderationListings({ query: { status, limit: 100 } }),
    );
    return unwrap(res, 'Không tải được tin đăng').map((l) => toModListing(l, categoryNames));
  },

  /**
   * Hàng đợi TRỤC DANH MỤC. Phạm vi (danh mục × tỉnh) KHÔNG gửi từ đây — BE lấy từ chính
   * `role_grants` của người gọi và áp ở tầng query, nên client không có cách nào xem rộng hơn
   * phần mình được cấp dù có gửi tham số gì.
   */
  async getPublicQueue(
    status: ModStatus | undefined,
    categoryNames: Map<string, string>,
  ): Promise<ModListing[]> {
    const res = await withAuthRetry(() => moderationPublicQueue({ query: { status, limit: 100 } }));
    return unwrap(res, 'Không tải được hàng đợi công khai').map((l) =>
      toModListing(l, categoryNames),
    );
  },

  /** Ma trận phủ sóng: BE chỉ trả các ô ĐÁNG CHÚ Ý (chưa có người, hoặc đang tồn đọng). */
  async getCoverage() {
    const res = await withAuthRetry(() => moderationCoverage());
    return unwrap(res, 'Không tải được ma trận phủ sóng');
  },

  /** Quyền hệ thống của chính người đang đăng nhập — nguồn duy nhất để biết ai là master. */
  async getMyGrants(): Promise<RoleGrant[]> {
    const res = await withAuthRetry(() => myRoleGrants());
    return unwrap(res, 'Không tải được quyền của bạn');
  },

  /** Chuyển tin sang ô khác — tin quay về đầu hàng đợi mới, và để lại vết kiểm toán. */
  async rerouteListing(id: string, input: RerouteListing) {
    const res = await withAuthRetry(() =>
      moderationRerouteListing({ path: { id }, body: input }),
    );
    return unwrap(res, 'Không chuyển được tin sang ô khác');
  },

  async getReports(): Promise<Report[]> {
    const res = await withAuthRetry(() => reportList({ query: { status: 'open', limit: 50 } }));
    return unwrap(res, 'Không tải được báo cáo').map((r) => ({
      id: r.id,
      // "Nghi lừa đảo" là loại nặng nhất — viền đỏ, xếp trước.
      urgent: r.kind === 'scam',
      target: r.targetTitle,
      // Nhãn lấy từ `report.ts` — cùng bản với ngăn người dùng chọn lúc gửi (xem file đó).
      kind: reportKindLabel(r.kind),
      by: r.reporterName,
      at: relativeTime(r.createdAt),
      count: r.count,
      quote: r.quote,
    }));
  },

  async setStatus(id: string, status: ModStatus, reason?: string) {
    const res = await withAuthRetry(() =>
      moderationSetListingStatus({
        path: { id },
        body: { status: status as 'active' | 'rejected' | 'hidden', reason },
      }),
    );
    unwrap(res, 'Không cập nhật được trạng thái tin');
    return { id };
  },

  async remove(id: string) {
    const res = await withAuthRetry(() => moderationRemoveListing({ path: { id } }));
    unwrap(res, 'Không gỡ được tin này');
    return { id };
  },

  async resolveReport(id: string, hideTarget: boolean) {
    const res = await withAuthRetry(() =>
      reportResolve({ path: { id }, body: { action: hideTarget ? 'hide_target' : 'ignore' } }),
    );
    unwrap(res, 'Không xử lý được báo cáo');
    return { id };
  },
};

/**
 * Có mở được bàn quản trị không.
 *
 * Bản cũ đoán theo chuỗi `profile.role` — một field mà BE đã bỏ khỏi model từ lúc vai trò
 * tách thành quan hệ, nên nó về `undefined` và màn hồ sơ nổ ngay khi quay lại từ bàn quản trị.
 * Giờ hỏi đúng nguồn: **có grant nào không**. Đó cũng chính là thứ BE chặn (`requireOrgModerator`
 * → `canModerateAnyInOrg`, `requireCategoryModerator`), nên hai bên không còn đường lệch nhau.
 *
 * Thân phận trong tổ chức (`memberships.role`) KHÔNG mở được cửa này: owner một trường mà chưa
 * ai cấp grant thì vẫn chưa duyệt được gì — đúng ý "thành viên nhưng không có quyền duyệt".
 */
export const canOpenAdmin = (grants: RoleGrant[] | undefined) => (grants ?? []).length > 0;

/**
 * Master = có grant `master` phạm vi toàn hệ thống. Đọc từ `role_grants` chứ không từ `role`
 * của user: `role` là thân phận trong tổ chức, hoàn toàn khác quyền hệ thống — một owner
 * trường vẫn không phải master, và một master có thể chẳng đứng trong trường nào.
 */
export const isMaster = (grants: RoleGrant[] | undefined) =>
  (grants ?? []).some((g) => g.role === 'master' && g.scopeType === 'system');

/**
 * Mở được hàng đợi trục danh mục không. Master vào được vì họ là nơi tin rơi về khi ô chưa
 * có ai phụ trách — bỏ vế này thì đúng người phải dọn hàng tồn lại là người không thấy nó.
 *
 * HAI tầng đều tính: khớp `requireCategoryModerator`/`requireAnyModerator` của BE, vốn nhận cả
 * `category_province` lẫn `category_ward`. Kiểm một tầng là khoá người phụ trách PHƯỜNG ra khỏi
 * đúng màn của họ.
 */
export const canModeratePublicAxis = (grants: RoleGrant[] | undefined) =>
  isMaster(grants) ||
  (grants ?? []).some(
    (g) => g.scopeType === 'category_province' || g.scopeType === 'category_ward',
  );

/**
 * Duyệt được thứ gì đó trong tổ chức không (đơn gia nhập, tin nội bộ). Khớp `requireOrgModerator`
 * → `canModerateAnyInOrg` của BE: grant phạm vi `org`/`org_unit`, hoặc master.
 *
 * Không kiểm `orgId` như BE: app chỉ cần biết có nên hiện mục menu, còn tổ chức nào thì
 * `X-Org-Slug` quyết định lúc gọi. Kiểm chặt hơn ở đây sẽ giấu mất mục menu của chính tổ chức
 * mà người dùng vừa chuyển sang.
 */
export const canModerateOrg = (grants: RoleGrant[] | undefined) =>
  isMaster(grants) ||
  (grants ?? []).some((g) => g.scopeType === 'org' || g.scopeType === 'org_unit');

/**
 * Sửa được hồ sơ MỘT nhóm cụ thể không. Khớp `requireOrgAdmin` → `canAdminOrg` của BE:
 * master, hoặc grant `manager` phạm vi `org` trỏ đúng nhóm đó.
 *
 * KHÔNG đọc `memberships.role`: `role: 'admin'` chỉ là THÂN PHẬN hiển thị trong nhóm
 * (`MEMBERSHIP_ROLES` bên BE ghi rõ "quyền THẬT nằm ở role_grants"). Lấy nó làm cửa quyền thì
 * sai cả hai chiều — master không thuộc nhóm nào sẽ mất nút dù BE cho phép, còn người mang
 * nhãn admin mà không có grant sẽ thấy nút rồi ăn 403.
 *
 * Khác `canModerateOrg`: hàm kia cố tình KHÔNG so `orgId` vì nó chỉ quyết định có hiện mục
 * menu. Ở đây thì có đúng một nhóm đang mở, nên phải so — không so là hiện nút sửa trên nhóm
 * người ta chỉ ghé xem.
 */
export const canAdminOrg = (grants: RoleGrant[] | undefined, orgId: string | undefined) =>
  isMaster(grants) ||
  (!!orgId &&
    (grants ?? []).some(
      (g) => g.role === 'manager' && g.scopeType === 'org' && g.orgId === orgId,
    ));

/**
 * Cấp cao nhất đang giữ, để hiện cạnh cửa bàn quản trị. Một người có thể mang nhiều grant
 * (manager org này, staff nhóm kia) — nhãn phải nói cái cao nhất, không phải cái đầu mảng.
 */
export const topRole = (grants: RoleGrant[] | undefined) =>
  (['master', 'manager', 'staff'] as const).find((r) => (grants ?? []).some((g) => g.role === r)) ??
  null;
