import {
  changeOrganizationSlug,
  createOrganization,
  createRoleGrant,
  organizationSlugAvailability,
  revokeRoleGrant,
  setOrganizationStatus,
} from './generated';
import type { CreateRoleGrant, Organization, RoleGrant, SlugAvailability } from './generated';
import type { ProvinceName } from './location';

/** Cùng lý do với `OrgUnit` bên `org.ts`: màn hình đi qua `api/**`, không chạm `generated`. */
export type { RoleGrant };
import { unwrap } from './client';
import { withAuthRetry } from './http';

/**
 * Quản trị bản thân TỔ CHỨC và ai được cầm quyền trong đó — khác hẳn `org.ts` vốn lo đường
 * NGƯỜI DÙNG đi vào tổ chức (tra cứu, đơn xin gia nhập, nhóm con).
 *
 * Hai giới hạn của BE mà mọi màn dùng file này phải nói ra thay vì che đi:
 *
 * 1. **Không có route liệt kê mọi tổ chức.** Chỉ `/organizations/mine` trả về `id`, mà
 *    `/organizations/lookup` (công khai) thì cố tình không trả — nó sẽ thành công cụ liệt kê
 *    khách hàng. Vậy nên khoá/đổi slug chỉ làm được với tổ chức mình đang là thành viên.
 * 2. **Không có route liệt kê grant của người khác.** `/role-grants/mine` là nguồn `id` duy
 *    nhất, nên cấp quyền xong thì chính người cấp cũng không thu hồi lại được từ trong app.
 */

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
  ownerEmail: string;
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
};

/**
 * Thứ form cấp quyền gõ ra. Bốn field phạm vi đứng cạnh nhau nhưng chỉ một nhóm có nghĩa với
 * `scopeType` đang chọn — `grantRole` là nơi cắt bớt, form chỉ việc giữ cả bốn.
 */
export type NewGrantInput = {
  userId: string;
  role: RoleGrant['role'];
  scopeType: RoleGrant['scopeType'];
  orgId: string | null;
  unitId: string | null;
  categoryId: string | null;
  provinceCodes: string[];
};

/**
 * Vai trò một người cấp được cho người khác, khớp mô tả của `POST /role-grants`: master cấp
 * `manager` và `staff`, manager chỉ cấp được `staff` trong đúng scope của mình.
 *
 * Cắt ở UI để không mời người ta bấm vào thứ chắc chắn ăn 403 — BE vẫn là nơi chốt thật.
 */
export const rolesGrantableBy = (master: boolean): RoleGrant['role'][] =>
  master ? ['master', 'manager', 'staff'] : ['staff'];

/**
 * Phạm vi hợp lệ của một vai trò. `master` là quyền toàn hệ thống nên không có phạm vi nào
 * khác, còn trục (danh mục × tỉnh) chỉ master mới cấp được — nó quyết định ai duyệt tin công khai.
 */
export function scopesForRole(role: RoleGrant['role'], master: boolean): RoleGrant['scopeType'][] {
  if (role === 'master') return ['system'];
  const base: RoleGrant['scopeType'][] = ['org', 'org_unit'];
  return master && role === 'manager' ? [...base, 'category_province'] : base;
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
  if (input.scopeType === 'category_province') {
    return { categoryId: input.categoryId ?? undefined, provinceCodes: input.provinceCodes };
  }
  return {};
}

export const orgAdminApi = {
  /**
   * Tạo tổ chức + chỉ định người chủ. Người chủ phải CÓ TÀI KHOẢN từ trước — BE tra theo email
   * và trả 404 nếu không thấy, nên đây không phải đường mời người mới vào hệ thống.
   *
   * Người tạo (master) KHÔNG tự thành thành viên, nên tổ chức vừa tạo sẽ không xuất hiện trong
   * `/organizations/mine` — màn hình phải nói trước điều đó thay vì để danh sách trông như hỏng.
   */
  async create(input: NewOrgInput): Promise<Organization> {
    // Bỏ hẳn field rỗng thay vì gửi chuỗi rỗng: `slug: ''` bị BE đọc là một slug và trả 409
    // "không hợp lệ", trong khi VẮNG MẶT mới đúng nghĩa "để BE tự sinh slug từ tên".
    const res = await withAuthRetry(() =>
      createOrganization({
        body: {
          name: input.name.trim(),
          ownerEmail: input.ownerEmail.trim(),
          orgType: input.orgType,
          ...(input.slug.trim() ? { slug: input.slug.trim() } : {}),
          ...(input.provinceCode ? { provinceCode: input.provinceCode } : {}),
          ...(input.district.trim() ? { district: input.district.trim() } : {}),
        },
      }),
    );
    return unwrap(res, 'Không tạo được tổ chức');
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
   * trần (không `withAuthRetry`) như `organizationLookup` — cùng nhóm, cùng lý do.
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
        body: { userId: input.userId, role: input.role, scopeType: input.scopeType, ...scopeOf(input) },
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
