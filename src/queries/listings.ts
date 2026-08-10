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

export function useListing(id: number) {
  return useQuery({
    queryKey: qk.listing(id),
    queryFn: () => api.getListing(id),
    enabled: Number.isFinite(id),
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
    mutationFn: (id: number) => api.toggleSaved(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.savedIds() });
      const prev = qc.getQueryData<number[]>(qk.savedIds()) ?? [];
      qc.setQueryData<number[]>(
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
    mutationFn: (id: number) => api.deleteListing(id),
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
    mutationFn: (v: { phone: string; password: string }) => api.login(v.phone, v.password),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.register,
    onSuccess: (data) => qc.setQueryData(qk.profile(), data),
  });
}
