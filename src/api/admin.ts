import {
  moderationActivity,
  moderationListings,
  moderationOverview,
  moderationRemoveListing,
  moderationSetListingStatus,
  reportList,
  reportResolve,
} from './generated';
import type { Listing as ListingDto } from './generated';
import { formatPrice, gradOf, relativeTime, unwrap } from './client';
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
export type ModStatus = 'pending' | 'active' | 'hidden' | 'rejected';

export type ModListing = {
  id: string;
  title: string;
  price: string;
  cat: string;
  photo: Grad;
  seller: string;
  avatar: string;
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
  tone: 'ok' | 'alert' | 'note' | 'info' | 'muted';
  text: string;
  time: string;
};

export type AdminKpi = {
  key: 'pending' | 'live' | 'users' | 'reports';
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

/** Nhãn tiếng Việt cho `REPORT_KIND` của BE. */
const REPORT_KIND_LABEL: Record<string, string> = {
  scam: 'Nghi lừa đảo',
  wrong_info: 'Sai mô tả',
  harassment: 'Nhắn tin làm phiền',
  banned_item: 'Hàng không được bán',
  other: 'Khác',
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

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

function toModListing(dto: ListingDto, categoryNames: Map<string, string>): ModListing {
  return {
    id: dto._id,
    title: dto.title,
    price: formatPrice(dto.price),
    cat: categoryNames.get(dto.category) ?? '',
    photo: gradOf(dto._id),
    seller: dto.posterName || 'Người bán',
    avatar: initialsOf(dto.posterName || 'Người bán'),
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

  async getEvents(): Promise<AdminEvent[]> {
    const res = await withAuthRetry(() => moderationActivity({ query: { limit: 20 } }));
    return unwrap(res, 'Không tải được dòng hoạt động').map((log) => ({
      tone: EVENT_TONE[log.action] ?? 'info',
      text: `${log.actorName} · ${log.summary}`,
      time: `${relativeTime(log.createdAt)} trước`,
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

  async getReports(): Promise<Report[]> {
    const res = await withAuthRetry(() => reportList({ query: { status: 'open', limit: 50 } }));
    return unwrap(res, 'Không tải được báo cáo').map((r) => ({
      id: r.id,
      // "Nghi lừa đảo" là loại nặng nhất — viền đỏ, xếp trước.
      urgent: r.kind === 'scam',
      target: r.targetTitle,
      kind: REPORT_KIND_LABEL[r.kind] ?? r.kind,
      by: r.reporterName,
      at: `${relativeTime(r.createdAt)} trước`,
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

/** Vai trò BE khai là `string` tự do, spec không liệt kê giá trị nào — đây là phần đã biết chắc. */
const MEMBER_ROLES = new Set(['member', 'user', 'customer', 'student', 'guest']);

/**
 * Có mở được bàn quản trị không. Chặn theo danh sách **người dùng thường** chứ không phải
 * whitelist admin: đoán sai tên vai admin thì không ai vào được và chẳng ai biết vì sao, còn
 * đoán sai theo chiều này thì cùng lắm là hiện thêm một mục menu.
 *
 * Đây chỉ là cửa của giao diện — BE đã chặn thật bằng `authorize(OWNER, MODERATOR)`.
 */
export const canOpenAdmin = (role: string) => !MEMBER_ROLES.has(role.trim().toLowerCase());
