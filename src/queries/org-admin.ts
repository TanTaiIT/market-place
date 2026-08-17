import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgAdminApi } from '@/api/org-admin';
import { qk } from './keys';

/**
 * Quản trị tổ chức + phân quyền. Domain riêng (query.convention §8): `org.ts` lo đường người
 * dùng ĐI VÀO tổ chức, còn đây là bàn của người đã ở trong và đang cầm quyền.
 */

/** Dưới ngưỡng này BE coi là slug không hợp lệ — hỏi trước khi gõ đủ chỉ tốn một lượt rate limit. */
const MIN_SLUG_CHARS = 3;

/**
 * Kiểm tra slug còn trống không.
 *
 * **Debounce là thứ giữ rate limit, không phải `enabled`/`staleTime`.** `enabled` chỉ chặn dưới
 * 3 ký tự, còn `staleTime` chỉ cứu term ĐÃ gõ qua — mỗi prefix mới là một `queryKey` mới, nên
 * gõ thẳng thì `hung-vuong` bắn 8 request lên một endpoint công khai có rate limit chặt.
 * 300ms, cùng con số với ô tìm kiếm (`app/search.tsx`).
 *
 * `enabled` chứ không phải `if` ở call-site: hook phải gọi được vô điều kiện.
 */
export function useSlugAvailability(slug: string) {
  const term = slug.trim().toLowerCase();
  const [settled, setSettled] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const query = useQuery({
    queryKey: qk.slugAvailability(settled),
    queryFn: () => orgAdminApi.checkSlug(settled),
    enabled: settled.length >= MIN_SLUG_CHARS,
    staleTime: 5 * 60_000,
  });

  return {
    // Trong lúc chờ debounce, câu trả lời đang cầm là của slug CŨ — giấu đi. Để nguyên là ô báo
    // "dùng được" cho đúng chữ người dùng vừa gõ thêm mà chưa ai kiểm.
    result: settled === term ? query.data : undefined,
    checking: query.isFetching || (settled !== term && term.length >= MIN_SLUG_CHARS),
  };
}

/**
 * Tạo tổ chức. Chỉ invalidate `myOrgs()` cho đúng phép, dù tổ chức mới gần như chắc chắn KHÔNG
 * hiện ra ở đó: master không tự thành thành viên. Không tự vá thêm gì vào cache — bịa một dòng
 * mà `/organizations/mine` không trả về là dựng ra một tổ chức không tồn tại với app.
 */
export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgAdminApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myOrgs() }),
  });
}

export function useSetOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: 'active' | 'suspended' }) =>
      orgAdminApi.setStatus(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myOrgs() }),
  });
}

/**
 * Đổi slug. Ngoài `myOrgs()` phải quét luôn `adminRoot()`: slug là thứ `http.ts` gắn vào header
 * `X-Org-Slug`, nên mọi dữ liệu scope theo tổ chức đang nằm trong cache đều gắn với slug cũ.
 */
export function useChangeOrganizationSlug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; slug: string }) => orgAdminApi.changeSlug(v.id, v.slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myOrgs() });
      qc.invalidateQueries({ queryKey: qk.adminRoot() });
    },
  });
}

/**
 * Refetch contract của cấp/thu hồi quyền: `myGrants()` là thứ quyết định người dùng mở được
 * những mục nào trong `AdminNav`, nên tự thu hồi quyền của mình phải đổi menu ngay lập tức.
 *
 * Cấp quyền cho NGƯỜI KHÁC thì không có gì trong cache để làm mới — BE không có route đọc grant
 * của người khác. Vẫn dùng chung hook: thà quét thừa một key rẻ tiền còn hơn hai đường xử lý.
 */
function useGrantMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myGrants() }),
  });
}

export function useGrantRole() {
  return useGrantMutation(orgAdminApi.grantRole);
}

export function useRevokeGrant() {
  return useGrantMutation(orgAdminApi.revokeGrant);
}
