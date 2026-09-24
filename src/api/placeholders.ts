/**
 * NỘI DUNG TĨNH CHỜ BE — hardcode có chủ ý, gom một chỗ để gỡ một lượt.
 *
 * Còn lại ba nhóm, và chúng khác hẳn nhau về mức độ nguy hiểm:
 *
 * 1. `SHIP` — trang trí trên thẻ tin. Bịa được vì nó không phải bằng chứng về người bán.
 * 2. `PROMOS` / `BANNERS` — khối quảng bá, chờ hệ chiến dịch. `PROMOS` hứa CON SỐ cụ thể
 *    ("miễn phí tháng 9", "-30%") mà không có gì thực thi phía sau — đó là rủi ro nghiệp vụ,
 *    không phải nợ kỹ thuật.
 * Mọi `grad` dưới đây theo cùng một luật với `G.brand`: ĐẬM ở chặng đầu, nhạt dần về chặng
 * sau. Không phải sở thích — các khối này mang chữ TRẮNG, và banner còn mang một nút KÍNH
 * (`bannerCta` dùng `glassRaise` + `glassLine`). Đo bằng độ sáng cảm nhận: hero cũ ở L=0.40
 * thì mặt kính đọc ra "màu nhạt hơn" thay vì "vật liệu"; ngưỡng dùng được là quanh L=0.30.
 * Bản trước hai dải promo ở 0.37 và banner cam ở 0.37 — đều sát vùng hỏng đó.
 *
 * 3. `GUIDE_STEPS` — chữ giới thiệu sản phẩm. Không phải dữ liệu, và sẽ không bao
 *    giờ đến từ DB trừ khi marketing cần tự sửa mà không build lại.
 *
 * ĐÃ GỠ HẲN (không phải chuyển đi đâu): sao đánh giá, số giao dịch, % giảm giá, giá cũ gạch
 * ngang, khoảng cách. Chúng là thứ người mua dựa vào để chọn nhắn cho ai — bịa số trang trí
 * là một chuyện, bịa bằng chứng về độ tin cậy của một con người là chuyện khác.
 *
 * Gỡ tiếp thế nào: `grep -rn "placeholders" src app` ra đúng danh sách call-site.
 */

/*
 * BỘ SỐ BỊA ĐÃ HẾT SẠCH — không còn con số nào trên thẻ tin do máy nghĩ ra.
 *
 * Sao đánh giá, số giao dịch, % giảm giá, giá cũ gạch ngang và khoảng cách bị gỡ trước, vì
 * chúng là thứ người mua DỰA VÀO ĐỂ QUYẾT ĐỊNH nhắn cho ai. "Giao tận nơi" là cái cuối, và nó
 * sống lâu nhất vì trông vô hại nhất — nhưng nó suy từ hash của id, nghĩa là nói với người mua
 * một điều về người bán mà chính người bán chưa hề nói. Giờ nó là field `canDeliver` thật, do
 * người đăng tự bật.
 *
 * Bịa một con số trang trí là một chuyện; bịa bằng chứng đáng tin cậy về người bán là chuyện
 * khác. File này chỉ còn giữ những thứ thuộc vế đầu.
 */
/** TODO(be): chưa có hệ khuyến mãi/chiến dịch. Banner "Đang diễn ra" ở màn Khám phá. */
export const PROMOS = [
  {
    id: 'p1',
    title: 'Đăng tin miễn phí cả tháng 9',
    note: 'Không giới hạn số tin',
    big: '0đ',
    grad: ['#0F6B49', '#35C077'] as const,
  },
  {
    id: 'p2',
    title: 'Tuần lễ sách cũ khoá 12',
    note: 'Nhường lại cho khoá dưới',
    big: '-30%',
    grad: ['#C2470F', '#FF9A5B'] as const,
  },
] as const;

/**
 * TODO(be): chưa có hệ quảng cáo/chiến dịch. Khối banner lớn giữa trang chủ — thế chỗ
 * danh sách tin (bảng tin giờ nằm sau tìm kiếm/danh mục). Mỗi banner một mảng gradient
 * full bề ngang kiểu "Bạn muốn cho thuê xe" của Mioto, bấm vào đi thẳng tới hành động.
 *
 * `authMessage`: banner dẫn tới hành động cần đăng nhập thì mang theo lời mời của
 * chính nó — cùng cơ chế `requireAuth` mọi nút khác đang dùng.
 */
export type Banner = {
  id: string;
  icon: string;
  title: string;
  body: string;
  cta: string;
  /** Đường dẫn expo-router mà banner dẫn tới. */
  route: string;
  /** Có mặt = hành động cần đăng nhập; chuỗi là lời mời hiện trên cổng `requireAuth`. */
  authMessage?: string;
  grad: readonly [string, string];
};

export const BANNERS: readonly Banner[] = [
  {
    id: 'b1',
    icon: '📌',
    title: 'Có đồ không dùng tới?',
    body: 'Chụp một tấm ảnh, đặt giá, ghim lên bảng tin trường — người mua ở ngay lớp bên cạnh.',
    cta: 'Đăng tin ngay',
    route: '/post',
    authMessage: 'Đăng nhập để đăng tin',
    grad: ['#137A52', '#3ECD7F'] as const,
  },
  {
    id: 'b2',
    icon: '🏫',
    title: 'Trường bạn đã có bảng tin chưa?',
    body: 'Tìm nhóm của trường để xem tin nội bộ — chỉ người cùng trường thấy nhau, giao dịch yên tâm hơn.',
    cta: 'Tìm nhóm của trường',
    route: '/join-org',
    authMessage: 'Đăng nhập để vào nhóm',
    grad: ['#1B4FA8', '#5BA8FF'] as const,
  },
  {
    id: 'b3',
    icon: '🔎',
    title: 'Đang cần tìm món gì đó?',
    body: 'Lọc theo danh mục, khu vực và khoảng giá — vài chạm là ra đúng món trong tầm tiền.',
    cta: 'Tìm tin ngay',
    route: '/search',
    grad: ['#C2470F', '#FF9A5B'] as const,
  },
];

/**
 * Dải "Ghim hoạt động thế nào" — các bước từ đăng tin đến chốt kèo, chữ tĩnh giới thiệu
 * hệ thống cho người mới. Mỗi bước một thẻ cuộn ngang, số bước là thứ tự trong mảng.
 */
export const GUIDE_STEPS = [
  {
    id: 'g1',
    icon: '📸',
    title: 'Chụp và đăng trong 30 giây',
    body: 'Chọn ảnh, đặt giá, chọn danh mục — không cần mô tả dài dòng. Tin của bạn lên bảng ngay khi được duyệt.',
  },
  {
    id: 'g2',
    icon: '🛡️',
    title: 'Tin nào cũng qua kiểm duyệt',
    body: 'Quản trị nhóm duyệt từng tin trước khi hiện lên bảng. Không tin rác, không lừa đảo, không nội dung xấu.',
  },
  {
    id: 'g3',
    icon: '💬',
    title: 'Nhắn tin ngay trong app',
    body: 'Hỏi giá, trả giá, hẹn giờ — mọi trao đổi nằm trong khung chat, không cần cho số điện thoại nếu không muốn.',
  },
  {
    id: 'g4',
    icon: '🤝',
    title: 'Gặp mặt rồi mới trả tiền',
    body: 'Hẹn ở cổng trường hay căng tin, xem hàng tận tay. Không cọc trước, không ship xa, không rủi ro.',
  },
] as const;
