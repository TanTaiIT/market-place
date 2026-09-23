import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api/org';
import type { JoinRequestStatus } from '@/api/org';
import { useAdminOrgId } from '@/components/AdminOrgScope';
import { useIsAuthenticated } from '@/stores/auth';
import { canModerateOrg, moderatedOrgIds } from '@/api/admin';
import { useMyGrants } from './admin';
import { NO_ORG, qk } from './keys';
import { usePagedList } from './paged';

/** Độ dài tối thiểu của mã tham gia theo schema BE — gõ ngắn hơn thì chắc chắn 400. */
const MIN_CODE_CHARS = 4;

/**
 * Xem trước tổ chức đứng sau một mã tham gia.
 *
 * `enabled` chứ không phải `if` ở call-site: hook luôn được gọi, còn TanStack quyết định có
 * bay hay không (query.convention §3). `retry: false` vì mã sai trả 404 — thử lại ba lần một
 * mã không tồn tại chỉ làm người đang gõ dở thấy màn hình treo.
 */
export function useOrgByCode(code: string) {
  const trimmed = code.trim();
  return useQuery({
    queryKey: qk.orgByCode(trimmed),
    queryFn: () => orgApi.byCode(trimmed),
    enabled: trimmed.length >= MIN_CODE_CHARS,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/**
 * Các tổ chức mình LÀ THÀNH VIÊN — danh sách thuần, KHÔNG tác dụng phụ.
 *
 * Bản trước còn tự ghi "org đang thao tác" vào store khi người dùng thuộc đúng một nhóm, và
 * xoá nó đi cho master. Cả hai nhu cầu đó chuyển sang `AdminOrgScope`, nơi luật "một nhóm thì
 * suy ra" được tính TRONG RENDER thay vì bằng một effect ghi ngược vào store — effect đó chạy
 * ở mọi màn có gọi hook này, kể cả những màn không liên quan gì tới quản trị.
 *
 * Luật cũ vẫn còn giá trị và đã chuyển theo sang đó: chỉ suy ra nhóm đang ACTIVE. Nhóm bị khoá
 * vẫn nằm trong danh sách này, và tự chọn nó là mọi request mang một id BE chắc chắn ném 403 —
 * người dùng không bấm gì mà app tự đưa mình vào trạng thái không dùng được.
 *
 * Đổi rất ít nên giữ cache lâu, tránh gọi lại mỗi lần mở màn.
 */
export function useMyOrgs() {
  const isAuthenticated = useIsAuthenticated();
  const query = useQuery({
    queryKey: qk.myOrgs(),
    queryFn: orgApi.myOrgs,
    // Khách chưa đăng nhập không thuộc tổ chức nào — hỏi BE là một cú 401 mỗi lần mở app.
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  return query;
}

/**
 * Các nhóm mình QUẢN TRỊ được — nguồn DUY NHẤT của mọi bộ chọn nhóm trong `/admin`.
 *
 * Khác `useMyOrgs` ở đúng một chữ: THAM GIA không phải QUẢN TRỊ. `/organizations/mine` trả mọi
 * nhóm mình là thành viên, kể cả nhóm mình chỉ vào để mua bán. Bày chúng trong bộ chọn của bàn
 * quản trị là mời người dùng chọn một phạm vi mà BE sẽ từ chối: `requireOrgModerator` xét
 * `role_grants`, không xét `memberships`, nên mọi màn sau đó rỗng hoặc 403 — mà thông điệp
 * lại nói về quyền, trong khi người dùng vừa bấm đúng một cái tên app tự bày ra cho họ.
 *
 * Lọc luôn nhóm đang khoá: chọn vào đó là mọi request mang một id BE chắc chắn ném 403.
 *
 * Master KHÔNG dùng hook này — họ không thuộc nhóm nào nên `/organizations/mine` rỗng với họ;
 * bộ chọn của họ đọc `useAllOrgs` (toàn hệ thống). Xem `moderatedOrgIds` trả `null`.
 */
export function useAdminOrgs() {
  const { data, isPending } = useMyOrgs();
  const { data: grants } = useMyGrants();
  const allowed = moderatedOrgIds(grants);
  const rows = (data ?? []).filter(
    (o) => o.status === 'active' && (allowed === null || allowed.has(o.id)),
  );
  return { rows, isPending };
}

/**
 * Nhóm DUY NHẤT mình quản trị được — `null` khi không có, hoặc có từ hai.
 *
 * Đây là luật "một nhóm thì không phải bấm chọn", tách thành một hàm để `app/admin/_layout`
 * mớm nó cho `AdminOrgScope`. Provider KHÔNG tự gọi query: nó nằm ở `components/`, mà mọi
 * `queries/*` lại đọc `useAdminOrgId` từ nó — để nó gọi ngược vào `queries/` là dựng một vòng
 * import thật, kiểu vòng chỉ nổ lúc chạy và nổ ở một file chẳng liên quan.
 *
 * Đọc `useAdminOrgs` chứ không `useMyOrgs`: tự chọn hộ một nhóm mình chỉ là thành viên thì
 * người dùng thậm chí không có lấy một cú bấm nào để mà đổ lỗi — bàn quản trị mở ra là đã 403.
 */
export function useSoleOrgId(): string | null {
  const { rows } = useAdminOrgs();
  return rows.length === 1 ? rows[0].id : null;
}

export function useMyJoinRequests() {
  return useQuery({
    queryKey: qk.myJoinRequests(),
    queryFn: orgApi.myRequests,
  });
}

export function useRequestJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgApi.requestJoin,
    // Không optimistic: đơn chỉ hợp lệ sau khi BE soi đủ ba chốt (đã là thành viên chưa, còn
    // trần đơn chờ không, hết cooldown chưa). Vẽ trước một dòng "đang chờ" rồi phải rút lại
    // khi BE từ chối là nói dối người dùng ngay ở bước họ cần chắc chắn nhất.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() });
      qc.invalidateQueries({ queryKey: qk.myOrgs() });
      // Hồ sơ nhóm mang cờ `joined` và số thành viên — gửi đơn xong mà không quét thì nút
      // vẫn mời người ta vào lại đúng nhóm họ vừa xin.
      qc.invalidateQueries({ queryKey: ['orgs', 'profile'] });
    },
  });
}

export function useCancelJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgApi.cancelRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() }),
  });
}

