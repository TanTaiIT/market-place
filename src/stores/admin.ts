import { create } from 'zustand';

/**
 * Bộ lọc trường của bàn quản trị. Ở store chứ không phải `useState` từng màn vì nó sống lâu
 * hơn một màn hình: chọn "Cao Thắng" ở tổng quan rồi mở Duyệt tin thì vẫn phải là Cao Thắng,
 * nếu không quản trị duyệt nhầm tin của trường khác.
 *
 * Không `persist`: đây là bối cảnh của một phiên làm việc, mở app hôm sau nên về lại "tất cả"
 * thay vì im lặng giấu mất tin của trường còn lại.
 */
type AdminFilterState = {
  /** `'all'` = mọi trường; còn lại là tên trường trong `ModListing.school`. */
  school: string;
  setSchool: (school: string) => void;
};

const useAdminFilterStore = create<AdminFilterState>((set) => ({
  school: 'all',
  setSchool: (school) => set({ school }),
}));

export const useAdminSchool = () => useAdminFilterStore((s) => s.school);
export const useSetAdminSchool = () => useAdminFilterStore((s) => s.setSchool);
