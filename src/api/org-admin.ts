import {
  changeOrganizationSlug,
  createOrganization,
  createRoleGrant,
  listOrganizations,
  organizationGrantAdmin,
  organizationSlugAvailability,
  revokeRoleGrant,
  setOrganizationStatus,
} from './generated';
import type { CreateRoleGrant, Organization, RoleGrant, SlugAvailability } from './generated';
import type { ProvinceName } from './location';

/** Cùng lý do với `OrgUnit` bên `org.ts`: màn hình đi qua `api/**`, không chạm `generated`. */
export type { Organization, RoleGrant };
import { isMaster } from './admin';
import { unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Quản trị bản thân TỔ CHỨC và ai được cầm quyền trong đó — khác hẳn `org.ts` vốn lo đường
 * NGƯỜI DÙNG đi vào tổ chức (tra cứu, đơn xin gia nhập, nhóm con).
 *
 * Một giới hạn của BE mà mọi màn dùng file này phải nói ra thay vì che đi: **không có route liệt
 * kê grant của người khác.** `/role-grants/mine` là nguồn `id` duy nhất, nên cấp quyền xong thì
 * chính người cấp cũng không thu hồi lại được từ trong app.
 */

export type OrgStatus = Organization['status'];

/** Bộ lọc của bảng tổ chức. Cả hai bỏ trống = liệt kê tất cả, đúng nghĩa một bảng quản trị. */
export type OrgListFilter = { q?: string; status?: OrgStatus };

/** Bộ lọc trạng thái của bảng tổ chức. `all` là mục của riêng UI, không phải giá trị BE. */
export const STATUS_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang mở' },
  { value: 'suspended', label: 'Đang khoá' },
  { value: 'pending_admin', label: 'Chờ người phụ trách' },
];

/** Trạng thái tổ chức, nhãn cho bảng quản trị — cùng lý do với `ROLE_LABEL`: màn không tự dịch. */
export const STATUS_LABEL: Record<OrgStatus, string> = {
  active: 'ĐANG MỞ',
  suspended: 'ĐANG KHOÁ',
  pending_admin: 'CHƯA CÓ NGƯỜI PHỤ TRÁCH',
};

export type OrgType = Organization['orgType'];

/** Loại tổ chức, đúng thứ tự BE khai — nhãn để màn hình khỏi tự chế bản dịch riêng. */
export const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: 'school', label: 'Trường học' },
  { value: 'company', label: 'Công ty' },
  { value: 'community', label: 'Cộng đồng' },
  { value: 'generic', label: 'Khác' },
];

/**
 * Thứ form tạo tổ chức gõ ra. Ô trống là chuỗi rỗng vì nó nối thẳng vào `TextInput`; biến chúng
 * thành "không gửi field" là việc của `create`, không phải của màn hình (HARD#2).
 */
export type NewOrgInput = {
  name: string;
  slug: string;
  orgType: OrgType;
  /** Người sẽ phụ trách tổ chức. BE gọi vai này là `admin` từ khi bỏ khái niệm chủ sở hữu. */
  adminEmail: string;
  /** Tên tỉnh, không phải mã — cùng nguồn `ProvinceName` với tin đăng, khỏi cast ở form. */
  provinceCode: ProvinceName | null;
  district: string;
};

export const ROLE_LABEL: Record<RoleGrant['role'], string> = {
  master: 'Master',
  manager: 'Quản lý',
  staff: 'Nhân sự',
};

export const SCOPE_LABEL: Record<RoleGrant['scopeType'], string> = {
  system: 'Toàn hệ thống',
  org: 'Cả tổ chức',
  org_unit: 'Một nhóm con',
  category_province: 'Danh mục × tỉnh',
  category_ward: 'Danh mục × phường',
};

/**
 * Thứ form cấp quyền gõ ra. Bốn field phạm vi đứng cạnh nhau nhưng chỉ một nhóm có nghĩa với
 * `scopeType` đang chọn — `grantRole` là nơi cắt bớt, form chỉ việc giữ cả bốn.
 *
 * Người nhận: `userId` khi chọn được từ danh bạ, `userEmail` khi không có danh bạ nào để chọn
 * (manager trục danh mục không thuộc tổ chức nào). BE nhận ĐÚNG một trong hai —
 * `createRoleGrantSchema` refine, gửi cả hai là 400.
 */
export type NewGrantInput = {
  userId: string | null;
  userEmail: string | null;
  role: RoleGrant['role'];
  scopeType: RoleGrant['scopeType'];
  orgId: string | null;
  unitId: string | null;
  categoryId: string | null;
  provinceCodes: string[];
  /** Chỉ có nghĩa với `category_ward`; đi kèm ĐÚNG một tỉnh ở `provinceCodes`. */
  wardCodes: string[];
};

