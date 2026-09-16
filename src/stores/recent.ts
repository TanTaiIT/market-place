import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Dấu vết tin đã mở — **TÍN HIỆU, không còn là thứ để bày ra màn hình**.
 *
 * Trước đây store này nuôi dải "Xem gần đây" nên phải giữ cả tiêu đề, giá và ảnh để vẽ lại
 * mà không bắn N request. Dải đó đã bị thay bằng "Gợi ý cho bạn", và người dùng không còn
 * nhìn thấy lịch sử xem của mình ở đâu nữa — nó chỉ chảy vào bộ xếp hạng (`queries/suggested`).
 *
 * Vì thế ba trường hiển thị bị bỏ, đổi lấy hai trường bộ xếp hạng thật sự cần: `categoryId`
 * (tín hiệu chính) và `province` (để xếp tin cùng tỉnh lên trước).
 *
 * Vẫn ở MÁY, không gửi lên server. Đây là dữ liệu hành vi: đẩy lên BE phải hỏi người dùng
 * trước, và toàn bộ việc xếp hạng làm được tại chỗ nên chưa có lý do gì để hỏi.
 *
 * Khai lại type thay vì import `Listing` từ `@/api/db`: store là lá, không được import layer
 * khác (cùng lý do với `auth.ts`).
 */
export type RecentListing = {
  id: string;
  /**
   * Hai trường TUỲ CHỌN vì bản trước không ghi chúng.
   *
   * Không vứt bản ghi cũ: thiếu danh mục thì chúng không cộng điểm cho danh mục nào được,
   * nhưng `id` vẫn còn giá trị — bộ gợi ý dùng nó để KHÔNG gợi lại tin người dùng vừa xem.
   * Vứt đi là mất luôn vế đó, đổi lấy không được gì.
   */
  categoryId?: string;
  province?: string;
};

/** 20 mục: không còn là một dải để lướt mà là mẫu hành vi — mẫu càng rộng thì gợi ý càng đỡ lệch. */
const MAX_RECENT = 20;

type RecentState = {
  items: RecentListing[];
  record: (item: RecentListing) => void;
  clear: () => void;
};

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      items: [],
      // Xem lại tin cũ thì đưa nó lên đầu chứ không nhân bản — thứ tự CHÍNH LÀ độ mới, và bộ
      // xếp hạng đọc thứ tự đó để tin xem gần đây cân nặng hơn tin xem tuần trước.
      record: (item) =>
        set((s) => ({
          items: [item, ...s.items.filter((x) => x.id !== item.id)].slice(0, MAX_RECENT),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'ghim-recent',
      storage: createJSONStorage(() => AsyncStorage),
      /*
       * Chuẩn hoá lúc đọc đĩa, không migrate bằng `version`: bản ghi cũ mang thừa ba trường
       * hiển thị và thiếu hai trường tín hiệu, mà cả hai chuyện đó xử được bằng một lượt map.
       *
       * Mảng rác (app cũ, ghi dở) thì vứt: rỗng là trạng thái hợp lệ, còn một mảng sai kiểu
       * sẽ nổ ngay ở `.filter` của lần `record` kế tiếp.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!Array.isArray(state.items)) {
          useRecentStore.setState({ items: [] });
          return;
        }
        useRecentStore.setState({
          items: state.items
            .filter((x): x is RecentListing => typeof x?.id === 'string')
            .map(({ id, categoryId, province }) => ({ id, categoryId, province })),
        });
      },
    },
  ),
);

/* --------------------- selector: đọc từng mảnh, không lấy cả store --------------------- */

export const useRecentListings = () => useRecentStore((s) => s.items);
export const useRecordRecent = () => useRecentStore((s) => s.record);
