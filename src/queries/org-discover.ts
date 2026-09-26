import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi, type OrgPatch, type OrgProfile } from '@/api/org';
import { api } from '@/api/client';
import { qk } from './keys';

/**
 * Khám phá nhóm — tìm, gợi ý, hồ sơ nhóm công khai.
 *
 * Tách khỏi `org.ts` (query.convention §8): cụm này chạy TRƯỚC khi người dùng có bất kỳ quan
 * hệ nào với nhóm, không cần `X-Org-Id`, và không đòi đăng nhập. Phần còn lại của `org.ts`
 * là đường của người đã ở trong nhóm.
 */

/**
 * Tìm nhóm công khai. Từ khoá rỗng = khối "Gợi ý cho bạn", nên KHÔNG có `enabled` chặn:
 * màn khám phá phải có nội dung ngay lúc mở, trước khi người dùng gõ chữ nào.
 *
 * Debounce 300ms, cùng lý do với ô tìm của bảng tổ chức (`useAllOrgs`): mỗi tiền tố là một `queryKey` mới
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

/**
 * Hồ sơ nhóm. `retry: false` vì 404 là câu trả lời thật, không phải sự cố mạng.
 *
 * `code` nằm TRONG khoá cache: cùng một id, có mã và không mã là hai câu trả lời khác nhau
 * (một bên hồ sơ, một bên 404). Dùng chung ô cache thì mở bằng mã một lần là lần sau vào
 * không mã vẫn thấy — một lời hứa app không giữ nổi sau khi cache hết hạn.
 */
export function useOrgProfile(orgId: string, code?: string) {
  return useQuery({
    queryKey: qk.orgProfile(orgId, code),
    queryFn: () => orgApi.profile(orgId, code),
    enabled: orgId.length > 0,
    retry: false,
  });
}

/**
 * Sửa hồ sơ nhóm.
 *
 * Refetch contract: `onSuccess` quét `orgProfile(orgId)` (ảnh bìa, mô tả, nội quy vừa đổi) và
 * `myOrgs()` (tên nhóm hiện trong bộ chuyển tổ chức). KHÔNG quét `orgPeek`: danh bạ và tin
 * trong nhóm không đổi vì một lượt sửa hồ sơ.
 *
 * Không optimistic: `PATCH /organizations/current` trả về DTO tóm tắt, không mang `coverUrl`
 * lẫn `rules` — vá tay từ response sẽ ghi `undefined` lên đúng hai field vừa sửa.
 */
export function useUpdateOrg(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: OrgPatch) => orgApi.update(orgId, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orgProfile(orgId) });
      void qc.invalidateQueries({ queryKey: qk.myOrgs() });
    },
  });
}

/** Bao nhiêu avatar xếp chồng trên hồ sơ trước khi đổi sang "+N" — quá 4 là hết chỗ trên một dòng. */
const AVATAR_STACK = 4;
/*
 * Tin xem trước trong hồ sơ nhóm — đủ để biết nhóm đang sống, không phải để lướt thay bảng tin.
 *
 * Một con số duy nhất cho mọi nhóm: số tin không đổi theo `feedLayout`.
 *
 * 6 → 3 khi màn nhóm chuyển sang `ListingCard`. Con số 6 được chọn cho thẻ dòng-gọn cũ và
 * "sáu dòng cao xấp xỉ ba thẻ lớn"; giữ nguyên 6 với thẻ lớn là lặng lẽ nhân ba chiều cao của
 * mục này — khoảng 2.300px cuộn sau phần hồ sơ, tức đúng cái "bảng tin thứ hai" mà dòng đầu
 * docblock này nói là không được thành.
 */
const PEEK_ROWS = 3;

/**
 * Số tin một lượt TÌM trong nhóm trả về.
 *
 * Rộng hơn hẳn `PEEK_ROWS`: xem trước là để biết nhóm còn sống, còn tìm là để thấy cho ra thứ
 * mình cần. 30 là trần một trang của BE nhân ba — đủ cho gần mọi lượt tìm mà chưa phải dựng
 * phân trang cho một khối vốn không phải bảng tin.
 */
const SEARCH_ROWS = 30;

/**
 * Danh bạ + tin của nhóm đang mở hồ sơ.
 *
 * `enabled: joined` là chốt bắt buộc, không phải tối ưu: cả hai endpoint đòi tư cách thành
 * viên, nên gọi cho nhóm mình chưa vào là hai request chắc chắn 403 mỗi lần mở hồ sơ.
 */
export function useOrgPeek(orgId: string, joined: boolean) {
  return useQuery({
    queryKey: qk.orgPeek(orgId, PEEK_ROWS),
    queryFn: async () => ({
      members: await orgApi.memberPreview(orgId, AVATAR_STACK),
      listings: await api.getOrgListings(orgId, PEEK_ROWS),
    }),
    enabled: orgId.length > 0 && joined,
    staleTime: 60_000,
  });
}

/**
 * Tìm tin THEO TÊN trong một nhóm — chỉ chạy khi người dùng đã gõ.
 *
 * Tách khỏi `useOrgPeek` thay vì thêm tham số `q` vào nó, vì hai thứ khác nhau ở cả ba mặt:
 * khối xem trước lấy đúng 3 tin và đi kèm danh bạ, còn lượt tìm lấy rộng hơn nhiều và không
 * cần danh bạ. Nhét chung một query là mỗi lần gõ một chữ lại kéo theo một lượt gọi danh bạ.
 *
 * Hoãn 300ms như `useOrgDiscover`: mỗi tiền tố là một khoá mới, gõ thẳng là một request cho
 * từng chữ cái.
 */
export function useOrgListingSearch(orgId: string, keyword: string, enabled: boolean) {
  const term = keyword.trim();
  const [settled, setSettled] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  return useQuery({
    queryKey: qk.orgListingSearch(orgId, settled),
    queryFn: () => api.getOrgListings(orgId, SEARCH_ROWS, settled),
    // Chuỗi rỗng KHÔNG gọi: đó là trạng thái "chưa tìm", và khối xem trước đã trả lời rồi.
    enabled: enabled && orgId.length > 0 && settled.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Rời nhóm. Lạc quan trên chính hồ sơ đang mở (`joined: false`) để nút đổi ngay; hỏng thì trả
 * lại. `onSettled` quét: hồ sơ nhóm (mọi biến thể `code`), "nhóm của tôi" (mất một nhóm), và bảng
 * tin (tin trong nhóm của mình vừa ẩn, tin nội bộ nhóm không còn đọc được).
 */
export function useLeaveOrg(orgId: string, code?: string) {
  const qc = useQueryClient();
  const key = qk.orgProfile(orgId, code);
  return useMutation({
    mutationFn: () => orgApi.leave(orgId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<OrgProfile>(key);
      if (prev) qc.setQueryData<OrgProfile>(key, { ...prev, joined: false });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['orgs', 'profile'] });
      void qc.invalidateQueries({ queryKey: qk.myOrgs() });
      void qc.invalidateQueries({ queryKey: qk.listings() });
    },
  });
}
