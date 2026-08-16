import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { api } from '@/api/client';
import { hasSearchCriteria } from '@/api/db';
import type { Listing, Notif, Profile, SearchFilter } from '@/api/db';
import { qk } from './keys';

/**
 * Từ điển danh mục. `staleTime` dài vì nó gần như không đổi — mỗi lần mở bảng tin lại gọi
 * `/categories` là lãng phí, mà danh mục mới thì vài tháng mới có một cái.
 */
export function useCategories() {
  return useQuery({
    queryKey: qk.categories(),
    queryFn: api.getCategories,
    staleTime: 30 * 60 * 1000,
  });
}

/** `categoryId` rỗng = tất cả. Lọc chạy ở BE nên đổi chip là một lượt gọi mới, không cắt mảng. */
export function useListings(categoryId = '') {
  return useQuery({
    queryKey: categoryId ? qk.listingsByCategory(categoryId) : qk.listings(),
    queryFn: () => api.getListings(categoryId || undefined),
    // Đổi chip không được để cả bảng nháy trắng rồi dựng lại từ đầu.
    placeholderData: keepPreviousData,
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: qk.listing(id),
    queryFn: () => api.getListing(id),
    // Route param có thể rỗng lúc màn hình mới mount, và ObjectId của BE là 24 hex.
    enabled: id.length > 0,
  });
}

/** Số tin gợi ý hiển thị — một hàng ngang cuộn được, không phải một bảng tin thứ hai. */
const SUGGESTION_COUNT = 8;

/**
 * Tin gợi ý cho tin đang xem.
 *
 * Nhận cả `Listing` chứ không nhận id: tiêu chí gợi ý (danh mục, tỉnh) nằm trong chính tin đó,
 * truyền id thì hook phải đọc lại tin một lần nữa từ cache — vòng phụ thuộc không cần có.
 * `enabled` chờ tin về, nên lần mở màn đầu tiên không bắn một request thiếu tiêu chí.
 */
export function useListingSuggestions(current: Listing | undefined) {
  return useQuery({
    queryKey: qk.listingSuggestions(current?.id ?? ''),
    queryFn: () => api.getSuggestions(current!, SUGGESTION_COUNT),
    enabled: Boolean(current?.categoryId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Tìm kiếm. Mọi ràng buộc (từ khoá, tỉnh, danh mục, khoảng giá) chạy ở BE — app không tải về
 * rồi tự cắt mảng, vì như thế trần `limit: 50` sẽ cắt trước khi bộ lọc kịp chạy.
 *
 * Chỉ chọn danh mục mà không gõ từ khoá cũng là một lượt tìm hợp lệ; `hasSearchCriteria` là
 * nơi duy nhất định nghĩa "đã có ràng buộc chưa", dùng chung với màn hình.
 */
export function useSearch(filter: SearchFilter) {
  return useQuery({
    queryKey: qk.search(filter),
    queryFn: () => api.searchListings(filter),
    enabled: hasSearchCriteria(filter),
    placeholderData: keepPreviousData,
  });
}

export function useMyListings() {
  return useQuery({ queryKey: qk.myListings(), queryFn: api.getMyListings });
}

export function useSavedIds() {
  return useQuery({ queryKey: qk.savedIds(), queryFn: api.getSavedIds });
}

export function useSavedListings() {
  return useQuery({ queryKey: qk.savedListings(), queryFn: api.getSavedListings });
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications(), queryFn: api.getNotifications });
}

/**
 * Đánh dấu đã đọc, cập nhật lạc quan.
 *
 * Optimistic vì đây là thao tác một chiều và không có gì để tranh chấp: chấm chưa đọc phải
 * tắt ngay lúc chạm, chờ một vòng mạng rồi mới tắt sẽ khiến người dùng chạm lần hai.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.notifications() });
      const prev = qc.getQueryData<Notif[]>(qk.notifications());
      qc.setQueryData<Notif[]>(qk.notifications(), (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, unread: false } : n)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notifications(), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
}

export function useProfile() {
  return useQuery({ queryKey: qk.profile(), queryFn: api.getProfile });
}

/* --------------------------- mutations --------------------------- */

/**
 * Hạn mức đăng tin. Key nằm dưới prefix `qk.listings()` nên mọi lần đăng/gỡ tin đã tự làm mới
 * nó — không cần invalidate riêng.
 */
export function useQuota() {
  return useQuery({
    queryKey: qk.listingQuota(),
    queryFn: api.getQuota,
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createListing,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.listings() });
      qc.invalidateQueries({ queryKey: qk.profile() });
    },
  });
}

/** Bỏ tim / thả tim với optimistic update — UI phản hồi ngay lập tức */
export function useToggleSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleSaved(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.savedIds() });
      const prev = qc.getQueryData<string[]>(qk.savedIds()) ?? [];
      qc.setQueryData<string[]>(
        qk.savedIds(),
        prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.savedIds(), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.savedRoot() });
    },
  });
}

/** Xoá tin, gỡ khỏi danh sách ngay rồi mới đồng bộ */
export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteListing(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.myListings() });
      const prev = qc.getQueryData<Listing[]>(qk.myListings());
      qc.setQueryData<Listing[]>(qk.myListings(), (old) => (old ?? []).filter((l) => l.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myListings(), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.listings() });
      qc.invalidateQueries({ queryKey: qk.savedRoot() });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Profile>) => api.updateProfile(input),
    onSuccess: (data) => qc.setQueryData(qk.profile(), data),
  });
}
