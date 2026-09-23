/**
 * HƯỚNG DẪN SỬ DỤNG — nội dung, không phải giao diện.
 *
 * Tách khỏi màn hình đúng như `legal.ts`: đây là chữ nghĩa sẽ được sửa thường xuyên, và sửa
 * một câu không nên phải mở một file JSX.
 *
 * Mỗi mục là một CÂU HỎI người dùng thật sự hỏi, không phải tên một tính năng. "Vì sao tin của
 * tôi chưa hiện?" là thứ người ta gõ vào ô tìm; "Cơ chế kiểm duyệt" thì không.
 *
 * Nội dung bám đúng hành vi hệ thống đang chạy — thang phủ sóng ba bậc, luật uy tín, mã nhóm
 * kín. Sửa luật ở BE mà quên sửa ở đây thì hướng dẫn thành nguồn thông tin sai, tệ hơn là
 * không có hướng dẫn.
 */
export type GuideTopic = {
  id: string;
  icon: string;
  /** Câu hỏi của người dùng, không phải tên tính năng. */
  title: string;
  /** Mỗi phần tử một đoạn. Đoạn mở đầu `• ` được vẽ thành gạch đầu dòng. */
  body: readonly string[];
};

export const GUIDE_TOPICS: readonly GuideTopic[] = [
  {
    id: 'post',
    icon: '📌',
    title: 'Đăng một tin bán hàng',
    body: [
      'Bấm nút Đăng tin ở giữa thanh dưới, rồi điền theo bốn bước trên màn hình.',
      '• Ảnh: chọn tối đa 6 ảnh. Ảnh ĐẦU TIÊN là ảnh bìa hiện trên bảng tin, nên để tấm đẹp nhất lên đầu.',
      '• Giá: gõ số tiền. Để trống hoặc ghi 0 nếu bạn CHO TẶNG — tin sẽ mang băng rôn "Miễn phí" nổi trên ảnh.',
      '• Giao tận nơi: bật nếu bạn nhận mang hàng tới cho người mua. Đây là lời hứa của bạn với người mua, không phải dịch vụ của sàn.',
      '• Khu vực: chọn tỉnh và phường/xã. Người mua lọc theo đúng hai mục này để tìm hàng gần mình.',
      'Ảnh được tải lên ngay lúc bạn chọn, nên bấm Đăng gần như không phải chờ.',
    ],
  },
  {
    id: 'reach',
    icon: '👁',
    title: 'Ai nhìn thấy tin của tôi?',
    body: [
      'Khi đăng tin trong một nhóm, bạn chọn tin phủ tới đâu. Ba bậc, bậc sau bao bậc trước:',
      '• Chỉ trong nhóm — chỉ thành viên nhóm đọc được.',
      '• Ai cũng xem được — người ngoài cũng đọc được khi họ mở hồ sơ nhóm hoặc tìm kiếm. Chỉ có ở nhóm công khai.',
      '• Đăng lên sàn — tin lên cả bảng tin chung của toàn sàn.',
      'Tin "Đăng lên sàn" VẪN nằm trong bảng tin nhóm của bạn. Bạn không cần đăng hai lần.',
      'Ai duyệt tin cũng theo bậc: hai bậc đầu do quản trị nhóm duyệt, riêng "Đăng lên sàn" do người phụ trách danh mục ở tỉnh bạn duyệt.',
    ],
  },
  {
    id: 'pending',
    icon: '⏳',
    title: 'Vì sao tin của tôi chưa hiện?',
    body: [
      'Tin mới thường ở trạng thái "Chờ duyệt". Mở mục Tin đã đăng để xem trạng thái và lý do — mỗi tin chờ đều kèm một câu giải thích.',
      'Những lý do hay gặp:',
      '• Tài khoản còn mới. Mỗi tin được duyệt sạch sẽ nâng bậc uy tín; đủ bậc thì tin lên bảng ngay lúc đăng.',
      '• Giá lệch xa mức thường thấy của danh mục — kiểm lại đơn vị và số 0.',
      '• Tiêu đề trùng với một tin bạn vừa đăng trong 7 ngày.',
      '• Tiêu đề hoặc mô tả trông như gõ ngẫu nhiên. Viết rõ tên món đồ và vài dòng mô tả thật thì tin lên nhanh hơn nhiều.',
      '• Danh mục đó luôn qua người duyệt, không phụ thuộc uy tín.',
      'Tin bị từ chối cũng hiện lý do ở cùng chỗ, và bạn sửa rồi đăng lại được.',
    ],
  },
  {
    id: 'group',
    icon: '👥',
    title: 'Tham gia và đăng tin trong nhóm',
    body: [
      'Vào Nhóm của tôi › Tìm nhóm. Gõ TÊN nhóm để tìm nhóm công khai, hoặc gõ đúng MÃ nhóm nếu ai đó đã đưa mã cho bạn.',
      'Nhóm công khai: bấm Tham gia là vào ngay.',
      'Nhóm riêng tư: chỉ tìm được bằng mã, và đơn của bạn phải chờ quản trị nhóm duyệt.',
      'Đăng tin vào một nhóm: mở hồ sơ nhóm rồi bấm Đăng tin ngay trên đó — tin vào đúng nhóm đó, không phụ thuộc bạn đang xem nhóm nào khác.',
      'Nhóm nhiều tin thì dùng ô tìm ngay trên danh sách tin của nhóm.',
    ],
  },
  {
    id: 'buy',
    icon: '💬',
    title: 'Tìm hàng và liên hệ người bán',
    body: [
      'Ô tìm ở đầu bảng tin tìm theo tên món đồ. Bấm biểu tượng lọc để thu hẹp theo tỉnh/phường, danh mục, khoảng giá và các thuộc tính riêng của từng danh mục.',
      'Mở một tin rồi bấm Nhắn tin để hỏi người bán — hội thoại nằm ở tab Tin nhắn.',
      'Bấm hình trái tim trên thẻ tin để lưu. Tin đã lưu nằm ở Cá nhân › Tin đã lưu.',
      'Tin có băng rôn "Miễn phí" là hàng cho tặng; viên "Giao tận nơi" nghĩa là người bán nhận mang hàng tới.',
    ],
  },
  {
    id: 'report',
    icon: '⚑',
    title: 'Báo cáo tin hoặc người dùng',
    body: [
      'Mở tin cần báo rồi bấm biểu tượng cờ. Chọn đúng loại vi phạm và mô tả ngắn gọn.',
      'Báo cáo đi thẳng tới người duyệt của khu vực đó — quản trị nhóm với tin trong nhóm, người phụ trách danh mục với tin trên sàn.',
      'Chọn đúng loại giúp báo cáo được xử nhanh hơn: "Nghi lừa đảo" được xếp trước các loại còn lại.',
    ],
  },
  {
    id: 'account',
    icon: '⚙️',
    title: 'Tài khoản và cài đặt',
    body: [
      'Cá nhân › Cài đặt tài khoản: đổi tên, ảnh đại diện, số điện thoại và khu vực.',
      'Khu vực trong hồ sơ chỉ dùng để ĐIỀN SẴN khi bạn đăng tin mới — bạn vẫn sửa lại được ở từng tin, vì bán món đồ ở chỗ khác nơi mình ở là chuyện thường.',
      'Số điện thoại chỉ hiện với người khác nếu bạn bật "Hiện số điện thoại".',
    ],
  },
  {
    id: 'contact',
    icon: '🎧',
    title: 'Vẫn chưa giải quyết được?',
    body: [
      'Bấm nút hỗ trợ tròn ở góc màn hình để nhắn thẳng cho đội ngũ Ghim. Bạn nhận được trả lời ngay trong app.',
      'Kèm theo mã tin hoặc ảnh chụp màn hình thì câu trả lời sẽ nhanh và đúng hơn.',
    ],
  },
];