/**
 * Vai trò một người cấp được cho người khác, khớp `canGrant` của BE: master cấp `manager` và
 * `staff`, manager chỉ cấp `staff` TRONG scope của chính mình, staff không cấp được cho ai.
 *
 * `master` không nằm trong danh sách của bất kỳ ai: `canGrant` chặn ngay dòng đầu
 * (`role === MASTER` → false) vì hệ thống có đúng một master do migration dựng. Mời người ta
 * bấm vào nó là hứa suông một cú 403.
 *
 * Nhận grants chứ không nhận cờ `master` — cùng lý do với `scopesForRole` ngay dưới.
 */
export const rolesGrantableBy = (grants: RoleGrant[] | undefined): RoleGrant['role'][] => {
  if (isMaster(grants)) return ['manager', 'staff'];
  return (grants ?? []).some((g) => g.role === 'manager') ? ['staff'] : [];
};

/**
 * Phạm vi hợp lệ của một vai trò = giao của HAI ràng buộc BE:
 * 1. `ROLE_SCOPES` (`role-grant.model.ts`): master chỉ `system`, manager KHÔNG đi với
 *    `org_unit`, staff đi được cả ba.
 * 2. `covers()` (`policy.ts`): người cấp không phải master chỉ cấp được TRONG scope của mình —
 *    grant `org` phủ `org`/`org_unit` của org đó, grant `category_province` phủ đúng
 *    `category_province` cùng danh mục.
 *
 * Vế 2 là lý do hàm nhận grants: bản cũ đưa manager trục danh mục đúng hai phạm vi BE chắc
 * chắn từ chối (`org`, `org_unit`) rồi ẩn mất phạm vi duy nhất họ cấp được, nên màn Phân quyền
 * với họ không có đường nào đi tới thành công.
 */
export function scopesForRole(
  role: RoleGrant['role'],
  grants: RoleGrant[] | undefined,
): RoleGrant['scopeType'][] {
  if (role === 'master') return ['system'];
  const byRole: RoleGrant['scopeType'][] =
    role === 'manager'
      ? ['org', 'category_province', 'category_ward']
      : ['org', 'org_unit', 'category_province', 'category_ward'];
  if (isMaster(grants)) return byRole;

  const mine = (grants ?? []).filter((g) => g.role === 'manager');
  return byRole.filter((scope) =>
    mine.some((g) => {
      // Tầng tỉnh phủ cả tầng phường: đó chính là cách người phụ trách tỉnh chia tải xuống từng
      // phường trong tỉnh mình (§5.3 ở tầng dưới).
      if (g.scopeType === 'category_province') {
        return scope === 'category_province' || scope === 'category_ward';
      }
      if (g.scopeType === 'category_ward') return scope === 'category_ward';
      return g.scopeType === 'org' && (scope === 'org' || scope === 'org_unit');
    }),
  );
}

/** Vì sao slug không dùng được — BE trả mã, người đọc cần câu chữ. */
const SLUG_REASON: Record<NonNullable<SlugAvailability['reason']>, string> = {
  invalid: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang',
  reserved: 'Slug này hệ thống giữ riêng',
  taken: 'Đã có tổ chức dùng slug này',
};

export function slugReasonText(result: SlugAvailability): string {
  if (result.available) return 'Slug dùng được';
  return result.reason ? SLUG_REASON[result.reason] : 'Slug này không dùng được';
}

/**
 * Chỉ giữ field thuộc về scope đang chọn. `createRoleGrant` nhận cả bốn, nhưng đính `unitId`
 * vào một grant phạm vi `org` là ghi sai phạm vi ngay trong chính bản ghi quyền — và bản ghi đó
 * mới là thứ BE đọc để quyết định người ta duyệt được gì.
 */
function scopeOf(input: NewGrantInput): Partial<CreateRoleGrant> {
  if (input.scopeType === 'org') return { orgId: input.orgId ?? undefined };
  if (input.scopeType === 'org_unit') return { unitId: input.unitId ?? undefined };
  if (input.scopeType === 'category_ward') {
    return {
      categoryId: input.categoryId ?? undefined,
      // BE đòi ĐÚNG một tỉnh cho phạm vi này: cặp (tỉnh, phường) mới định danh được ô, vì tên
      // phường lặp giữa các tỉnh. Cắt ở đây để form không gửi đi một grant chắc chắn bị từ chối.
      provinceCodes: input.provinceCodes.slice(0, 1),
      wardCodes: input.wardCodes,
    };
  }
  if (input.scopeType === 'category_province') {
    return { categoryId: input.categoryId ?? undefined, provinceCodes: input.provinceCodes };
  }
  return {};
}

