import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Listing, Profile } from '@/api/db';
import { qk } from './keys';

export function useListings(cat: string) {
  return useQuery({
    queryKey: qk.listings(cat),
    queryFn: () => api.getListings(cat),
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

export function useSearch(q: string) {
  return useQuery({
    queryKey: qk.search(q.trim()),
    queryFn: () => api.searchListings(q),
    enabled: q.trim().length > 0,
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
      qc.invalidateQueries({ queryKey: ['listings'] });
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
      qc.invalidateQueries({ queryKey: ['saved'] });
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
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['saved'] });
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

export function useLogin() {
  return useMutation({
    mutationFn: (v: { email: string; password: string; orgSlug?: string }) =>
      api.login(v.email, v.password, v.orgSlug),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.register,
    // Đăng ký trả về session (token + userId), không phải hồ sơ — nên invalidate để
    // `useProfile()` gọi lại `GET /users/me` bằng token mới thay vì ghi cache bằng session.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile() }),
  });
}
