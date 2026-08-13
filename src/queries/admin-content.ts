import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminContentApi } from '@/api/admin-content';
import type { AdminLimits, NoticeSender } from '@/api/admin-content';
import { qk } from './keys';

/**
 * Nhóm "Nội dung" + "Khác": danh mục, thông báo đẩy, luật của bảng tin.
 *
 * Refetch contract — thêm/đổi/gỡ danh mục invalidate `qk.adminRoot()` vì số đếm danh mục còn
 * hiện ở tổng quan; các mutation còn lại chỉ chạm đúng key của mình.
 */

/* -------------------------------- danh mục -------------------------------- */

export function useAdminCategories(school: string) {
  return useQuery({
    queryKey: qk.adminCategories(school),
    queryFn: () => adminContentApi.getCategories(school),
    placeholderData: keepPreviousData,
  });
}

export function useAddCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; scope: string }) =>
      adminContentApi.addCategory(v.name, v.scope),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useRenameCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { from: string; to: string }) =>
      adminContentApi.renameCategory(v.from, v.to),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

export function useRemoveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminContentApi.removeCategory(name),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRoot() }),
  });
}

/* ------------------------------- thông báo ------------------------------- */

export function useSentNotices() {
  return useQuery({ queryKey: qk.adminNotices(), queryFn: adminContentApi.getNotices });
}

export function useSendNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sender: NoticeSender; title: string; body: string; audienceId: string }) =>
      adminContentApi.sendNotice(v),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminNotices() }),
  });
}

/* --------------------------------- cài đặt -------------------------------- */

export function useAdminRules() {
  return useQuery({ queryKey: qk.adminRules(), queryFn: adminContentApi.getRules });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminContentApi.toggleRule(id),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminRules() }),
  });
}

export function useAdminLimits() {
  return useQuery({ queryKey: qk.adminLimits(), queryFn: adminContentApi.getLimits });
}

export function useSetAdminLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: AdminLimits) => adminContentApi.setLimits(next),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.adminLimits() }),
  });
}
