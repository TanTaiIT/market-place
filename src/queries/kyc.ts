import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kycAdminApi, kycApi, type KycInput, type KycStatus } from '@/api/kyc';
import { useIsAuthenticated } from '@/stores/auth';

/**
 * Hồ sơ định danh của chính mình — lớp phủ TẠM THỜI, xem docblock ở `api/kyc.ts`.
 *
 * Khoá cache đứng RIÊNG, không nằm dưới prefix nào đang có: gỡ tính năng về sau là xoá file
 * này, và không một `invalidateQueries` nào của phần còn lại phải sửa theo.
 */
const KYC_KEY = ['kyc', 'me'] as const;

export function useMyKyc() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: KYC_KEY,
    queryFn: kycApi.mine,
    // Khách chưa đăng nhập không có hồ sơ nào để hỏi — gọi là một cú 401 mỗi lần mở app.
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSubmitKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: KycInput) => kycApi.submit(input),
    /*
     * Nộp xong quét SẠCH cache, không chỉ `KYC_KEY`.
     *
     * Trong lúc chưa được duyệt, mọi query khác đều đã hỏng với 403 và đang giữ lỗi đó trong
     * cache. Chỉ làm mới hồ sơ thì màn chuyển sang "chờ duyệt" đúng, nhưng lúc được duyệt xong
     * người dùng vẫn nhìn một app đầy lỗi cũ cho tới khi tự tắt mở lại.
     */
    onSuccess: () => qc.invalidateQueries(),
  });
}

/* ─────────────── Bàn duyệt của master — cùng lớp phủ tạm thời ─────────────── */

/**
 * Hàng chờ định danh. `enabled` gác bằng chính cờ master: route là master-only, người khác gọi
 * vào chắc chắn 403 và một request hỏng mỗi lần mở màn là nhiễu thuần tuý.
 */
export function useKycQueue(status: KycStatus, enabled: boolean) {
  return useQuery({
    queryKey: ['kyc', 'queue', status],
    queryFn: () => kycAdminApi.list(status),
    enabled,
    staleTime: 30_000,
  });
}

/** Chi tiết MỘT hồ sơ — chỉ gọi khi ngăn mở, vì đây là đường duy nhất kéo số định danh về máy. */
export function useKycDetail(id: string | null) {
  return useQuery({
    queryKey: ['kyc', 'detail', id],
    queryFn: () => kycAdminApi.detail(id!),
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Refetch contract: cả hai quét prefix `['kyc']` — một lượt duyệt đổi cùng lúc hàng chờ đang
 * mở, tab "đã duyệt", và hồ sơ chi tiết vừa xem. Liệt kê từng key sẽ bỏ sót đúng tab đang mở.
 */
function useKycDecision<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: ['kyc'] }),
  });
}

export function useApproveKyc() {
  return useKycDecision(kycAdminApi.approve);
}

export function useRejectKyc() {
  return useKycDecision(kycAdminApi.reject);
}
