import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Listing, Profile } from '@/api/db';
import type { ProvinceName } from '@/api/location';
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

/** Lọc theo tỉnh chạy ở BE. Chỉ chọn tỉnh mà không gõ từ khoá cũng là một tìm kiếm hợp lệ. */
export function useSearch(q: string, province: ProvinceName | null = null) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.search(term, province),
    queryFn: () => api.searchListings(term, province),
    enabled: term.length > 0 || !!province,
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

export function useProfile() {
  return useQuery({ queryKey: qk.profile(), queryFn: api.getProfile });
}

/* --------------------------- mutations --------------------------- */

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
