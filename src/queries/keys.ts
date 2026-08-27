import type { SearchFilter } from '@/api/db';

export const qk = {
  /** Cũng là prefix của `listings(cat)` + `myListings()` — invalidate key này là quét cả cụm. */
  listings: () => ['listings'] as const,
  listingsByCategory: (categoryId: string) => ['listings', 'cat', categoryId] as const,
  myListings: () => ['listings', 'mine'] as const,
  categories: () => ['categories'] as const,
  /**
   * Template của MỘT danh mục. Nằm dưới prefix `categories` vì nó đổi cùng nhịp với từ điển
   * danh mục (cả hai chỉ đổi khi master seed lại), nên một lần invalidate quét được cả cụm.
   *
   * `version` nằm TRONG key: form sửa tin ghim bản cũ, form đăng tin lấy bản mới nhất — hai
   * câu trả lời khác nhau cho cùng một danh mục, dùng chung key là bên này đọc cache bên kia.
   */
  categoryTemplate: (categoryId: string, version?: number) =>
    ['categories', 'template', categoryId, version ?? 'latest'] as const,
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
    [
      'search',
      f.q,
      f.province ?? '',
      f.categoryId ?? '',
      f.minPrice ?? '',
      f.maxPrice ?? '',
      // Khoá động nên KHÔNG liệt kê tay được như các field trên. `JSON.stringify` ở đây an
      // toàn vì thứ tự khoá của `attrs` do người dùng bấm theo thứ tự field trong template —
      // ổn định trong một phiên, và có lệch thì hậu quả chỉ là một lần gọi mạng thừa.
      JSON.stringify(f.attrs),
    ] as const,
  /** Prefix thuần: không query nào dùng trực tiếp, chỉ để invalidate cả cụm `saved`. */
  savedRoot: () => ['saved'] as const,
  savedIds: () => ['saved', 'ids'] as const,
  savedListings: () => ['saved', 'listings'] as const,
  conversations: () => ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['conversation', conversationId, 'messages'] as const,
  notifications: () => ['notifications'] as const,
  profile: () => ['profile'] as const,

  /*
   * Người bán. Cố tình đứng NGOÀI cụm `profile`: `profile()` là hồ sơ của chính mình và đăng
   * một tin làm lệch nó, còn hồ sơ người khác thì không — mà `invalidateQueries` khớp theo
   * prefix, nên nhét vào đó là mỗi lần đăng tin lại quét sạch hồ sơ của mọi người bán đã xem.
   */
  sellerProfile: (id: string) => ['seller', id] as const,
  sellerListings: (id: string) => ['seller', id, 'listings'] as const,

  // Từ điển hành chính. Xã tách theo tỉnh để đổi tỉnh là một cache entry khác, không phải
  // ghi đè lên danh sách xã của tỉnh trước đó.
  provinces: () => ['locations', 'provinces'] as const,
  wards: (province: string | null) => ['locations', 'wards', province ?? ''] as const,

  /*
   * Tổ chức. `orgByCode` mang cả mã vì mỗi mã là một tổ chức khác — dùng chung một key sẽ khiến
   * thẻ xem trước của mã gõ trước hiện ra dưới mã sau, đúng lúc người dùng cần chắc chắn nhất.
   */
  myOrgs: () => ['orgs', 'mine'] as const,
  /**
   * Bảng tổ chức của master (`GET /organizations`). Mang cả bộ lọc trong key: mỗi bộ lọc là một
   * câu trả lời khác của BE, gộp chung một key thì gõ tìm xong sẽ thấy kết quả của lượt trước.
   */
  allOrgs: (q: string, status: string) => ['orgs', 'all', q, status] as const,
  /** Prefix để mutation quét mọi bộ lọc — xem `useSetOrganizationStatus`. */
  allOrgsRoot: () => ['orgs', 'all'] as const,
  orgByCode: (code: string) => ['orgs', 'by-code', code] as const,
  /** Tìm nhóm công khai. Từ khoá nằm trong key: mỗi từ khoá là một tập kết quả khác. */
  orgDiscover: (q: string) => ['orgs', 'discover', q] as const,
  orgProfile: (slug: string) => ['orgs', 'profile', slug] as const,
  /** Danh bạ + tin của MỘT nhóm đang mở hồ sơ, tách khỏi cụm scope theo org đang thao tác. */
  orgPeek: (slug: string, take: number) => ['orgs', 'peek', slug, take] as const,
  /** Prefix của cụm đơn xin tham gia — quét cả "đơn của tôi" lẫn hàng đợi của người duyệt. */
  joinRequestsRoot: () => ['join-requests'] as const,
  myJoinRequests: () => ['join-requests', 'mine'] as const,
  // Cả hai key mang `activeOrgSlug`: dữ liệu scope theo `X-Org-Slug`, thiếu slug trong key thì
  // đổi tổ chức xong vẫn đọc trúng cache của tổ chức cũ.
  joinRequestQueue: (orgSlug: string, status: string) =>
    ['join-requests', 'queue', orgSlug, status] as const,
  orgUnits: (orgSlug: string) => ['orgs', 'units', orgSlug] as const,
  /** Danh bạ thành viên. Theo slug vì đổi tổ chức là đổi hẳn tập người, không phải lọc lại. */
  orgMembers: (orgSlug: string) => ['orgs', 'members', orgSlug] as const,
  /** Mang cả slug đang gõ, cùng lý do với `orgByCode` — mỗi slug là một câu trả lời khác. */
  slugAvailability: (slug: string) => ['orgs', 'slug-check', slug] as const,

  /*
   * Bàn quản trị. Mọi thao tác duyệt đều đổi nhiều mặt cùng lúc (hàng đợi, bảng tin, thẻ số),
   * nên `adminRoot()` là prefix để quét cả cụm sau mỗi mutation thay vì liệt kê từng key.
   */
  adminRoot: () => ['admin'] as const,
  /*
   * Bốn key dưới đây mang `orgSlug` vì dữ liệu của chúng scope theo `X-Org-Slug` — cùng lý do
   * đã ghi ở `joinRequestQueue`/`orgUnits`. Thiếu slug thì master bấm "Thao tác trong" sang tổ
   * chức khác vẫn đọc trúng cache của tổ chức cũ: thẻ số, hàng đợi và báo cáo của nơi khác hiện
   * dưới tên nơi này, và không có gì trên màn hình nói ra điều đó.
   */
  adminOverview: (orgSlug: string) => ['admin', 'overview', orgSlug] as const,
  adminActivity: (orgSlug: string) => ['admin', 'activity', orgSlug] as const,
  adminListings: (orgSlug: string, status: string) =>
    ['admin', 'listings', orgSlug, status] as const,
  adminPublicQueue: (status: string) => ['admin', 'public-queue', status] as const,
  adminCoverage: () => ['admin', 'coverage'] as const,
  adminPublicOverview: () => ['admin', 'public-overview'] as const,
  // Ngoài cụm `admin` vì nó là quyền của NGƯỜI, không phải dữ liệu của bàn quản trị: một lượt
  // duyệt tin quét sạch `adminRoot()`, mà quyền thì không đổi theo lượt duyệt nào cả.
  myGrants: () => ['me', 'grants'] as const,
  adminReports: (orgSlug: string) => ['admin', 'reports', orgSlug] as const,
  /** Prefix cho mutation đứng ngoài bàn quản trị (người dùng thường gửi báo cáo). */
  adminReportsRoot: () => ['admin', 'reports'] as const,
  /**
   * Bảng người dùng toàn hệ thống. Mang cả bộ lọc trong key, cùng lý do với `allOrgs`: mỗi bộ
   * lọc là một câu trả lời khác của BE, gộp một key thì gõ tìm xong sẽ thấy kết quả lượt trước.
   */
  adminUsers: (q: string, status: string) => ['admin', 'users', q, status] as const,
  /** Prefix để mutation quét mọi bộ lọc mà không phải đoán người dùng đang mở tổ hợp nào. */
  adminUsersRoot: () => ['admin', 'users'] as const,
  /** Không mang tên trường: danh mục là từ điển dùng chung toàn hệ thống, không thuộc tổ chức nào. */
  adminCategories: () => ['admin', 'categories'] as const,
  /** `scope=managed` đọc theo tổ chức đang thao tác, nên slug phải nằm trong key. */
  adminNotices: (orgSlug: string) => ['admin', 'notices', orgSlug] as const,
  adminNoticesRoot: () => ['admin', 'notices'] as const,
  /** Cụm cấm: từ điển toàn hệ thống, không có tham số nào để lọc. */
  adminBannedPhrases: () => ['admin', 'banned-phrases'] as const,
  /** Catalog gói tin của master — gồm cả gói nháp, khác catalog công khai trên bảng tin. */
  adminProducts: () => ['admin', 'listing-products'] as const,
  /** `days` nằm trong key: đổi cửa sổ thống kê là hỏi BE một câu khác, không phải lọc lại. */
  adminPostingStats: (days: number) => ['admin', 'posting-stats', days] as const,
  /** Từ điển field dùng chung — nguồn của bộ chọn field khi soạn template. */
  fieldDefinitions: () => ['admin', 'field-definitions'] as const,
};