/* ------------------------ phía người duyệt ------------------------ */

/**
 * Hàng đợi đơn của MỘT tổ chức.
 *
 * `orgId` đi xuống hàm api chứ không qua header mặc định nào. Nó cũng phải nằm TRONG KEY —
 * thiếu thì đổi tổ chức xong vẫn thấy hàng đợi của tổ chức cũ trong cache.
 */
export function useJoinRequestQueue(status?: JoinRequestStatus) {
  const orgId = useAdminOrgId();
  const { data: grants } = useMyGrants();

  return usePagedList(
    qk.joinRequestQueue(orgId ?? NO_ORG, status ?? 'all'),
    // `orgId!`: `enabled` ngay dưới đã chặn ca rỗng.
    (page) => orgApi.joinRequests(orgId!, status, page),
    {
      // Chặn bằng grant chứ không chỉ bằng org: `AdminNav` gọi hook này để lấy con số badge cho
      // MỌI người mở ngăn kéo, mà manager danh mục (grant `category_province`) tuy là thành viên
      // org vẫn ăn 403 ở endpoint này — một request hỏng mỗi lần mở ngăn kéo.
      enabled: Boolean(orgId) && canModerateOrg(grants),
      keepPrevious: true,
    },
  );
}

/**
 * Gỡ thành viên / chuyển nhóm con.
 *
 * Refetch contract: cả hai quét `orgMembers(orgId)` — danh bạ là chỗ duy nhất hiện thay đổi.
 * Gỡ người còn quét `joinRequestsRoot()`: người bị gỡ có thể xin vào lại, và hàng đợi đơn
 * đang cache trạng thái "đã là thành viên" của họ.
 */
export function useRemoveMember() {
  const qc = useQueryClient();
  const orgId = useAdminOrgId();
  return useMutation({
    mutationFn: (userId: string) => {
      if (!orgId) throw new Error('Chưa chọn nhóm nào');
      return orgApi.removeMember(orgId, userId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orgMembers(orgId ?? NO_ORG) });
      void qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() });
    },
  });
}

/**
 * Refetch contract của cả ba mutation dưới đây: invalidate `joinRequestsRoot()` (hàng đợi mọi
 * tab + "đơn của tôi" của chính người duyệt nếu họ cũng đang có đơn ở đâu đó), `adminRoot()`
 * — duyệt một đơn là thêm một thành viên, mà số thành viên nằm trên thẻ tổng quan — và
 * `orgMembers()`: người vừa được duyệt phải xuất hiện ngay trong danh bạ, vì hai ô "chọn
 * người phụ trách" và "cấp quyền" đọc thẳng từ đó.
 */
function useJoinRequestMutation<TVars, TData>(fn: (orgId: string, v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  const orgId = useAdminOrgId();
  return useMutation({
    /*
     * Ba cửa dưới đây đều `requireOrg` bên BE. Chưa mở nhóm nào thì ném ngay tại đây với câu
     * đọc được, thay vì đi một vòng mạng để nhận 403 "Chưa xác định được tổ chức" — mutation
     * không có `enabled` để chặn hộ như query.
     */
    mutationFn: (v: TVars) => {
      if (!orgId) throw new Error('Chưa chọn nhóm nào');
      return fn(orgId, v);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.joinRequestsRoot() });
      qc.invalidateQueries({ queryKey: qk.adminRoot() });
      qc.invalidateQueries({ queryKey: qk.orgMembers(orgId ?? NO_ORG) });
    },
  });
}

export function useApproveJoinRequest() {
  return useJoinRequestMutation((orgId, v: { id: string; unitId?: string | null }) =>
    orgApi.approveRequest(orgId, v.id, v.unitId),
  );
}

export function useRejectJoinRequest() {
  return useJoinRequestMutation((orgId, v: { id: string; reason?: string }) =>
    orgApi.rejectRequest(orgId, v.id, v.reason),
  );
}

export function useBulkApproveJoinRequests() {
  return useJoinRequestMutation((orgId, v: { ids: string[]; unitId?: string | null }) =>
    orgApi.bulkApprove(orgId, v.ids, v.unitId),
  );
}
