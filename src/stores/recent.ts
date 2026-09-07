import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * "Xem gần đây" của màn Khám phá — SNAPSHOT tại máy, không phải query.
 *
 * BE không có lịch sử xem (và không nên: đó là dữ liệu hành vi, gửi lên server phải hỏi
 * người dùng trước). Lưu nguyên mảnh hiển thị (tiêu đề, giá, ảnh) thay vì chỉ id: dải
 * "Xem gần đây" vẽ được ngay khi mở app, không bắn N request chỉ để dựng lại thumbnail.
 * Giá/tiêu đề vì thế có thể cũ vài ngày — chấp nhận được cho một dải gợi nhớ; bấm vào là
 * thấy bản thật.
 *
 * Khai lại type thay vì import `Listing` từ `@/api/db`: store là lá, không được import
 * layer khác (cùng lý do với `auth.ts`). `photo` khớp cấu trúc với `Grad` của theme.
 */
export type RecentListing = {
  id: string;
  title: string;
  price: string;
  photo: readonly [string, string];
  photoUrl?: string;
};

/** Dải chỉ là một hàng cuộn ngang — quá 10 mục thì mục cuối không ai lướt tới. */
const MAX_RECENT = 10;

type RecentState = {
  items: RecentListing[];
  record: (item: RecentListing) => void;
  clear: () => void;
};

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      items: [],
      // Xem lại tin cũ thì đưa nó lên đầu chứ không nhân bản — dải là "gần đây nhất trước".
      record: (item) =>
        set((s) => ({
          items: [item, ...s.items.filter((x) => x.id !== item.id)].slice(0, MAX_RECENT),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'ghim-recent',
      storage: createJSONStorage(() => AsyncStorage),
      // Bản ghi hỏng (app cũ, ghi dở) thì vứt: dải trống là trạng thái hợp lệ, còn một mảng
      // rác sẽ crash ngay ở `.filter` của lần `record` kế tiếp.
      onRehydrateStorage: () => (state) => {
        if (state && !Array.isArray(state.items)) useRecentStore.setState({ items: [] });
      },
    },
  ),
);

/* --------------------- selector: đọc từng mảnh, không lấy cả store --------------------- */

export const useRecentListings = () => useRecentStore((s) => s.items);
export const useRecordRecent = () => useRecentStore((s) => s.record);
