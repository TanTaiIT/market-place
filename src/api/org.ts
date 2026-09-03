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
  membershipMove,
  membershipRemove,
  myJoinRequests,
  myOrganizations,
  organizationByCode,
  organizationLookup,
  organizationPublicProfile,
  organizationUpdate,
  rejectJoinRequest,
  updateOrgUnit,
} from './generated';
import type {
  CreateOrgUnit,
  JoinRequest,
  Member,
  OrganizationLookup,
  OrganizationProfile,
  OrgUnit,
  UpdateOrganization,
  UpdateOrgUnit,
} from './generated';

/** Màn hình dùng nhóm con đi qua đây, không import thẳng `generated` — `app/**` chỉ biết tới `api/**`. */
export type { Member, OrgUnit };
/** Phần hồ sơ nhóm mà quản trị sửa được — màn sửa dùng type này, không import `generated`. */
export type { UpdateOrganization as OrgPatch };
/** Một thẻ nhóm trong danh sách khám phá, và hồ sơ đầy đủ của một nhóm. */
export type OrgRow = OrganizationLookup;
export type OrgProfile = OrganizationProfile;
import { relativeTime, unwrap } from './client';
import { ORG_HEADER, withAuthRetry } from './http';

/**
 * Tổ chức + đơn xin tham gia. Tách khỏi `client.ts` vì file đó đã sát trần và cụm này có vòng
 * đời riêng: nó chạy TRƯỚC khi người dùng thuộc tổ chức nào, tức là trước khi có `X-Org-Slug`.
 */

/**
 * Thẻ xem trước tổ chức, tra bằng mã tham gia.
 *
 * Thay cho `OrgSuggestion` của dropdown tra-theo-tên cũ: BE đã bỏ `orgSlug` khỏi đơn xin gia
 * nhập, nên tra theo tên không còn đường dẫn tới việc gửi đơn nữa.
 */
