import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { orgApi } from '@/api/org';
import { api } from '@/api/client';
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

/** Bao nhiêu avatar xếp chồng trên hồ sơ trước khi đổi sang "+N" — quá 4 là hết chỗ trên một dòng. */
const AVATAR_STACK = 4;
/** Tin xem trước trong hồ sơ nhóm. Đủ để biết nhóm đang sống, không phải để lướt thay bảng tin. */
const PEEK_LISTINGS = 3;

/**
 * Danh bạ + tin của nhóm đang mở hồ sơ.
 *
 * `enabled: joined` là chốt bắt buộc, không phải tối ưu: cả hai endpoint đòi tư cách thành
 * viên, nên gọi cho nhóm mình chưa vào là hai request chắc chắn 403 mỗi lần mở hồ sơ.
 */
export function useOrgPeek(slug: string, joined: boolean) {
  return useQuery({
    queryKey: qk.orgPeek(slug),
    queryFn: async () => ({
      members: await orgApi.memberPreview(slug, AVATAR_STACK),
      listings: await api.getOrgListings(slug, PEEK_LISTINGS),
    }),
    enabled: slug.length > 0 && joined,
    staleTime: 60_000,
  });
}
