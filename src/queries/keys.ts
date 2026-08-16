import type { SearchFilter } from '@/api/db';

export const qk = {
  /** Cũng là prefix của `listings(cat)` + `myListings()` — invalidate key này là quét cả cụm. */
  listings: () => ['listings'] as const,
  listingsByCategory: (categoryId: string) => ['listings', 'cat', categoryId] as const,
  myListings: () => ['listings', 'mine'] as const,
  categories: () => ['categories'] as const,
  /** Hạn mức đăng tin — đổi sau mỗi lần đăng hoặc mỗi lần một tin được duyệt. */
  listingQuota: () => ['listings', 'quota'] as const,
  listing: (id: string) => ['listing', id] as const,
  /** Không nằm dưới prefix `listings()`: gợi ý gắn với MỘT tin, đăng tin mới không làm nó sai. */
  listingSuggestions: (id: string) => ['listing', id, 'suggestions'] as const,
  /**
   * Cả bộ lọc nằm trong key: mỗi tổ hợp là một tập kết quả khác, không phải cùng một truy vấn.
   * Liệt kê từng field theo thứ tự cố định thay vì `JSON.stringify` — thứ tự khoá của object
   * không có gì bảo đảm, và hai key khác chuỗi cho cùng một bộ lọc là hai lần gọi mạng.
   */
  search: (f: SearchFilter) =>
    ['search', f.q, f.province ?? '', f.categoryId ?? '', f.minPrice ?? '', f.maxPrice ?? ''] as const,
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
   * Tổ chức. `orgLookup` mang cả từ khoá vì mỗi từ khoá là một tập kết quả khác — dùng chung
   * một key sẽ khiến kết quả của lần gõ trước hiện ra dưới từ khoá sau.
   */
  myOrgs: () => ['orgs', 'mine'] as const,
  orgLookup: (q: string) => ['orgs', 'lookup', q] as const,
  /** Prefix của cụm đơn xin tham gia — quét cả "đơn của tôi" lẫn hàng đợi của người duyệt. */
  joinRequestsRoot: () => ['join-requests'] as const,
  myJoinRequests: () => ['join-requests', 'mine'] as const,
  // Cả hai key mang `activeOrgSlug`: dữ liệu scope theo `X-Org-Slug`, thiếu slug trong key thì
  // đổi tổ chức xong vẫn đọc trúng cache của tổ chức cũ.
  joinRequestQueue: (orgSlug: string, status: string) =>
    ['join-requests', 'queue', orgSlug, status] as const,
  orgUnits: (orgSlug: string) => ['orgs', 'units', orgSlug] as const,

  /*
   * Bàn quản trị. Mọi thao tác duyệt đều đổi nhiều mặt cùng lúc (hàng đợi, bảng tin, thẻ số),
   * nên `adminRoot()` là prefix để quét cả cụm sau mỗi mutation thay vì liệt kê từng key.
   */
  adminRoot: () => ['admin'] as const,
  adminOverview: () => ['admin', 'overview'] as const,
  adminActivity: () => ['admin', 'activity'] as const,
  adminListings: (status: string) => ['admin', 'listings', status] as const,
  adminPublicQueue: (status: string) => ['admin', 'public-queue', status] as const,
  adminCoverage: () => ['admin', 'coverage'] as const,
  // Ngoài cụm `admin` vì nó là quyền của NGƯỜI, không phải dữ liệu của bàn quản trị: một lượt
  // duyệt tin quét sạch `adminRoot()`, mà quyền thì không đổi theo lượt duyệt nào cả.
  myGrants: () => ['me', 'grants'] as const,
  adminReports: () => ['admin', 'reports'] as const,
  adminUsers: (school: string) => ['admin', 'users', school] as const,
  adminSchools: () => ['admin', 'schools'] as const,
  adminSchoolLinks: () => ['admin', 'school-links'] as const,
  adminCategories: (school: string) => ['admin', 'categories', school] as const,
  adminNotices: () => ['admin', 'notices'] as const,
  adminRules: () => ['admin', 'rules'] as const,
  adminLimits: () => ['admin', 'limits'] as const,
};
