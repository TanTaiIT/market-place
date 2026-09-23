import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgAdminApi } from '@/api/org-admin';
import { orgApi } from '@/api/org';
import type { OrgListFilter } from '@/api/org-admin';
import { qk } from './keys';
import { usePagedList } from './paged';

/**
 * Quản trị tổ chức + phân quyền. Domain riêng (query.convention §8): `org.ts` lo đường người
 * dùng ĐI VÀO tổ chức, còn đây là bàn của người đã ở trong và đang cầm quyền.
 */

/**
 * Bảng tổ chức toàn hệ thống (chỉ master).
 *
 * KHÔNG gate bằng grant (giống `useAdminCategories`/`useCoverage`): call-site duy nhất là màn
 * master-only. Gate rồi thì người không đủ quyền deep-link vào sẽ thấy query đứng im mãi ở
 * `pending` thay vì đọc được "cần quyền master" — biến một câu 403 rõ ràng thành màn treo.
 *
 * Ô tìm debounce 300ms: mỗi prefix là một `queryKey` mới nên gõ thẳng sẽ bắn một request cho
 * từng chữ cái. 300ms, cùng con số với ô tìm kiếm (`app/search.tsx`).
 *
 * `keepPreviousData`: đổi bộ lọc mà để danh sách chớp về rỗng thì bảng nhảy chiều cao giữa
 * lúc người dùng đang gõ.
 */
/**
 * @param enabled Tắt khi người xem KHÔNG phải master — `GET /organizations` là route
 *   master-only, để nó tự chạy là một lượt 403 mỗi lần màn mount.
 */
export function useAllOrgs(filter: OrgListFilter = {}, enabled = true) {
  const term = (filter.q ?? '').trim();
  const [settled, setSettled] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const status = filter.status;

  return usePagedList(
    qk.allOrgs(settled, status ?? 'all'),
    (page) => orgAdminApi.listAll({ q: settled, status }, page),
    { enabled, keepPrevious: true, staleTime: 60_000 },
  );
}

/**
 * Hai lượt gọi của ngăn chi tiết tổ chức trong bảng của master.
 *
 * `enabled` theo `orgId` chứ không có cờ riêng: ngăn đóng thì call-site truyền chuỗi
 * rỗng, nên không lượt nào bay đi lúc chưa ai mở ngăn. Hai query tách nhau để phần danh bạ
 * (phân trang, cuộn tới đâu tải tới đó) không giữ phần 'ai phụ trách' lại — đó là thứ người ta
 * mở ngăn để xem.
 */
export function useOrgManagers(orgId: string) {
  return useQuery({
    queryKey: qk.orgManagers(orgId),
    queryFn: () => orgAdminApi.managers(orgId),
    enabled: orgId.length > 0,
    staleTime: 60_000,
  });
}

/**
 * Danh bạ của MỘT org theo id — hook DUY NHẤT cho việc này.
 *
 * Gộp từ `useOrgRoster` (đã xoá), thứ đọc org toàn cục và vì thế muốn xem nhóm khác thì phải
 * chuyển chỗ đứng của cả app. `memberPage` gắn `X-Org-Id` cho riêng lượt gọi, nên xem nhóm nào
 * cũng không đổi chỗ đứng. Hai hook vốn đã dùng CHUNG key `orgMembers(orgId)` — giữ hai bản
 * chỉ là hai đường code nói cùng một chuyện, và một trong hai sẽ lệch.
 *
 * `gate` mang theo từ `useOrgRoster`, và nó KHÔNG phải tuỳ chọn cho vui: màn `/admin/members`
 * gọi hook này cho staff nhóm con, mà endpoint đòi quyền quản trị — thiếu cổng là một cú 403
 * mỗi lần mở màn. Mặc định `true` cho những chỗ đã tự chặn ở trên (ngăn chi tiết của master).
 *
 * BE cho master đọc: route gác `requireMembershipOrOrgModerator`, và comment ở đó nói rõ
 * người quản org mà không phải thành viên cũng phải đọc được — họ xoá được thành viên thì
 * chặn họ xem danh sách chỉ tạo ra một bàn quản trị thao tác được mà không nhìn được.
 */
export function useOrgMemberList(orgId: string, gate = true) {
  const query = usePagedList(qk.orgMembers(orgId), (page) => orgApi.memberPage(orgId, page), {
    enabled: orgId.length > 0 && gate,
    staleTime: 60_000,
    keyOf: (m) => m.userId,
  });
  return { ...query, members: query.data ?? [] };
}

/**
 * Tạo tổ chức. Quét `allOrgsRoot()` chứ không `myOrgs()`: master KHÔNG tự thành thành viên, nên
 * tổ chức vừa tạo không bao giờ xuất hiện ở `/organizations/mine` — nó chỉ hiện ở bảng toàn hệ
 * thống, và đó mới là danh sách người bấm nút đang nhìn.
 */
export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgAdminApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.allOrgsRoot() }),
  });
}

export function useSetOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: 'active' | 'suspended' }) =>
      orgAdminApi.setStatus(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.allOrgsRoot() }),
  });
}

/**
 * Công khai ↔ riêng tư.
 *
 * Refetch contract: quét `allOrgsRoot()` như `useSetOrganizationStatus` — bảng tổ chức là
 * chỗ duy nhất hiện cờ này. KHÔNG quét `adminRoot()`: đổi khả năng khám phá không đụng tới
 * một dòng số liệu nào của bàn duyệt.
 */
export function useSetOrgVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; isPublic: boolean }) =>
      orgAdminApi.setVisibility(v.id, v.isPublic),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.allOrgsRoot() }),
  });
}

/**
 * Refetch contract của cấp/thu hồi quyền: `myGrants()` là thứ quyết định người dùng mở được
 * những mục nào trong `AdminNav`, nên tự thu hồi quyền của mình phải đổi menu ngay lập tức.
 *
 * Cấp/thu hồi cho NGƯỜI KHÁC giờ CÓ thứ để làm mới: bảng `adminCategoryAxis` và ma trận phủ
 * sóng đều đọc cùng tập grant đó. Quét cả `adminRoot()` thay vì liệt kê hai key — gỡ một
 * người phụ trách làm đổi luôn con số "ô chưa có ai" ở tổng quan.
 */
function useGrantMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.myGrants() });
      void qc.invalidateQueries({ queryKey: qk.adminRoot() });
    },
  });
}

/**
 * Ai đang phụ trách danh mục nào — master-only, nên `enabled` gác bằng chính cờ đó: người
 * khác gọi vào chắc chắn 403, và một request hỏng mỗi lần mở màn là nhiễu thuần tuý.
 */
export function useCategoryAxisGrants(
  filter: { categoryId?: string; province?: string } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: qk.adminCategoryAxis(filter.categoryId ?? '', filter.province ?? ''),
    queryFn: () => orgAdminApi.categoryAxis(filter),
    enabled,
    staleTime: 60_000,
  });
}

export function useGrantRole() {
  return useGrantMutation(orgAdminApi.grantRole);
}

export function useUpdateGrantScope() {
  return useGrantMutation(orgAdminApi.updateGrantScope);
}

export function useRevokeGrant() {
  return useGrantMutation(orgAdminApi.revokeGrant);
}
