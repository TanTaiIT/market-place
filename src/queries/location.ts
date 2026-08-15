import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Province } from '@/api/location';
import { qk } from './keys';

/**
 * Từ điển địa giới hành chính. `staleTime: Infinity` vì nó chỉ đổi khi Quốc hội sắp xếp lại
 * đơn vị hành chính — vài năm một lần, không phải vài phút. Tải lại mỗi lần mở ô chọn là
 * lãng phí thấy rõ, mà người dùng thì đang chờ danh sách hiện ra.
 */
export function useProvinces() {
  return useQuery<Province[]>({
    queryKey: qk.provinces(),
    queryFn: api.getProvinces,
    staleTime: Infinity,
  });
}

/** Phụ thuộc tỉnh: chưa chọn thì `enabled: false` để không bắn request rỗng (query §5). */
export function useWards(province: Province['name'] | null) {
  return useQuery<string[]>({
    queryKey: qk.wards(province),
    queryFn: () => api.getWards(province!),
    enabled: !!province,
    staleTime: Infinity,
  });
}
