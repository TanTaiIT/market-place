import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi, type OrgPatch } from '@/api/org';
import { api } from '@/api/client';
import { useMyOrgs } from './org';
import { useOrgSlug } from '@/stores/auth';
import { qk } from './keys';

/**
 * Khám phá nhóm — tìm, gợi ý, hồ sơ nhóm công khai.
 *
 * Tách khỏi `org.ts` (query.convention §8): cụm này chạy TRƯỚC khi người dùng có bất kỳ quan
 * hệ nào với nhóm, không cần `X-Org-Slug`, và không đòi đăng nhập. Phần còn lại của `org.ts`
 * là đường của người đã ở trong nhóm.
 */

/**
 * Tìm nhóm công khai. Từ khoá rỗng = khối "Gợi ý cho bạn", nên KHÔNG có `enabled` chặn:
 * màn khám phá phải có nội dung ngay lúc mở, trước khi người dùng gõ chữ nào.
 *
 * Debounce 300ms, cùng lý do với `useSlugAvailability`: mỗi tiền tố là một `queryKey` mới
 * nên gõ thẳng sẽ bắn một request cho từng chữ cái vào một route có rate limit.
 */
export function useOrgDiscover(keyword: string) {
  const term = keyword.trim();
  const [settled, setSettled] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  return useQuery({
    queryKey: qk.orgDiscover(settled),
    queryFn: () => orgApi.discover(settled),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Hồ sơ nhóm công khai. `retry: false` vì 404 là câu trả lời thật, không phải sự cố mạng. */
export function useOrgProfile(slug: string) {
  return useQuery({
    queryKey: qk.orgProfile(slug),
    queryFn: () => orgApi.profile(slug),
    enabled: slug.length > 0,
    retry: false,
  });
}

/**
 * Sửa hồ sơ nhóm.
 *
 * Refetch contract: `onSuccess` quét `orgProfile(slug)` (ảnh bìa, mô tả, nội quy vừa đổi) và
 * `myOrgs()` (tên nhóm hiện trong bộ chuyển tổ chức). KHÔNG quét `orgPeek`: danh bạ và tin
 * trong nhóm không đổi vì một lượt sửa hồ sơ.
 *
 * Không optimistic: `PATCH /organizations/current` trả về DTO tóm tắt, không mang `coverUrl`
 * lẫn `rules` — vá tay từ response sẽ ghi `undefined` lên đúng hai field vừa sửa.
 */
export function useUpdateOrg(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: OrgPatch) => orgApi.update(slug, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orgProfile(slug) });
      void qc.invalidateQueries({ queryKey: qk.myOrgs() });
    },
  });
}

/**
 * Tổ chức ĐANG THAO TÁC và cách nó bày bảng tin.
 *
 * Gộp về một chỗ vì việc tra ra nó có hai luật ngầm, và cả hai đều đã bị viết sai một lần:
 *
 * 1. **Thuộc đúng một nhóm thì không cần bấm chọn.** `tenant.middleware` bên BE tự suy ra
 *    org trong ca đó, nên `activeOrgSlug` là `undefined` một cách bình thường. Tra `find`
 *    theo một slug `undefined` sẽ không khớp ai.
 * 2. **`/organizations/mine` chỉ có nhóm mình LÀ THÀNH VIÊN.** Master cố ý không thuộc
 *    nhóm nào, nên với họ nguồn đó luôn rỗng. Hồ sơ nhóm công khai cũng trả `feedLayout`
 *    — BE đã dọn sẵn đúng cho ca này.
 *
 * `layout` mặc định `'feed'` khi không có nhóm nào đang mở: kiểu bày là lựa chọn của MỘT
 * nhóm cụ thể, mà lúc đó không có nhóm nào để hỏi.
 */
export function useActiveOrg() {
  const activeSlug = useOrgSlug();
  const { data: myOrgs, isPending: minePending } = useMyOrgs();

  const only = (myOrgs ?? []).length === 1 ? myOrgs?.[0] : undefined;
  const slug = activeSlug ?? only?.slug;

  const mine = (myOrgs ?? []).find((o) => o.slug === slug);
  const profile = useOrgProfile(slug ?? '');

  return {
    slug,
    /**
     * `undefined` với master: họ không nằm trong `myOrgs` nên không tra ra id. Không phải
     * thiếu sót — `canAdminOrg` short-circuit ở `isMaster` trước khi cần tới id.
     */
    id: mine?.id,
    name: mine?.name ?? profile.data?.name,
    layout: mine?.feedLayout ?? profile.data?.feedLayout ?? ('feed' as const),
    // `isLoading` chứ không `isPending`: query đang `enabled: false` (chưa có slug) đứng
    // mãi ở `pending`, dùng nó là treo spinner vĩnh viễn.
    isLoading: minePending || profile.isLoading,
  };
}

/** Bao nhiêu avatar xếp chồng trên hồ sơ trước khi đổi sang "+N" — quá 4 là hết chỗ trên một dòng. */
const AVATAR_STACK = 4;
/*
 * Tin xem trước trong hồ sơ nhóm — đủ để biết nhóm đang sống, không phải để lướt thay bảng tin.
 *
 * Một con số duy nhất kể từ khi màn nhóm bày tin bằng DÒNG GỌN (`ListingRow`) cho mọi nhóm: số
 * tin không còn đổi theo `feedLayout` nữa. Sáu dòng cao xấp xỉ ba thẻ lớn cũ, nên vẫn là "xem
 * trước" chứ không thành bảng tin thứ hai.
 */
const PEEK_ROWS = 6;

/**
 * Danh bạ + tin của nhóm đang mở hồ sơ.
 *
 * `enabled: joined` là chốt bắt buộc, không phải tối ưu: cả hai endpoint đòi tư cách thành
 * viên, nên gọi cho nhóm mình chưa vào là hai request chắc chắn 403 mỗi lần mở hồ sơ.
 */
export function useOrgPeek(slug: string, joined: boolean) {
  return useQuery({
    queryKey: qk.orgPeek(slug, PEEK_ROWS),
    queryFn: async () => ({
      members: await orgApi.memberPreview(slug, AVATAR_STACK),
      listings: await api.getOrgListings(slug, PEEK_ROWS),
    }),
    enabled: slug.length > 0 && joined,
    staleTime: 60_000,
  });
}
