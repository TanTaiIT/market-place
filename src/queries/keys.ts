export const qk = {
  /** Cũng là prefix của `listings(cat)` + `myListings()` — invalidate key này là quét cả cụm. */
  listings: () => ['listings'] as const,
  listingsByCategory: (categoryId: string) => ['listings', 'cat', categoryId] as const,
  myListings: () => ['listings', 'mine'] as const,
  categories: () => ['categories'] as const,
  listing: (id: string) => ['listing', id] as const,
  /** Tỉnh nằm trong key: đổi tỉnh là một tập kết quả khác, không phải cùng một truy vấn. */
  search: (q: string, province: string | null) => ['search', q, province ?? ''] as const,
  /** Prefix thuần: không query nào dùng trực tiếp, chỉ để invalidate cả cụm `saved`. */
  savedRoot: () => ['saved'] as const,
  savedIds: () => ['saved', 'ids'] as const,
  savedListings: () => ['saved', 'listings'] as const,
  conversations: () => ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['conversation', conversationId, 'messages'] as const,
  notifications: () => ['notifications'] as const,
  profile: () => ['profile'] as const,

  // Từ điển hành chính. Xã tách theo tỉnh để đổi tỉnh là một cache entry khác, không phải
  // ghi đè lên danh sách xã của tỉnh trước đó.
  provinces: () => ['locations', 'provinces'] as const,
  wards: (province: string | null) => ['locations', 'wards', province ?? ''] as const,

  /*
   * Bàn quản trị. Mọi thao tác duyệt đều đổi nhiều mặt cùng lúc (hàng đợi, bảng tin, thẻ số),
   * nên `adminRoot()` là prefix để quét cả cụm sau mỗi mutation thay vì liệt kê từng key.
   */
  adminRoot: () => ['admin'] as const,
  adminOverview: () => ['admin', 'overview'] as const,
  adminActivity: () => ['admin', 'activity'] as const,
  adminListings: (status: string) => ['admin', 'listings', status] as const,
  adminReports: () => ['admin', 'reports'] as const,
  adminUsers: (school: string) => ['admin', 'users', school] as const,
  adminSchools: () => ['admin', 'schools'] as const,
  adminSchoolLinks: () => ['admin', 'school-links'] as const,
  adminCategories: (school: string) => ['admin', 'categories', school] as const,
  adminNotices: () => ['admin', 'notices'] as const,
  adminRules: () => ['admin', 'rules'] as const,
  adminLimits: () => ['admin', 'limits'] as const,
};
