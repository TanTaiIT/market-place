import {
  changeOrganizationSlug,
  createOrganization,
  createRoleGrant,
  listOrganizations,
  organizationManagers,
  organizationGrantAdmin,
  organizationSlugAvailability,
  revokeRoleGrant,
  setOrganizationStatus,
} from './generated';
/*
 * `setOrganizationVisibility` lấy thẳng từ `sdk.gen` chứ không qua barrel: hey-api 0.97.3 sinh
 * hàm + 5 type cho nó trong `sdk.gen.ts`/`types.gen.ts` nhưng BỎ nó khỏi danh sách re-export của
 * `index.ts`. Dựng lại từ spec đầy đủ vẫn thiếu, nên đây là quirk của generator, không phải spec
 * cũ — và file generated thì không sửa tay được (api:sync ghi đè). Mọi endpoint khác vẫn qua barrel.
 */
import { setOrganizationVisibility } from './generated/sdk.gen';
import type {
  CreateRoleGrant,
  OrgManager,
  Organization,
  RoleGrant,
  SlugAvailability,
} from './generated';
import type { ProvinceName } from './location';

/** Cùng lý do với `OrgUnit` bên `org.ts`: màn hình đi qua `api/**`, không chạm `generated`. */
export type { Organization, OrgManager, RoleGrant };
import { PAGE_SIZE, unwrap, unwrapPage } from './client';
import type { Page } from './client';
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
 * Thứ form cấp quyền gõ ra. Các field phạm vi đứng cạnh nhau nhưng chỉ một nhóm có nghĩa với
 * `scopeType` đang chọn — `grantRole` là nơi cắt bớt, form chỉ việc giữ cả bộ.
 *
 * `role`/`scopeType` lấy kiểu từ HỢP ĐỒNG TẠO (`CreateRoleGrant`), không từ DTO trả về: BE không
 * còn nhận `staff`/`org_unit` khi cấp mới, nhưng grant cũ mang hai giá trị đó vẫn đọc được.
 *
 * Người nhận: `userId` hoặc `userEmail` — BE nhận ĐÚNG một trong hai (`createRoleGrantSchema`
 * refine, gửi cả hai là 400).
 */
export type NewGrantInput = {
  userId: string | null;
  userEmail: string | null;
  role: CreateRoleGrant['role'];
  scopeType: CreateRoleGrant['scopeType'];
  orgId: string | null;
  categoryId: string | null;
  provinceCodes: string[];
  /** Chỉ có nghĩa với `category_ward`; đi kèm ĐÚNG một tỉnh ở `provinceCodes`. */
  wardCodes: string[];
};

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
   * Phân trang thật: một trang 10 tổ chức, cuộn tới đâu tải tới đó — bản trước xin 100 và bỏ
   * `meta`, quá 100 tổ chức là bảng cắt im lặng.
   */
  /**
   * Ai đang phụ trách MỘT tổ chức — đọc từ `role_grants`, không phải từ danh bạ.
   *
   * `Membership.role === 'admin'` nhìn giống câu trả lời nhưng không phải: nó là THÂN PHẬN
   * hiển thị trong nhóm, còn quyền thật nằm ở grant. `grantAdmin` bên BE ghi cả hai cùng lúc
   * nên chúng thường trùng — nhưng thu hồi grant KHÔNG đụng tới danh bạ, nên đúng lúc một
   * nhóm không còn ai quản thì danh bạ vẫn ghi 'admin'. Mảng rỗng ở đây là câu trả lời thật,
   * và nó khớp với con số `withoutManager` ở bàn tổng quan hệ thống.
   */
  async managers(orgId: string): Promise<OrgManager[]> {
    const res = await withAuthRetry(() => organizationManagers({ path: { organizationId: orgId } }));
    return unwrap(res, 'Không đọc được danh sách người phụ trách');
  },

  async listAll(filter: OrgListFilter, page: number): Promise<Page<Organization>> {
    const res = await withAuthRetry(() =>
      listOrganizations({
        query: { q: filter.q || undefined, status: filter.status, page, limit: PAGE_SIZE },
      }),
    );
    return unwrapPage(res, 'Không đọc được danh sách tổ chức', (o) => o);
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

  /**
   * Công khai ↔ riêng tư.
   *
   * Riêng tư có hiệu lực NGAY và có hậu quả thật: nhóm rơi khỏi tìm kiếm, hồ sơ trả 404 với
   * người ngoài, và chỉ còn xin vào được bằng MÃ. Mọi link đã phát ra ngoài chết theo.
   */
  async setVisibility(id: string, isPublic: boolean): Promise<Organization> {
    const res = await withAuthRetry(() =>
      setOrganizationVisibility({ path: { organizationId: id }, body: { isPublic } }),
    );
    return unwrap(res, 'Không đổi được chế độ hiển thị');
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
