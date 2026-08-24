import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reportApi } from '@/api/report';
import { qk } from './keys';

/**
 * Gửi báo cáo.
 *
 * Không optimistic và không có query đi kèm: người gửi KHÔNG được đọc lại báo cáo của mình —
 * BE chỉ mở hàng đợi cho quản trị. Vẽ ra một danh sách "báo cáo của tôi" ở đây là dựng một màn
 * mà không endpoint nào nuôi được.
 *
 * Invalidate `adminReports()` cho ca người báo cáo cũng chính là quản trị đang mở hàng đợi:
 * với người dùng thường key đó không nằm trong cache nên đây là lệnh rỗng, không tốn gì.
 */
export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reportApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminReportsRoot() }),
  });
}
