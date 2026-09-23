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
  /**
   * MẪU MẶC ĐỊNH — dãy version của nó RỜI khỏi dãy của từng danh mục, nên không dùng chung key
   * với `categoryTemplate`. Vẫn nằm dưới prefix `categories` để một lần invalidate quét cả cụm.
   */
  defaultTemplate: (version?: number) =>
    ['categories', 'default-template', version ?? 'latest'] as const,
  /** Hạn mức đăng tin — đổi sau mỗi lần đăng hoặc mỗi lần một tin được duyệt. */
  listingQuota: () => ['listings', 'quota'] as const,
  listing: (id: string) => ['listing', id] as const,
  /**
   * Bản BÀN DUYỆT của một tin (mọi trạng thái, mọi trục). Khoá riêng: trộn với `listing(id)` là
   * một tin đã ẩn "sống lại" trên màn người mua ngay sau khi quản trị vừa mở nó từ báo cáo.
   */
  modListing: (id: string) => ['listing', id, 'moderation'] as const,
  /**
   * Bản CHÍNH CHỦ của một tin (mọi trạng thái) — khác `listing(id)` vốn là bản công khai.
   *
   * `id` đứng TRƯỚC 'mine' để `listing(id)` thành prefix của nó: mọi lượt invalidate sẵn có
   * (xoá tin, gia hạn, đánh dấu đã bán) tự phủ luôn bản này, không phải thêm một dòng ở từng
   * mutation — và không ai quên dòng đó ở mutation viết sau.
   */
  myListing: (id: string) => ['listing', id, 'mine'] as const,
  /** Không nằm dưới prefix `listings()`: gợi ý gắn với MỘT tin, đăng tin mới không làm nó sai. */
  listingSuggestions: (id: string) => ['listing', id, 'suggestions'] as const,
  /**
   * Dải "Gợi ý cho bạn" ở trang chủ. `signals` là tín hiệu đã chốt ở máy (xem `queries/suggested`).
   *
   * Cũng đứng ngoài prefix `listings()`, nhưng vì lý do khác `listingSuggestions`: dải này đọc
   * theo GU người dùng, nên một lượt đăng tin hay một lượt duyệt tin không làm nó sai — quét
   * nó cùng cụm `listings` là ném đi một câu trả lời vẫn còn đúng.
   */
  suggested: (signals: string) => ['suggested', signals] as const,
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
      f.ward ?? '',
      f.orgId ?? '',
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
  // Cả hai key mang `activeOrgId`: dữ liệu scope theo `X-Org-Id`, thiếu slug trong key thì
  // đổi tổ chức xong vẫn đọc trúng cache của tổ chức cũ.
  joinRequestQueue: (orgId: string, status: string) =>
    ['join-requests', 'queue', orgId, status] as const,
  /** Danh bạ thành viên. Theo slug vì đổi tổ chức là đổi hẳn tập người, không phải lọc lại. */
  orgMembers: (orgId: string) => ['orgs', 'members', orgId] as const,
  /**
   * Người phụ trách một org. Khoá theo `id` chứ không `slug`: endpoint nhận id, và slug thì
   * đổi được (`PATCH /:id/slug`) — bám vào nó là cache mồ côi sau mỗi lần đổi tên.
   */
  orgManagers: (orgId: string) => ['orgs', 'managers', orgId] as const,

  /*
   * Bàn quản trị. Mọi thao tác duyệt đều đổi nhiều mặt cùng lúc (hàng đợi, bảng tin, thẻ số),
   * nên `adminRoot()` là prefix để quét cả cụm sau mỗi mutation thay vì liệt kê từng key.
   */
  adminRoot: () => ['admin'] as const,
  /*
   * Bốn key dưới đây mang `orgId` vì dữ liệu của chúng scope theo `X-Org-Id` — cùng lý do
   * đã ghi ở `joinRequestQueue`/`orgMembers`. Thiếu slug thì master bấm "Thao tác trong" sang tổ
   * chức khác vẫn đọc trúng cache của tổ chức cũ: thẻ số, hàng đợi và báo cáo của nơi khác hiện
   * dưới tên nơi này, và không có gì trên màn hình nói ra điều đó.
   */
  adminOverview: (orgId: string) => ['admin', 'overview', orgId] as const,
  adminActivity: (orgId: string) => ['admin', 'activity', orgId] as const,
  /** `category`/`q` là bộ lọc SERVER của màn Tin đăng — một tổ hợp lọc là một danh sách trang riêng. */
  adminListings: (orgId: string, status: string, category = 'all', q = '') =>
    ['admin', 'listings', orgId, status, category, q] as const,
  adminPublicQueue: (status: string) => ['admin', 'public-queue', status] as const,
  adminCoverage: () => ['admin', 'coverage'] as const,
  adminPublicOverview: () => ['admin', 'public-overview'] as const,
  /**
   * Bàn của master. Nằm trong cụm `admin` để một lượt duyệt tin quét luôn nó, nhưng KHÔNG mang
   * `orgId` — số liệu gộp mọi tổ chức, không đổi theo tổ chức đang chọn.
   */
  systemMetrics: () => ['admin', 'system-metrics'] as const,
  // Ngoài cụm `admin` vì nó là quyền của NGƯỜI, không phải dữ liệu của bàn quản trị: một lượt
  // duyệt tin quét sạch `adminRoot()`, mà quyền thì không đổi theo lượt duyệt nào cả.
  myGrants: () => ['me', 'grants'] as const,
  adminReports: (orgId: string) => ['admin', 'reports', orgId] as const,
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
  adminNotices: (orgId: string) => ['admin', 'notices', orgId] as const,
  adminNoticesRoot: () => ['admin', 'notices'] as const,
  /** Cụm cấm: từ điển toàn hệ thống, không có tham số nào để lọc. */
  adminBannedPhrases: () => ['admin', 'banned-phrases'] as const,
  /** Catalog gói tin của master — gồm cả gói nháp, khác catalog công khai trên bảng tin. */
  adminProducts: () => ['admin', 'listing-products'] as const,
  /** `days` nằm trong key: đổi cửa sổ thống kê là hỏi BE một câu khác, không phải lọc lại. */
  adminPostingStats: (days: number) => ['admin', 'posting-stats', days] as const,
  /**
   * Báo cáo đăng tin. Cả ba tham số nằm trong key: đổi độ mịn hay đổi khoảng là HỎI BE MỘT CÂU
   * KHÁC, không phải lọc lại dữ liệu cũ — gộp chung một key sẽ hiện số của tháng lên trục ngày.
   */
  // `orgId` đứng đầu: cùng độ mịn nhưng của HAI nhóm khác nhau (hoặc của cả sàn với master
  // chưa chọn org) là hai báo cáo khác — đổi tổ chức xong mà vẫn hiện số cũ là số sai.
  adminListingReport: (orgId: string, granularity: string, from?: string, to?: string) =>
    ['admin', 'listing-report', orgId, granularity, from ?? '', to ?? ''] as const,
  /** Báo cáo con thứ hai — khoá RIÊNG, cùng khuôn tham số với báo cáo tin đăng. */
  adminUserReport: (orgId: string, granularity: string, from?: string, to?: string) =>
    ['admin', 'user-report', orgId, granularity, from ?? '', to ?? ''] as const,
  /** Từ điển field dùng chung — nguồn của bộ chọn field khi soạn template. */
  fieldDefinitions: () => ['admin', 'field-definitions'] as const,

  /*
   * Ý kiến của tổ chức xã hội (cụm TẠM THỜI — công thức gỡ ở `@/api/legal`).
   *
   * Hàng đợi duyệt đứng NGOÀI cụm `admin`: một lượt duyệt tin quét sạch `adminRoot()`, mà hàng
   * đợi này thì không đổi theo lượt duyệt tin nào cả. Nó cũng KHÔNG mang `orgId` — ý kiến gửi
   * cho pháp nhân vận hành sàn, không cho một nhóm nào (xem `social-feedback.model.ts`).
   */
  socialFeedback: () => ['social-feedback'] as const,
  socialFeedbackQueueRoot: () => ['social-feedback', 'queue'] as const,
  socialFeedbackQueue: (status: string) => ['social-feedback', 'queue', status] as const,

  /**
   * Kênh hỗ trợ. `supportRoot` là prefix để một lần invalidate quét cả hàng đợi lẫn từng
   * luồng — trả lời một luồng làm đổi cả hai.
   *
   * KHÔNG nằm dưới `adminRoot`: luồng của chính người dùng là dữ liệu của họ, không phải dữ
   * liệu quản trị, và mọi mutation của bàn quản trị đang quét sạch `adminRoot()`.
   *
   * `supportThread` không mang `userId`: BE lấy người gọi từ access token nên id ở đây là một
   * tham số giả, không chọn ra câu trả lời nào. Đổi tài khoản thì `qc.clear()` lúc đăng xuất
   * đã dọn sạch cache.
   */
  supportRoot: () => ['support'] as const,
  supportThread: () => ['support', 'me'] as const,
  supportQueue: (waiting: boolean) => ['support', 'queue', waiting] as const,
  supportThreadDetail: (id: string) => ['support', 'thread', id] as const,
};
