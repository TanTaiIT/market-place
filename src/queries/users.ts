import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { qk } from './keys';

/**
 * Hồ sơ công khai của người bán + tin họ đang bán.
 *
 * Domain riêng (query.convention §8): đây là dữ liệu của MỘT NGƯỜI, không phải của bảng tin —
 * gộp vào `listings.ts` thì mỗi lần đăng tin lại kéo theo một module đã chạm trần LOC.
 *
 * Cả hai hook nhận `id` từ route param nên có thể rỗng ở nhịp mount đầu; `enabled` chặn lượt
 * gọi trần đó, nếu không BE nhận `/users/` và trả 404 cho một màn chưa kịp có id.
 */

export function useSellerProfile(id: string) {
  return useQuery({
    queryKey: qk.sellerProfile(id),
    queryFn: () => api.getSellerProfile(id),
    enabled: id.length > 0,
    // Tên và điểm đánh giá của một người gần như đứng yên trong suốt một phiên xem tin.
    staleTime: 5 * 60_000,
  });
}

export function useSellerListings(id: string) {
  return useQuery({
    queryKey: qk.sellerListings(id),
    queryFn: () => api.getSellerListings(id),
    enabled: id.length > 0,
  });
}
