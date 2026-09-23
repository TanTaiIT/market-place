import { useQuery } from '@tanstack/react-query';
import { metricsApi } from '@/api/metrics';
import { useMyGrants } from './admin';
import { isMaster } from '@/api/admin';
import { qk } from './keys';

/**
 * Số liệu toàn hệ thống cho bàn master.
 *
 * `enabled` theo grant chứ không để chạy vô điều kiện: màn `/admin` gọi hook này TRƯỚC khi rẽ
 * theo vai (luật hooks), nên một quản trị org mở bàn quản trị sẽ bắn một request chắc chắn 403
 * mỗi lần vào — và cái 403 đó nằm lại trong cache, đúng cơ chế đã làm màn Thông báo hiện
 * "Missing access token" cho người đã đăng nhập.
 *
 * KHÔNG mang `orgSlug` vào key: `requireMaster` không đọc `X-Org-Slug`, nên đổi tổ chức đang
 * chọn không đổi một dòng số liệu nào — bỏ nó vào key chỉ tạo ra N bản cache y hệt nhau.
 */
export function useSystemMetrics() {
  const { data: grants } = useMyGrants();
  return useQuery({
    queryKey: qk.systemMetrics(),
    queryFn: metricsApi.system,
    enabled: isMaster(grants),
    // Số đếm toàn hệ thống là `countDocuments` trên vài collection lớn — không có gì đổi trong
    // một phút mà đáng một lượt quét lại.
    staleTime: 60_000,
  });
}
