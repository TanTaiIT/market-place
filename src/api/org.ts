import {
  approveJoinRequest,
  bulkApproveJoinRequests,
  cancelJoinRequest,
  createJoinRequest,
  listJoinRequests,
  membershipList,
  membershipRemove,
  myJoinRequests,
  myOrganizations,
  organizationByCode,
  organizationLookup,
  organizationPublicProfile,
  organizationUpdate,
  rejectJoinRequest,
} from './generated';
import type {
  JoinRequest,
  Member,
  OrganizationLookup,
  MyOrganization,
  OrganizationProfile,
  UpdateOrganization,
} from './generated';

/** Màn hình đi qua đây, không import thẳng `generated` — `app/**` chỉ biết tới `api/**`. */
export type { Member };
/** Phần hồ sơ nhóm mà quản trị sửa được — màn sửa dùng type này, không import `generated`. */
export type { UpdateOrganization as OrgPatch };
/** Một thẻ nhóm trong danh sách khám phá, và hồ sơ đầy đủ của một nhóm. */
export type OrgRow = OrganizationLookup;
export type OrgProfile = OrganizationProfile;
import { PAGE_SIZE, relativeTime, unwrap, unwrapPage } from './client';
import type { Page } from './client';
import { ORG_HEADER, withAuthRetry } from './http';

/**
 * Tổ chức + đơn xin tham gia. Tách khỏi `client.ts` vì file đó đã sát trần và cụm này có vòng
 * đời riêng: nó chạy TRƯỚC khi người dùng thuộc tổ chức nào, tức là trước khi có `X-Org-Id`.
 */

/**
 * Thẻ xem trước tổ chức, tra bằng mã tham gia.
 *
 * Thay cho `OrgSuggestion` của dropdown tra-theo-tên cũ: BE đã bỏ `orgId` khỏi đơn xin gia
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
/**
 * Một tổ chức mình thuộc về. ALIAS thẳng DTO của BE, không khai lại từng field.
 *
 * `orgApi.myOrgs` trả nguyên response (`unwrap` không map gì), nên một type viết tay ở đây chỉ
 * là bản sao — và bản sao thì THIẾU ÂM THẦM: nó bỏ sót `avatarUrl` suốt thời gian qua, nên dữ
 * liệu vẫn về tới máy mà TypeScript bảo không có, và không màn nào dùng được. Kết quả là nhóm
 * của chính mình hiện dải màu trơn trong khi nhóm người lạ ở danh sách bên cạnh có ảnh.
 *
 * Ghi chú giữ lại từ bản cũ, vì nó là thứ không đọc ra được từ type: org bị KHOÁ vẫn nằm trong
 * danh sách này (BE cố ý giữ, để phân biệt "khoá" với "không còn"). Đọc `status` trước khi
 * chọn — gửi slug của một org không ACTIVE là ăn 403 ở mọi request.
 */
