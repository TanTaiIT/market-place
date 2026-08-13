export const qk = {
  /** Cũng là prefix của `myListings()` — invalidate key này là quét cả hai. */
  listings: () => ['listings'] as const,
  myListings: () => ['listings', 'mine'] as const,
  listing: (id: string) => ['listing', id] as const,
  search: (q: string) => ['search', q] as const,
  /** Prefix thuần: không query nào dùng trực tiếp, chỉ để invalidate cả cụm `saved`. */
  savedRoot: () => ['saved'] as const,
  savedIds: () => ['saved', 'ids'] as const,
  savedListings: () => ['saved', 'listings'] as const,
  conversations: () => ['conversations'] as const,
  conversation: (id: number) => ['conversation', id] as const,
  notifications: () => ['notifications'] as const,
  profile: () => ['profile'] as const,

  /*
   * Bàn quản trị. Mọi thao tác duyệt đều đổi nhiều mặt cùng lúc (hàng đợi, bảng tin, thẻ số),
   * nên `adminRoot()` là prefix để quét cả cụm sau mỗi mutation thay vì liệt kê từng key.
   */
  adminRoot: () => ['admin'] as const,
  adminOverview: (school: string) => ['admin', 'overview', school] as const,
  adminListings: (school: string, status: string) => ['admin', 'listings', school, status] as const,
  adminReports: () => ['admin', 'reports'] as const,
  adminUsers: (school: string) => ['admin', 'users', school] as const,
  adminSchools: () => ['admin', 'schools'] as const,
  adminSchoolLinks: () => ['admin', 'school-links'] as const,
  adminCategories: (school: string) => ['admin', 'categories', school] as const,
  adminNotices: () => ['admin', 'notices'] as const,
  adminRules: () => ['admin', 'rules'] as const,
  adminLimits: () => ['admin', 'limits'] as const,
};
