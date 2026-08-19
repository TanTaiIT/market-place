import {
  approveJoinRequest,
  bulkApproveJoinRequests,
  cancelJoinRequest,
  createJoinRequest,
  createOrgUnit,
  deleteOrgUnit,
  listJoinRequests,
  listOrgUnits,
  membershipList,
  myJoinRequests,
  myOrganizations,
  organizationLookup,
  rejectJoinRequest,
  updateOrgUnit,
} from './generated';
import type { CreateOrgUnit, JoinRequest, Member, OrgUnit, UpdateOrgUnit } from './generated';

/** Màn hình dùng nhóm con đi qua đây, không import thẳng `generated` — `app/**` chỉ biết tới `api/**`. */
export type { Member, OrgUnit };
import { relativeTime, unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Tổ chức + đơn xin tham gia. Tách khỏi `client.ts` vì file đó đã sát trần và cụm này có vòng
 * đời riêng: nó chạy TRƯỚC khi người dùng thuộc tổ chức nào, tức là trước khi có `X-Org-Slug`.
 */

/** Một dòng trong dropdown chọn tổ chức. */
export type OrgSuggestion = {
  slug: string;
  name: string;
  /** Đủ để phân biệt hai tổ chức trùng tên — thiếu nó thì dropdown là danh sách giống hệt nhau. */
  where: string;
  allowJoinRequests: boolean;
};

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export type MyJoinRequest = {
  id: string;
  organizationId: string;
  claimedName: string;
  claimedUnit: string | null;
  status: JoinRequestStatus;
  rejectReason: string | null;
  createdAt: string;
  expiresAt: string;
};

function whereOf(district: string | null, province: string | null): string {
  return [district, province].filter(Boolean).join(', ');
}

/** Đối xứng với `relativeTime` nhưng nhìn về phía trước: "còn 3 ngày" chứ không "3 ngày trước". */
function untilText(iso: string): string {
  const hours = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
  if (hours < 1) return 'dưới 1 giờ';
  if (hours < 48) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

/** Một tổ chức mà tôi là thành viên — nguồn của bộ chuyển tổ chức. */
export type MyOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
  unitId: string | null;
};

/**
 * Một đơn trên bàn duyệt. Khác `MyJoinRequest` ở hai chỗ mà BE cố tình tách schema: có
 * `userId` (người duyệt cần biết đơn của ai) và KHÔNG có `rejectReason` (lý do là thứ người
 * duyệt sắp viết, không phải thứ họ đọc).
 *
 * `sentAt`/`expiresIn` tính sẵn ở đây: cả hai chỉ là cách đọc của cùng hai mốc ISO, và tính
 * trong `renderItem` nghĩa là tính lại mỗi lần cuộn.
 */
export type JoinRequestRow = JoinRequest & {
  sentAt: string;
  /** `null` = đã quá hạn. Đơn quá hạn BE tự chuyển `expired`, nhưng danh sách có thể cũ hơn. */
  expiresIn: string | null;
};

export const orgApi = {
  /** Nhóm con của tổ chức đang hoạt động — để duyệt kèm xếp nhóm luôn, đúng ý §7.2a của BE. */
  async orgUnits(): Promise<OrgUnit[]> {
    const res = await withAuthRetry(() => listOrgUnits());
    return unwrap(res, 'Không đọc được danh sách nhóm con');
  },

  /**
   * Tạo nhóm con. `parentUnitId` bỏ trống = nhóm nằm thẳng dưới tổ chức.
   *
   * Không gửi `moderatorId: null` khi chưa chọn ai: BE phân biệt "không đụng tới" với "gỡ người
   * phụ trách", mà lúc TẠO thì chỉ có nghĩa thứ nhất là đúng.
   */
  async createUnit(input: CreateOrgUnit): Promise<OrgUnit> {
    const res = await withAuthRetry(() => createOrgUnit({ body: input }));
    return unwrap(res, 'Không tạo được nhóm con');
  },

  /**
   * Đổi tên nhóm hoặc gán/gỡ người phụ trách. Ở đây `null` mang nghĩa thật: gỡ người phụ trách —
   * nên màn hình phải gửi `null` tường minh chứ không phải bỏ trống field.
   */
  async updateUnit({ id, ...patch }: UpdateOrgUnit & { id: string }): Promise<OrgUnit> {
    const res = await withAuthRetry(() => updateOrgUnit({ path: { id }, body: patch }));
    return unwrap(res, 'Không cập nhật được nhóm con');
  },

  /** Xoá mềm. Thành viên đang thuộc nhóm không mất chỗ — họ về lại mức tổ chức. */
  async deleteUnit(id: string): Promise<OrgUnit> {
    const res = await withAuthRetry(() => deleteOrgUnit({ path: { id } }));
    return unwrap(res, 'Không xoá được nhóm con');
  },

  /**
   * Danh bạ thành viên của tổ chức đang hoạt động.
   *
   * `limit: 100` (trần của BE) chứ không phân trang: mọi call-site đều là dropdown "chọn một
   * người", mà dropdown thì cần cả tập để tìm — phân trang ở đó là ẩn mất người thứ 101 khỏi ô
   * tìm kiếm. Trường quá 100 thành viên thì đổi dropdown trước, đổi hàm này sau.
   */
  async members(): Promise<Member[]> {
    const res = await withAuthRetry(() => membershipList({ query: { limit: 100 } }));
    return unwrap(res, 'Không tải được danh bạ thành viên');
  },

  async joinRequests(status?: JoinRequestStatus): Promise<JoinRequestRow[]> {
    const res = await withAuthRetry(() => listJoinRequests({ query: status ? { status } : {} }));
    return unwrap(res, 'Không đọc được hàng đợi đơn').map((r) => ({
      ...r,
      sentAt: relativeTime(r.createdAt),
      expiresIn: new Date(r.expiresAt) > new Date() ? untilText(r.expiresAt) : null,
    }));
  },

  /** `unitId` bỏ trống = vào tổ chức phẳng, không thuộc nhóm con nào. */
  async approveRequest(id: string, unitId?: string | null): Promise<JoinRequest> {
    const res = await withAuthRetry(() =>
      approveJoinRequest({ path: { id }, body: { unitId: unitId ?? null } }),
    );
    return unwrap(res, 'Không duyệt được đơn');
  },

  async rejectRequest(id: string, reason?: string): Promise<JoinRequest> {
    const res = await withAuthRetry(() =>
      rejectJoinRequest({ path: { id }, body: { reason: reason || undefined } }),
    );
    return unwrap(res, 'Không từ chối được đơn');
  },

  /**
   * Duyệt hàng loạt. BE duyệt từng đơn một và trả về số thành công/thất bại thay vì hỏng cả
   * lô — mùa nhập học một đơn hết hạn không được phép chặn 199 đơn còn lại.
   */
  async bulkApprove(ids: string[], unitId?: string | null) {
    const res = await withAuthRetry(() =>
      bulkApproveJoinRequests({ body: { items: ids.map((id) => ({ id, unitId: unitId ?? null })) } }),
    );
    return unwrap(res, 'Không duyệt được lô đơn');
  },

  async myOrgs(): Promise<MyOrg[]> {
    const res = await withAuthRetry(() => myOrganizations());
    return unwrap(res, 'Không đọc được danh sách tổ chức của bạn');
  },

  /**
   * Tra cứu tổ chức cho dropdown. BE trần 10 dòng và chặn theo rate limit — đây là endpoint
   * công khai, gọi dày là biến nó thành công cụ dò danh sách khách hàng.
   */
  async lookup(q: string): Promise<OrgSuggestion[]> {
    const res = await organizationLookup({ query: { q } });
    const rows = unwrap(res, 'Không tra cứu được tổ chức');
    return rows.map((o) => ({
      slug: o.slug,
      name: o.name,
      where: whereOf(o.district, o.provinceCode),
      allowJoinRequests: o.allowJoinRequests,
    }));
  },

  async myRequests(): Promise<MyJoinRequest[]> {
    const res = await withAuthRetry(() => myJoinRequests());
    return unwrap(res, 'Không đọc được đơn của bạn');
  },

  /**
   * Gửi đơn. `orgSlug` là slug người dùng vừa XÁC NHẬN trên dropdown, không phải chuỗi họ gõ:
   * gõ gần đúng mà tự khớp là đơn chạy sang tổ chức khác mà không ai biết.
   */
  async requestJoin(input: {
    orgSlug: string;
    claimedName: string;
    claimedUnit?: string;
    note?: string;
  }): Promise<MyJoinRequest> {
    const res = await withAuthRetry(() =>
      createJoinRequest({
        body: {
          orgSlug: input.orgSlug,
          claimedName: input.claimedName,
          claimedUnit: input.claimedUnit || undefined,
          note: input.note || undefined,
        },
      }),
    );
    return unwrap(res, 'Gửi đơn không thành công');
  },

  async cancelRequest(id: string): Promise<MyJoinRequest> {
    const res = await withAuthRetry(() => cancelJoinRequest({ path: { id } }));
    return unwrap(res, 'Không rút được đơn');
  },
};
