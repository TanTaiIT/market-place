import { useMemo } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type { Page } from '@/api/client';

/**
 * Danh sách cuộn-tới-đâu-tải-tới-đó, bọc `useInfiniteQuery` thành hình dạng mọi màn danh sách
 * đã quen: `data` là MẢNG PHẲNG của các trang đã tải (nên `data ?? []`, `data.some(...)` ở
 * `TabBar`, `data.length` đều đứng nguyên), thêm `loadMore` cho `onEndReached` và `total` lấy từ
 * `meta` của BE — con số cho badge, không suy được từ độ dài phần đã tải.
 *
 * Không phải tối ưu tuỳ chọn: BE trần 10 dòng/trang (`PAGINATION.MAX_LIMIT`), xin hơn là 400.
 * Không có hook này thì mọi danh sách dừng ở 10 dòng đầu và người dùng tưởng "hết".
 *
 * `olderPagesFirst`: cho màn chat — BE trả trang MỚI nhất trước, màn vẽ cũ → mới, nên các trang
 * tải sau (cũ hơn) phải đứng TRƯỚC trong mảng phẳng.
 */
export function usePagedList<T>(
  queryKey: QueryKey,
  fetchPage: (page: number) => Promise<Page<T>>,
  options: {
    enabled?: boolean;
    /** Đổi bộ lọc mà giữ danh sách cũ tới khi trang mới về — bảng không chớp về rỗng. */
    keepPrevious?: boolean;
    olderPagesFirst?: boolean;
    staleTime?: number;
    /**
     * Khoá để khử dòng lặp giữa các trang. Mặc định đọc `id`; danh sách không có `id` (danh bạ
     * thành viên dùng `userId`) truyền hàm riêng. Phân trang theo `skip/limit` VỐN có thể lặp:
     * một dòng mới chen lên đầu giữa hai lượt tải là dòng cuối trang 1 trượt xuống đầu trang 2 —
     * và hai dòng cùng `key` là React ném lỗi ngay trên màn, không phải cảnh báo.
     */
    keyOf?: (item: T) => string | undefined;
  } = {},
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNext ? pages.length + 1 : undefined),
    enabled: options.enabled,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
    staleTime: options.staleTime,
  });

  const pages = query.data?.pages;
  const olderPagesFirst = options.olderPagesFirst ?? false;
  const keyOf = options.keyOf ?? defaultKey;
  const data = useMemo(() => {
    if (!pages) return undefined;
    // Đọc ngược chỉ số thay vì `.reverse()` (mutate) hay `.toReversed()` (Hermes chưa chắc có).
    const ordered = olderPagesFirst ? pages.map((_, i) => pages[pages.length - 1 - i]) : pages;
    // Khử lặp giữa các trang, giữ lần xuất hiện ĐẦU (vị trí người dùng đã thấy nó).
    const seen = new Set<string>();
    return ordered
      .flatMap((p) => p.items)
      .filter((item) => {
        const key = keyOf(item);
        if (key === undefined) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [pages, olderPagesFirst, keyOf]);

  // Chốt kép: `hasNextPage` để không gọi khi đã hết, `isFetchingNextPage` để `onEndReached` bắn
  // liên tiếp trong lúc cuộn không thành hai request cho cùng một trang.
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };

  return { ...query, data, total: pages?.[0]?.total ?? 0, loadMore };
}

/** Khoá mặc định: hầu hết domain type của app mang `id`; không có thì không khử (giữ nguyên dòng). */
function defaultKey<T>(item: T): string | undefined {
  return (item as { id?: string }).id;
}

/** Cache của một danh sách trang — kiểu cho `setQueryData` trong các cập nhật lạc quan. */
export type PagedCache<T> = InfiniteData<Page<T>, number>;

/**
 * Sửa từng dòng trong cache trang mà GIỮ cấu trúc trang. Làm phẳng rồi ghi lại một mảng là mất
 * `pageParams`, và `getNextPageParam` (đếm số trang) sẽ xin sai trang ở lượt tải tiếp.
 */
export function mapPages<T>(
  cache: PagedCache<T> | undefined,
  fn: (items: T[]) => T[],
): PagedCache<T> | undefined {
  return cache && { ...cache, pages: cache.pages.map((p) => ({ ...p, items: fn(p.items) })) };
}

/**
 * Nối một dòng vào trang MỚI NHẤT (trang đầu, `page: 1`) — bong bóng chat lạc quan, tin nhắn tới
 * qua socket. Chưa có cache (mở hội thoại mới, gửi trước khi trang đầu về) thì dựng trang đầu.
 */
export function appendToNewest<T>(cache: PagedCache<T> | undefined, item: T): PagedCache<T> {
  if (!cache || cache.pages.length === 0) {
    return { pages: [{ items: [item], hasNext: false, total: 1 }], pageParams: [1] };
  }
  return {
    ...cache,
    pages: cache.pages.map((p, i) => (i === 0 ? { ...p, items: [...p.items, item] } : p)),
  };
}
