import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Lượt tìm gần đây — tín hiệu thứ hai của "Gợi ý cho bạn", song song với `recent.ts`.
 *
 * Tìm kiếm nặng hơn lượt xem trong bộ xếp hạng (xem `queries/suggested`): gõ một từ khoá hoặc
 * chọn một danh mục là nói thẳng ra mình đang cần gì, còn mở một tin thì tăng cả khi bấm nhầm.
 *
 * Cũng chỉ nằm ở MÁY, cùng lý do với `recent.ts`. KHÔNG bày ra màn hình ở đâu cả — đây không
 * phải tính năng "lịch sử tìm kiếm" của ô tìm kiếm; nếu sau này muốn bày thì cân nhắc thêm
 * nút xoá, vì lúc đó nó thành thứ người dùng đọc được và sẽ muốn dọn.
 *
 * Store là lá: không import layer khác, nên `province` để `string` chứ không `ProvinceName`.
 */
export type SearchMemory = {
  /** Từ khoá đã chuẩn hoá (trim). Rỗng = lượt tìm chỉ bằng bộ lọc, vẫn là tín hiệu hợp lệ. */
  q: string;
  categoryId: string | null;
  province: string | null;
};

/** 10 lượt: đủ để thấy mẫu, ngắn để một buổi tìm đồ khác không đè mất sở thích lâu dài. */
const MAX_SEARCHES = 10;

/** Hai lượt tìm coi là MỘT khi cả ba tiêu chí trùng — gõ lại cùng thứ không nhân đôi trọng số. */
const sameSearch = (a: SearchMemory, b: SearchMemory) =>
  a.q === b.q && a.categoryId === b.categoryId && a.province === b.province;

type SearchHistoryState = {
  items: SearchMemory[];
  record: (item: SearchMemory) => void;
  clear: () => void;
};

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      items: [],
      record: (item) =>
        set((s) => ({
          items: [item, ...s.items.filter((x) => !sameSearch(x, item))].slice(0, MAX_SEARCHES),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'ghim-search-history',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && !Array.isArray(state.items)) useSearchHistoryStore.setState({ items: [] });
      },
    },
  ),
);

/* --------------------- selector: đọc từng mảnh, không lấy cả store --------------------- */

export const useSearchHistory = () => useSearchHistoryStore((s) => s.items);
export const useRecordSearch = () => useSearchHistoryStore((s) => s.record);