export type MyOrg = MyOrganization;

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
  /** Một trang danh bạ của tổ chức đang hoạt động — màn Thành viên cuộn tới đâu tải tới đó. */
  async members(page: number): Promise<Page<Member>> {
    const res = await withAuthRetry(() => membershipList({ query: { page, limit: PAGE_SIZE } }));
    return unwrapPage(res, 'Không tải được danh bạ thành viên', (m) => m);
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

  async joinRequests(status: JoinRequestStatus | undefined, page: number): Promise<Page<JoinRequestRow>> {
    const res = await withAuthRetry(() =>
      listJoinRequests({ query: { ...(status ? { status } : {}), page, limit: PAGE_SIZE } }),
    );
    return unwrapPage(res, 'Không đọc được hàng đợi đơn', (r) => ({
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

  /** Hồ sơ nhóm công khai. Nhóm riêng tư trả 404 — không phân biệt được với id không có thật. */
  async profile(organizationId: string): Promise<OrgProfile> {
    const res = await organizationPublicProfile({ path: { organizationId } });
    return unwrap(res, 'Không tìm thấy nhóm này');
  },

  /**
   * Sửa hồ sơ nhóm — ảnh bìa, mô tả, nội quy.
   *
   * BE lấy nhóm từ header `X-Org-Id` chứ không từ đường dẫn (`PATCH /organizations/current`),
   * nên phải gắn id cho RIÊNG lượt gọi này: người đang sửa nhóm B không có nghĩa là họ muốn
   * chuyển org đang thao tác của cả app sang B. Cùng lập luận với `memberPreview` ngay dưới.
   *
   * `requireOrgAdmin` của BE đứng nguyên — không phải thành viên quản trị thì nhận 403, phần
   * ẩn nút trên giao diện chỉ là để đỡ mắt.
   *
   * Field không gửi = giữ nguyên. `rules: []` là XOÁ HẾT nội quy, khác hẳn với không gửi.
   */
  async update(organizationId: string, patch: UpdateOrganization): Promise<void> {
    const res = await withAuthRetry(() =>
      organizationUpdate({ body: patch, headers: { [ORG_HEADER]: organizationId } }),
    );
    unwrap(res, 'Không lưu được thông tin nhóm');
  },

  /**
   * Vài thành viên đầu của MỘT nhóm cụ thể — hàng avatar trên hồ sơ nhóm.
   *
   * Gắn `X-Org-Id` cho riêng lượt gọi này thay vì đổi org đang thao tác của cả app: người
   * dùng mở hồ sơ một nhóm khác không có nghĩa là họ muốn chuyển sang làm việc ở đó.
   *
   * `requireMembership` của BE vẫn đứng nguyên — gửi id của nhóm mình không thuộc về thì
   * nhận 403, nên chỉ gọi khi hồ sơ trả `joined: true`.
   */
  async memberPreview(organizationId: string, take: number): Promise<Member[]> {
    const res = await withAuthRetry(() =>
      membershipList({ query: { limit: take }, headers: { [ORG_HEADER]: organizationId } }),
    );
    return unwrap(res, 'Không đọc được danh bạ nhóm');
  },

  /**
   * Một trang danh bạ của MỘT nhóm theo id — ngăn chi tiết tổ chức của master. Cùng cách gắn
   * `X-Org-Id` riêng cho lượt gọi như `memberPreview`, nhưng phân trang thay vì lấy `take` dòng.
   */
  async memberPage(organizationId: string, page: number): Promise<Page<Member>> {
    const res = await withAuthRetry(() =>
      membershipList({
        query: { page, limit: PAGE_SIZE },
        headers: { [ORG_HEADER]: organizationId },
      }),
    );
    return unwrapPage(res, 'Không đọc được danh bạ nhóm', (m) => m);
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
   * Gửi đơn bằng MÃ THAM GIA, hoặc bằng `_id` khi đi từ hồ sơ nhóm công khai.
   *
   * BE đổi khoá tra sang `joinCode` vì slug là địa chỉ đoán được: ai đoán ra slug cũng gửi được
   * đơn, và hàng đợi duyệt trở thành bề mặt spam mở. Mã do tổ chức phát ra và xoay được
   * (`organizationRotateJoinCode`), nên phát nhầm thì thu lại được — slug thì không. Slug nay
   * đã bị gỡ hẳn khỏi tổ chức, nên vế còn lại là `orgId`.
   *
   * Muốn xem trước tên tổ chức trước khi gửi thì gọi `orgApi.byCode` — cùng mã, không cần đăng nhập.
   */
  /**
   * HAI KẾT CỤC, phân biệt bằng `status` của kết quả trả về:
   * - `approved` — nhóm CÔNG KHAI: đã là thành viên ngay lúc này, không có ai phải duyệt.
   * - `pending` — nhóm RIÊNG TƯ: phải chờ người có quyền duyệt trong nhóm xử lý.
   *
   * Call-site BẮT BUỘC đọc `status`: báo "đã gửi đơn" cho một người vừa vào nhóm xong là
   * bắt họ ngồi đợi một hàng đợi không tồn tại.
   */
  async requestJoin(input: {
    code?: string;
    /** `_id` của nhóm — đường vào từ hồ sơ nhóm công khai, nơi người dùng đã thấy tên nhóm rồi. */
    orgId?: string;
    claimedName: string;
    claimedUnit?: string;
    note?: string;
  }): Promise<MyJoinRequest> {
    const res = await withAuthRetry(() =>
      createJoinRequest({
        body: {
          // Đúng MỘT trong hai — BE `.refine()` từ chối nếu gửi cả hai hoặc không gửi gì.
          ...(input.code ? { code: input.code.trim() } : { orgId: input.orgId }),
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