export type OrgCard = {
  name: string;
  /** Đủ để phân biệt hai tổ chức trùng tên — thiếu nó thì người dán mã không chắc mình vào đâu. */
  where: string;
  memberCount: number;
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
  /** Bảng tin của nhóm này bày một cột hay hai — do quản trị nhóm đặt. */
  feedLayout: 'feed' | 'grid';
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

  /**
   * Gỡ một người khỏi tổ chức đang thao tác.
   *
   * BE lưu trữ chứ không xoá bản ghi — danh bạ cũ là dữ liệu của tổ chức. Hai chốt bên đó:
   * không tự gỡ mình (400), và không gỡ người cũng đang giữ quyền quản trị (403, cần master).
   */
  async removeMember(userId: string): Promise<void> {
    const res = await withAuthRetry(() => membershipRemove({ path: { userId } }));
    unwrap(res, 'Không gỡ được thành viên');
  },

  /** `unitId: null` = bỏ khỏi mọi nhóm con. KHÔNG đụng tới quyền — xem `membershipMove`. */
  async moveMember(userId: string, unitId: string | null): Promise<Member> {
    const res = await withAuthRetry(() =>
      membershipMove({ path: { userId }, body: { unitId } }),
    );
    return unwrap(res, 'Không chuyển được nhóm con');
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

  /**
   * Tìm nhóm CÔNG KHAI theo tên, hoặc lấy gợi ý khi bỏ trống từ khoá.
   *
   * Gọi trần, không `withAuthRetry`: route công khai, người chưa đăng nhập vẫn tìm được.
   * Nhóm riêng tư không bao giờ nằm trong kết quả — BE lọc, client không phải biết.
   */
  async discover(keyword: string): Promise<OrgRow[]> {
    const q = keyword.trim();
    const res = await organizationLookup({ query: q ? { q } : {} });
    return unwrap(res, 'Không tìm được nhóm nào');
  },

  /** Hồ sơ nhóm công khai. Nhóm riêng tư trả 404 — không phân biệt được với slug không có thật. */
  async profile(slug: string): Promise<OrgProfile> {
    const res = await organizationPublicProfile({ path: { slug } });
    return unwrap(res, 'Không tìm thấy nhóm này');
  },

  /**
   * Sửa hồ sơ nhóm — ảnh bìa, mô tả, nội quy.
   *
   * BE lấy nhóm từ header `X-Org-Slug` chứ không từ đường dẫn (`PATCH /organizations/current`),
   * nên phải gắn slug cho RIÊNG lượt gọi này: người đang sửa nhóm B không có nghĩa là họ muốn
   * chuyển org đang thao tác của cả app sang B. Cùng lập luận với `memberPreview` ngay dưới.
   *
   * `requireOrgAdmin` của BE đứng nguyên — không phải thành viên quản trị thì nhận 403, phần
   * ẩn nút trên giao diện chỉ là để đỡ mắt.
   *
   * Field không gửi = giữ nguyên. `rules: []` là XOÁ HẾT nội quy, khác hẳn với không gửi.
   */
  async update(slug: string, patch: UpdateOrganization): Promise<void> {
    const res = await withAuthRetry(() =>
      organizationUpdate({ body: patch, headers: { [ORG_HEADER]: slug } }),
    );
    unwrap(res, 'Không lưu được thông tin nhóm');
  },

  /**
   * Vài thành viên đầu của MỘT nhóm cụ thể — hàng avatar trên hồ sơ nhóm.
   *
   * Gắn `X-Org-Slug` cho riêng lượt gọi này thay vì đổi org đang thao tác của cả app: người
   * dùng mở hồ sơ một nhóm khác không có nghĩa là họ muốn chuyển sang làm việc ở đó.
   *
   * `requireMembership` của BE vẫn đứng nguyên — gửi slug của nhóm mình không thuộc về thì
   * nhận 403, nên chỉ gọi khi hồ sơ trả `joined: true`.
   */
  async memberPreview(slug: string, take: number): Promise<Member[]> {
    const res = await withAuthRetry(() =>
      membershipList({ query: { limit: take }, headers: { [ORG_HEADER]: slug } }),
    );
    return unwrap(res, 'Không đọc được danh bạ nhóm');
  },

  async myOrgs(): Promise<MyOrg[]> {
    const res = await withAuthRetry(() => myOrganizations());
    return unwrap(res, 'Không đọc được danh sách tổ chức của bạn');
  },

  /**
   * Xem trước tổ chức đứng sau một MÃ THAM GIA, trước khi gửi đơn.
   *
   * Không cần đăng nhập và cố tình không trả `id`/`slug`: mã là thứ người ta dán cho nhau, nên
   * endpoint này phải cho xem đủ để nhận ra đúng nơi mình định vào (tên, địa bàn, số thành
   * viên) mà không biến thành đường tra ngược ra định danh tổ chức.
   */
  async byCode(code: string): Promise<OrgCard> {
    const res = await organizationByCode({ path: { code: code.trim() } });
    const org = unwrap(res, 'Không tìm thấy tổ chức nào với mã này');
    return {
      name: org.name,
      where: whereOf(org.district, org.provinceCode),
      memberCount: org.memberCount,
      allowJoinRequests: org.allowJoinRequests,
    };
  },

  async myRequests(): Promise<MyJoinRequest[]> {
    const res = await withAuthRetry(() => myJoinRequests());
    return unwrap(res, 'Không đọc được đơn của bạn');
  },

  /**
   * Gửi đơn bằng MÃ THAM GIA, không còn bằng slug.
   *
   * BE đổi khoá tra sang `joinCode` vì slug là địa chỉ công khai: ai đoán ra slug cũng gửi được
   * đơn, và hàng đợi duyệt trở thành bề mặt spam mở. Mã do tổ chức phát ra và xoay được
   * (`organizationRotateJoinCode`), nên phát nhầm thì thu lại được — slug thì không.
   *
   * Muốn xem trước tên tổ chức trước khi gửi thì gọi `orgApi.byCode` — cùng mã, không cần đăng nhập.
   */
  async requestJoin(input: {
    code?: string;
    slug?: string;
    claimedName: string;
    claimedUnit?: string;
    note?: string;
  }): Promise<MyJoinRequest> {
    const res = await withAuthRetry(() =>
      createJoinRequest({
        body: {
          // Đúng MỘT trong hai — BE `.refine()` từ chối nếu gửi cả hai hoặc không gửi gì.
          ...(input.code ? { code: input.code.trim() } : { slug: input.slug }),
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
