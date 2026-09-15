import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ProvinceName } from '@/api/location';
import { useRecentListings } from '@/stores/recent';
import { useSearchHistory } from '@/stores/search-history';
import { useProfile } from './listings';
import { qk } from './keys';

/**
 * "Gợi ý cho bạn" — thay chỗ dải "Xem gần đây" ở trang chủ.
 *
 * Toàn bộ việc xếp hạng chạy Ở MÁY. Hai tín hiệu (`stores/recent`, `stores/search-history`)
 * không rời khỏi thiết bị, và BE chỉ nhận về một bộ lọc bình thường — nhìn từ phía server thì
 * đây là hai lượt `GET /listings` như mọi lượt khác. Đó là điều kiện để tính năng này không
 * phải đi kèm một màn xin phép.
 *
 * ## Refetch contract
 *
 * - Khoá mang theo TÍN HIỆU đã chốt, nên xem thêm một tin hoặc tìm thêm một lượt là khoá đổi
 *   và TanStack tự gọi lại — không cần invalidate ở đâu cả, và không có mutation nào chạm vào.
 * - `staleTime` 5 phút: gu người dùng không đổi trong một phiên lướt, mà đây lại là màn mở
 *   đầu tiên nên mỗi lượt gọi thừa đều nằm đúng chỗ người dùng đang chờ.
 * - Không refetch theo focus: quay lại trang chủ sau khi xem một tin mà dải nhảy sang bộ khác
 *   là mất luôn chỗ người dùng đang nhắm.
 */

/** 6 thẻ: dải để lướt, không phải bảng tin thứ hai. Cùng lập luận với `MAX_FEATURED`. */
const TAKE = 6;

/**
 * Tìm nặng hơn xem, hệ số 3 và 2.
 *
 * Gõ một từ khoá hay chọn một danh mục là nói thẳng ra mình đang cần gì; mở một tin thì tăng
 * cả khi bấm nhầm. Hai con số này là ƯỚC LƯỢNG, không phải hằng số nghiệp vụ — cùng tinh thần
 * với `score` của `FeedHighlights` (tim gấp 3 lượt xem).
 */
const W_SEARCH = 3;
const W_VIEW = 2;

/** Điểm giảm dần theo độ cũ: mục mới nhất ăn trọn `base`, mục cuối danh sách gần 0. */
const points = (base: number, index: number, total: number) => (base * (total - index)) / total;

type Probe = { q?: string; category?: string; province?: ProvinceName };

type Signals = {
  probes: Probe[];
  province: ProvinceName | null;
  excludeIds: string[];
  /** Không có tín hiệu nào — dải chạy ở chế độ "tin quanh bạn". Dùng để đổi dòng phụ của tiêu đề. */
  fallback: boolean;
};

export function useSuggestedListings() {
  const recent = useRecentListings();
  const searches = useSearchHistory();
  const { data: profile } = useProfile();
  const homeProvince = profile?.area?.province ?? null;

  const signals = useMemo<Signals>(() => {
    const tally = new Map<string, number>();
    const add = (id: string | null | undefined, p: number) => {
      if (id) tally.set(id, (tally.get(id) ?? 0) + p);
    };

    searches.forEach((s, i) => add(s.categoryId, points(W_SEARCH, i, searches.length)));
    recent.forEach((r, i) => add(r.categoryId, points(W_VIEW, i, recent.length)));

    const topCategories = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // Tỉnh của lượt tìm gần nhất thắng `profile.area`: người đang tìm đồ ở nơi khác thì nơi
    // khác mới là chỗ họ quan tâm lúc này, dù hồ sơ vẫn ghi quê nhà.
    const province = (searches.find((s) => s.province)?.province as ProvinceName) ?? homeProvince;
    const keyword = searches.find((s) => s.q)?.q;

    /*
     * Trần 2 lượt gọi, ưu tiên từ mạnh xuống yếu:
     *   1. từ khoá gần nhất — tín hiệu rõ ràng nhất người dùng từng phát ra
     *   2. danh mục điểm cao nhất
     *   3. danh mục thứ hai (chỉ khi không có từ khoá, để không vượt trần)
     */
    const probes: Probe[] = [];
    if (keyword) probes.push({ q: keyword });
    for (const category of topCategories) {
      if (probes.length >= 2) break;
      probes.push({ category });
    }

    /*
     * Chưa có tín hiệu nào — người dùng mới tinh. Lùi về "tin quanh bạn" theo khu vực BE đã
     * giải sẵn, thay vì giấu dải đi: trang chủ của người mới là trang trống nhất, đúng lúc
     * không nên trống thêm một khối nữa.
     *
     * `province` ở đây LỌC thật (không chỉ xếp) vì nó là tiêu chí DUY NHẤT còn lại — không có
     * nó thì lượt gọi này chỉ là "tin mới nhất", trùng với dải Nổi bật ngay phía trên.
     */
    const fallback = probes.length === 0;
    if (fallback && province) probes.push({ province });

    return { probes, province, excludeIds: recent.map((r) => r.id), fallback };
  }, [recent, searches, homeProvince]);

  return {
    ...useQuery({
      queryKey: qk.suggested(signalKey(signals)),
      queryFn: () => api.getSuggestedFeed({ ...signals, take: TAKE }),
      // Không tín hiệu và cũng không biết khu vực (khách chưa đăng nhập, hồ sơ chưa đủ căn cứ)
      // thì không có gì để hỏi — `probes` rỗng sẽ gọi BE mà không lọc gì cả.
      enabled: signals.probes.length > 0,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    }),
    fallback: signals.fallback,
  };
}

/**
 * Chuỗi khoá cache. Liệt kê tay theo thứ tự cố định thay vì `JSON.stringify` cả object —
 * cùng lý do `qk.search` đang làm: thứ tự khoá của object không có gì bảo đảm, và hai chuỗi
 * khác nhau cho cùng một bộ tín hiệu là hai lần gọi mạng.
 *
 * `excludeIds` KHÔNG nằm trong khoá: nó đổi mỗi lần mở một tin, mà nó chỉ lọc kết quả chứ
 * không đổi câu hỏi gửi lên BE. Nhét vào là mỗi lượt xem tin lại nổ một lượt gọi mạng.
 */
function signalKey(s: Signals): string {
  return s.probes.map((p) => `${p.q ?? ''}|${p.category ?? ''}|${p.province ?? ''}`).join('~');
}