export const orgAdminApi = {
  /**
   * Mọi tổ chức trong hệ thống — nguồn `id` + `slug` duy nhất cho master.
   *
   * Thay chỗ `/organizations/mine` ở bàn quản trị: master cố ý KHÔNG là thành viên của org nào
   * (quyền của họ là grant `master/system`), nên `mine` luôn rỗng và bàn quản trị trước đây chỉ
   * thao tác được với org mà chính master tình cờ tham gia. Khác `/organizations/lookup` ở chỗ
   * route đó công khai nên cố tình giấu `id`.
   *
   * Trả cả org đang `suspended`/`pending_admin` — đó chính là phần việc của master.
   *
   * `limit: 100` (trần của BE) và BỎ `meta`: quá 100 tổ chức thì bảng cắt im lặng, nên ô tìm +
   * bộ lọc trạng thái là đường thu hẹp chính. Vượt mốc đó thì phân trang thật trước, sửa hàm sau.
   */
  async listAll(filter: OrgListFilter = {}): Promise<Organization[]> {
    const res = await withAuthRetry(() =>
      listOrganizations({ query: { q: filter.q || undefined, status: filter.status, limit: 100 } }),
    );
    return unwrap(res, 'Không đọc được danh sách tổ chức');
  },

  /**
   * Tạo tổ chức rồi trao quyền phụ trách — HAI lượt gọi BE, gộp lại sau một lần bấm.
   *
   * BE tách đôi vì tổ chức vừa tạo nằm ở `pending_admin` và cố tình chưa tồn tại với phần còn
   * lại của hệ thống (`findActiveById` chỉ thấy `active`). Lượt trao quyền đầu tiên mới đẩy nó
   * sang `active`. Người được trao phải CÓ TÀI KHOẢN từ trước — BE tra theo email và trả 404
   * nếu không thấy, nên đây không phải đường mời người mới vào hệ thống.
   */
  async create(input: NewOrgInput): Promise<Organization> {
    // Bỏ hẳn field rỗng thay vì gửi chuỗi rỗng: `slug: ''` bị BE đọc là một slug và trả 409
    // "không hợp lệ", trong khi VẮNG MẶT mới đúng nghĩa "để BE tự sinh slug từ tên".
    const created = await withAuthRetry(() =>
      createOrganization({
        body: {
          name: input.name.trim(),
          orgType: input.orgType,
          ...(input.slug.trim() ? { slug: input.slug.trim() } : {}),
          ...(input.provinceCode ? { provinceCode: input.provinceCode } : {}),
          ...(input.district.trim() ? { district: input.district.trim() } : {}),
        },
      }),
    );
    const org = unwrap(created, 'Không tạo được tổ chức');

    /*
     * Bước hai hỏng thì tổ chức đã nằm trong DB ở `pending_admin`. Nói rõ điều đó trong lỗi:
     * người dùng thấy "không tạo được" sẽ bấm lại và ăn 409 trùng slug, không hiểu vì sao —
     * trong khi việc cần làm là trao quyền cho tổ chức vừa hiện ra trong danh sách.
     */
    const granted = await withAuthRetry(() =>
      organizationGrantAdmin({
        path: { organizationId: org.id },
        body: { email: input.adminEmail.trim() },
      }),
    );
    unwrap(
      granted,
      `Đã tạo "${org.name}" nhưng chưa trao được quyền phụ trách — tổ chức đang chờ, trao lại từ danh sách`,
    );

    return org;
  },

  /** Khoá/mở có hiệu lực NGAY: BE đối chiếu `memberships` mỗi request, không đợi token hết hạn. */
  async setStatus(id: string, status: 'active' | 'suspended'): Promise<Organization> {
    const res = await withAuthRetry(() =>
      setOrganizationStatus({ path: { organizationId: id }, body: { status } }),
    );
    return unwrap(res, 'Không đổi được trạng thái tổ chức');
  },

  /** Slug cũ tự thành alias redirect 301, nên đường link đã phát ra ngoài không chết. */
  async changeSlug(id: string, slug: string): Promise<Organization> {
    const res = await withAuthRetry(() =>
      changeOrganizationSlug({ path: { organizationId: id }, body: { slug } }),
    );
    return unwrap(res, 'Không đổi được slug');
  },

  /**
   * Kiểm tra slug. Endpoint công khai và có rate limit, nên `organizationSlugAvailability` gọi
   * trần (không `withAuthRetry`) như `organizationByCode` — cùng nhóm, cùng lý do.
   */
  async checkSlug(slug: string): Promise<SlugAvailability> {
    const res = await organizationSlugAvailability({ query: { slug } });
    return unwrap(res, 'Không kiểm tra được slug');
  },

  /**
   * Cấp quyền. Không ai tự cấp cho chính mình — BE chặn, app không cần dựng lại chốt đó, chỉ
   * cần để thông điệp 403 đi thẳng ra toast.
   */
  async grantRole(input: NewGrantInput): Promise<RoleGrant> {
    const res = await withAuthRetry(() =>
      createRoleGrant({
        body: {
          // `?? undefined` chứ không `null`: `.strict()` của BE nhận field VẮNG MẶT, không nhận null.
          userId: input.userId ?? undefined,
          userEmail: input.userEmail ?? undefined,
          role: input.role,
          scopeType: input.scopeType,
          ...scopeOf(input),
        },
      }),
    );
    return unwrap(res, 'Không cấp được quyền');
  },

  /** BE chặn thu hồi master CUỐI CÙNG — hệ thống không còn master là không ai cấp lại được nữa. */
  async revokeGrant(id: string) {
    const res = await withAuthRetry(() => revokeRoleGrant({ path: { id } }));
    unwrap(res, 'Không thu hồi được quyền');
    return { id };
  },
};
