/**
 * Nội dung chân trang pháp lý — **cụm TẠM THỜI, dựng để gỡ**.
 *
 * Toàn bộ chữ nghĩa của tính năng này nằm trong file này và không ở đâu khác: `SiteFooter`
 * chỉ còn phần bày, `app/legal/[slug]` chỉ còn phần đọc. Đó là lý do file nằm ở `src/api/`
 * cạnh `placeholders.ts` chứ không tách thành layer `constants/` mới — một nội dung, một chỗ,
 * một lần xoá.
 *
 * ## Gỡ tính năng này
 *
 * Xoá hẳn (không còn ai import):
 *
 * - `src/api/legal.ts` (file này) · `src/api/social-feedback.ts` · `src/queries/social-feedback.ts`
 * - `src/components/SiteFooter.tsx`
 * - thư mục `app/legal/` · `app/admin/social-feedback.tsx`
 *
 * Sửa (mỗi chỗ đúng một khối, đều có chữ "tạm thời" hoặc `@/api/legal` ngay tại dòng đó):
 *
 * 1. `app/(tabs)/feed.tsx`: bỏ `import { SiteFooter }` + `<SiteFooter />`, trả `paddingBottom`
 *    của `contentContainerStyle` về `32`.
 * 2. `app/_layout.tsx`: bỏ ba dòng `<Stack.Screen name="legal/…" />`.
 * 3. `src/queries/keys.ts`: bỏ ba key `socialFeedback*`.
 * 4. `src/components/AdminNav.tsx`: bỏ mục `/admin/social-feedback`.
 *
 * `npm run typecheck` sau đó là bằng chứng không còn call-site nào sót lại.
 *
 * Phần BE nằm ở repo `docs/market` và có công thức riêng trong
 * `src/features/social-feedback/social-feedback.model.ts`. Gỡ xong hai bên thì chạy
 * `npm run openapi:export` (market) rồi `npm run api:sync` (đây) để SDK hết bốn hàm mồ côi.
 *
 * ## Chữ ở đây CHƯA qua rà soát pháp lý
 *
 * Nó mô tả đúng những gì hệ thống đang làm (hàng đợi duyệt, nhóm/tổ chức, gặp trực tiếp,
 * không có cổng thanh toán) nên không có câu nào bịa. Nhưng mọi CON SỐ cam kết — 03 ngày
 * xác nhận, 15 ngày trả lời ở bài khiếu nại — là mốc theo Luật Bảo vệ quyền lợi người tiêu
 * dùng, không phải mốc do đội vận hành tự chọn. Ai ký chịu trách nhiệm website phải đọc lại
 * trước khi phát hành.
 */

// ── HẰNG SỐ PHÁP NHÂN ───────────────────────────────────────────

export const SITE = {
  brand: 'Groupnhadat.vn',
  hotline: '0987 308 562',
  support: 'admin@groupnhadat.vn',
  care: 'admin@groupnhadat.vn',
  company: 'CÔNG TY TNHH KINH DOANH PT DỊCH VỤ NVGGROUP',
  address: '25 Huỳnh Thúc Kháng, phường Bình Tân, thị xã Lagi, tỉnh Bình Thuận',
  phone: '0987 308 562',
  license:
    'Giấy ĐKKD số 3401262600 do Sở KHĐT TP Bình Thuận cấp lần đầu ngày 24/03/2025. ' +
    'Người chịu trách nhiệm quản lý website: Phạm Văn Dũng',
} as const;

/** Đầu mối bảo vệ quyền lợi người tiêu dùng — cặp nhãn/giá trị, thứ tự mảng là thứ tự hiện. */
export const CONSUMER: readonly (readonly [string, string])[] = [
  ['Họ và tên', 'Phạm Văn Dũng'],
  ['Chức vụ', 'Giám đốc công ty'],
  ['Mã số thuế', '3401262600'],
  ['Số điện thoại', '0987.308.562'],
];

/** Một ngày cho cả bộ: chúng được viết cùng một lượt, ghi mười ngày khác nhau là bịa. */
export const LEGAL_UPDATED = '13/09/2026';

// ── BÀI VIẾT ────────────────────────────────────────────────────

export type LegalArticle = {
  /** Đoạn URL — trang là `/legal/<slug>`. */
  slug: string;
  /** Vừa là nhãn ở chân trang, vừa là tiêu đề trang bài. Một chuỗi, không hai. */
  title: string;
  /**
   * Thân bài, mỗi phần tử một đoạn; đoạn mở đầu bằng `## ` là tiêu đề phụ.
   *
   * VẮNG MẶT = mục này chưa có bài → chân trang render thành chữ thường, không bấm được, và
   * `/legal/<slug>` trả về màn "chưa có bài". Một dòng bấm được mà không đi tới đâu là lời
   * hứa suông, và ở đúng khối pháp lý thì nó tệ hơn ở mọi khối khác.
   */
  body?: readonly string[];
  /**
   * Đi tới một MÀN RIÊNG thay vì trang bài — hai mục của cột "Hỗ trợ khách hàng".
   *
   * Chúng không phải bài đọc mà là hai việc làm được (gửi ý kiến / xem danh sách đã công bố),
   * nên chúng cần form và danh sách phân trang, không cần đoạn văn. Có `route` thì `body` thừa.
   */
  route?: string;
};

export const LEGAL_GROUPS: readonly { title: string; articles: readonly LegalArticle[] }[] = [
  {
    title: 'Hướng dẫn',
    articles: [
      {
        slug: 've-chung-toi',
        title: 'Về chúng tôi',
        body: [
          '## Chúng tôi là ai',
          `${SITE.brand} là sàn đăng tin do ${SITE.company} vận hành, trụ sở tại ${SITE.address}.`,
          'Chúng tôi cung cấp nơi để người có nhu cầu mua bán đăng thông tin và tự liên hệ với nhau. Chúng tôi KHÔNG phải một bên trong giao dịch: không giữ tiền, không vận chuyển, không bảo lãnh cho bất kỳ tin đăng nào.',
          '## Cách nền tảng hoạt động',
          'Mọi tin đăng đều qua kiểm duyệt trước khi hiển thị công khai. Tin thuộc một nhóm hoặc tổ chức thì do quản trị viên của nhóm đó duyệt; tin ở trục công khai do đội ngũ vận hành duyệt.',
          'Người dùng trao đổi trực tiếp trong khung chat của ứng dụng. Chúng tôi khuyến nghị gặp mặt, xem hàng rồi mới thanh toán.',
          '## Liên hệ',
          `Hotline ${SITE.hotline} — thư điện tử ${SITE.support}.`,
        ],
      },
      {
        slug: 'bao-gia-va-ho-tro',
        title: 'Báo giá và hỗ trợ',
        body: [
          '## Chi phí sử dụng',
          `Đăng tin trên ${SITE.brand} hiện miễn phí với tài khoản cá nhân. Khi có gói trả phí, biểu giá sẽ được công bố tại chính trang này trước ngày áp dụng.`,
          '## Dịch vụ dành cho tổ chức',
          'Trường học, doanh nghiệp và cộng đồng có thể yêu cầu mở một nhóm riêng: tin đăng trong nhóm chỉ thành viên nhóm nhìn thấy, và do quản trị viên của nhóm tự duyệt.',
          `Liên hệ hotline ${SITE.hotline} để được báo giá theo quy mô.`,
          '## Thời gian hỗ trợ',
          'Chúng tôi tiếp nhận yêu cầu qua hotline và thư điện tử trong giờ hành chính, từ thứ Hai đến thứ Bảy.',
        ],
      },
      {
        slug: 'cau-hoi-thuong-gap',
        title: 'Câu hỏi thường gặp',
        body: [
          '## Vì sao tin của tôi chưa hiển thị?',
          'Tin mới đăng ở trạng thái chờ duyệt và chỉ hiện lên sau khi được quản trị viên phụ trách duyệt. Bạn xem trạng thái từng tin ở mục "Tin đã đăng".',
          '## Vì sao tin của tôi bị từ chối?',
          'Lý do từ chối luôn được ghi kèm khi bạn mở tin đó. Nguyên nhân thường gặp: ảnh không phải của món hàng, thông tin liên hệ đặt trong tiêu đề, hoặc mặt hàng thuộc danh mục bị cấm — xem "Quy định đăng tin".',
          '## Tôi sửa hoặc xoá tin đã đăng thế nào?',
          'Vào "Tin đã đăng" rồi chạm vào tin cần sửa. Tin đang chờ duyệt vẫn sửa được; sau khi sửa, tin quay lại hàng đợi duyệt.',
          '## Tôi có phải trả tiền qua ứng dụng không?',
          'Không. Ứng dụng không giữ tiền và không có cổng thanh toán. Mọi yêu cầu chuyển khoản đặt cọc trước khi xem hàng đều đáng ngờ — hãy báo cho chúng tôi.',
        ],
      },
      {
        slug: 'gop-y-bao-loi',
        title: 'Góp ý báo lỗi',
        body: [
          '## Gửi góp ý',
          `Gặp lỗi hoặc có đề xuất, gửi về ${SITE.support}.`,
          'Mô tả càng cụ thể càng nhanh xử lý: bạn đang ở màn hình nào, thao tác gì, thấy gì trên màn hình, kèm ảnh chụp màn hình nếu có.',
          '## Báo tin đăng vi phạm',
          'Không cần gửi thư: mỗi tin đăng đều có nút báo cáo. Báo cáo đi thẳng tới quản trị viên phụ trách tin đó và được xử lý trước các kênh khác.',
          '## Báo lỗi bảo mật',
          `Nếu bạn phát hiện lỗ hổng, gửi riêng về ${SITE.support} kèm chữ "BẢO MẬT" ở tiêu đề và đừng công bố trước khi chúng tôi phản hồi.`,
        ],
      },
    ],
  },
  {
    title: 'Quy định',
    articles: [
      {
        slug: 'quy-dinh-dang-tin',
        title: 'Quy định đăng tin',
        body: [
          '## Nội dung bắt buộc',
          'Tin đăng phải mô tả đúng món hàng hoặc dịch vụ có thật, kèm ảnh do chính người đăng chụp hoặc có quyền sử dụng, và giá tính bằng đồng Việt Nam.',
          'Tiêu đề phải là tên món hàng. Không đặt số điện thoại, địa chỉ trang web hay lời quảng cáo trong tiêu đề.',
          '## Không được phép đăng',
          'Hàng cấm và hàng hạn chế kinh doanh theo pháp luật Việt Nam: vũ khí, chất gây nghiện, động vật hoang dã, thuốc kê đơn, tài liệu vi phạm bản quyền, giấy tờ tuỳ thân.',
          'Hàng giả, hàng nhái, hàng không rõ nguồn gốc. Dịch vụ tài chính, cho vay, đổi tiền. Nội dung khiêu dâm, bạo lực, hoặc xúc phạm cá nhân và tổ chức.',
          'Tin trùng lặp: cùng một món đăng nhiều lần để đẩy lên đầu danh sách.',
          '## Hậu quả khi vi phạm',
          'Tin vi phạm bị từ chối hoặc gỡ. Tài khoản vi phạm nhiều lần bị hạn chế đăng tin hoặc khoá. Hành vi vi phạm pháp luật được chuyển tới cơ quan có thẩm quyền.',
        ],
      },
      {
        slug: 'quy-che-hoat-dong',
        title: 'Quy chế hoạt động',
        body: [
          '## Phạm vi áp dụng',
          `Quy chế này áp dụng cho mọi người dùng ${SITE.brand}, gồm người đăng tin, người xem tin và quản trị viên nhóm.`,
          '## Vai trò của các bên',
          `${SITE.company} vận hành nền tảng, kiểm duyệt tin và xử lý báo cáo. Chúng tôi không sở hữu hàng hoá, không định giá và không tham gia vào thoả thuận giữa hai bên.`,
          'Người đăng tin chịu trách nhiệm về tính chính xác và tính hợp pháp của tin, cũng như về việc thực hiện giao dịch.',
          'Quản trị viên nhóm chịu trách nhiệm duyệt tin trong nhóm mình và xử lý báo cáo phát sinh trong nhóm.',
          '## Quy trình kiểm duyệt',
          'Tin mới vào hàng đợi duyệt. Người duyệt có thể chấp nhận, từ chối kèm lý do, hoặc chuyển tin sang hàng đợi phù hợp hơn. Người đăng nhận kết quả qua thông báo trong ứng dụng.',
          '## Tạm ngừng dịch vụ',
          'Chúng tôi có thể tạm ngừng một phần hoặc toàn bộ dịch vụ để bảo trì, và thông báo trước khi việc đó được lên lịch.',
        ],
      },
      {
        slug: 'dieu-khoan-thoa-thuan',
        title: 'Điều khoản thỏa thuận',
        body: [
          '## Chấp nhận điều khoản',
          `Bằng việc tạo tài khoản hoặc sử dụng ${SITE.brand}, bạn đồng ý với các điều khoản tại trang này và các quy định được dẫn chiếu trong đó.`,
          '## Tài khoản',
          'Mỗi người dùng chịu trách nhiệm giữ bí mật thông tin đăng nhập và chịu trách nhiệm cho mọi hoạt động phát sinh từ tài khoản của mình.',
          'Không tạo tài khoản bằng thông tin của người khác, không mua bán hoặc chuyển nhượng tài khoản.',
          '## Nội dung do người dùng đăng',
          'Bạn giữ quyền đối với nội dung mình đăng, đồng thời cho phép chúng tôi hiển thị, lưu trữ và tạo bản xem trước của nội dung đó nhằm mục đích vận hành nền tảng.',
          '## Giới hạn trách nhiệm',
          'Nền tảng được cung cấp trên cơ sở hiện có. Chúng tôi không bảo đảm về chất lượng, nguồn gốc hay tính pháp lý của hàng hoá trong tin đăng, và không chịu trách nhiệm cho thiệt hại phát sinh từ giao dịch giữa những người dùng với nhau.',
          '## Thay đổi điều khoản',
          'Điều khoản có thể được cập nhật. Ngày cập nhật gần nhất ghi ở đầu trang này; tiếp tục sử dụng dịch vụ sau ngày đó nghĩa là bạn chấp nhận bản mới.',
        ],
      },
      {
        slug: 'chinh-sach-bao-mat',
        title: 'Chính sách bảo mật',
        body: [
          '## Dữ liệu chúng tôi thu thập',
          'Thông tin bạn tự cung cấp: tên hiển thị, thư điện tử, số điện thoại, ảnh đại diện, khu vực, cùng nội dung tin đăng và tin nhắn của bạn.',
          'Thông tin phát sinh khi dùng: thời điểm truy cập, lượt xem tin, thiết bị và phiên đăng nhập.',
          '## Mục đích sử dụng',
          'Vận hành tài khoản, hiển thị tin đăng, chuyển tin nhắn tới đúng người, kiểm duyệt nội dung và xử lý báo cáo vi phạm.',
          '## Chia sẻ với bên thứ ba',
          'Chúng tôi không bán dữ liệu cá nhân. Dữ liệu chỉ được cung cấp cho cơ quan nhà nước có thẩm quyền khi có yêu cầu hợp pháp, hoặc cho nhà cung cấp hạ tầng trong phạm vi cần thiết để chạy dịch vụ.',
          'Thông tin bạn tự đưa vào tin đăng — ví dụ số điện thoại trong phần mô tả — là thông tin công khai: mọi người xem tin đều thấy.',
          '## Quyền của bạn',
          `Bạn có quyền xem và sửa thông tin cá nhân trong mục Cá nhân, và yêu cầu xoá tài khoản bằng cách gửi thư về ${SITE.support}. Khi tài khoản bị xoá, tin đăng và tin nhắn của bạn được gỡ khỏi nền tảng.`,
          '## Thời gian lưu trữ',
          'Dữ liệu được lưu trong thời gian tài khoản còn hoạt động. Nhật ký kiểm duyệt được giữ thêm nhằm phục vụ việc giải quyết khiếu nại.',
        ],
      },
      {
        slug: 'giai-quyet-tranh-chap',
        title: 'Giải quyết tranh chấp',
        body: [
          '## Tranh chấp giữa người mua và người bán',
          'Giao dịch diễn ra trực tiếp giữa hai bên, nên trước hết hai bên tự thương lượng. Chúng tôi khuyến nghị giữ lại lịch sử trao đổi trong ứng dụng — đó là bằng chứng có mốc thời gian và không sửa được.',
          '## Vai trò hỗ trợ của chúng tôi',
          'Khi được yêu cầu, chúng tôi cung cấp thông tin tin đăng và lịch sử kiểm duyệt liên quan, đồng thời xử lý tài khoản vi phạm theo quy chế. Chúng tôi không phân xử về tiền bạc và không bồi hoàn cho giao dịch giữa hai người dùng.',
          '## Trình tự',
          `Bước một: hai bên tự thương lượng. Bước hai: gửi yêu cầu tới hotline ${SITE.hotline} hoặc ${SITE.support} kèm đường dẫn tin đăng. Bước ba: nếu không đạt được thoả thuận, tranh chấp được đưa ra Toà án có thẩm quyền.`,
          '## Luật áp dụng',
          'Mọi tranh chấp phát sinh từ việc sử dụng nền tảng được giải quyết theo pháp luật Việt Nam.',
        ],
      },
      {
        slug: 'giai-quyet-khieu-nai',
        title: 'Giải quyết khiếu nại',
        body: [
          '## Đầu mối tiếp nhận',
          `${SITE.company}. Người chịu trách nhiệm: ${CONSUMER[0][1]}, ${CONSUMER[1][1]}. Hotline ${SITE.hotline}, thư điện tử ${SITE.support}.`,
          '## Nội dung khiếu nại cần có',
          'Họ tên và cách liên hệ của người khiếu nại; đường dẫn tin đăng liên quan; nội dung sự việc; yêu cầu cụ thể; tài liệu kèm theo nếu có.',
          '## Thời hạn xử lý',
          'Chúng tôi xác nhận đã nhận khiếu nại trong vòng 03 ngày làm việc và trả lời trong vòng 15 ngày làm việc kể từ ngày tiếp nhận. Vụ việc phức tạp có thể kéo dài hơn và sẽ được thông báo bằng văn bản.',
          '## Nếu chưa đồng ý với kết quả',
          'Người khiếu nại có quyền đưa vụ việc tới cơ quan quản lý nhà nước về bảo vệ quyền lợi người tiêu dùng, tổ chức xã hội tham gia bảo vệ quyền lợi người tiêu dùng, hoặc Toà án có thẩm quyền.',
        ],
      },
    ],
  },
  {
    /*
     * Cột này dùng `route` chứ không `body`: hai mục là hai VIỆC LÀM ĐƯỢC (gửi ý kiến, xem
     * danh sách đã công bố), không phải hai bài đọc. Cả hai màn đều dựng dạng modal — khai
     * `presentation: 'modal'` ở `app/_layout.tsx`.
     */
    title: 'Hỗ trợ khách hàng',
    articles: [
      {
        slug: 'tiep-nhan-danh-gia',
        title: 'Tiếp nhận đánh giá, phản ánh, kiến nghị của tổ chức xã hội',
        route: '/legal/feedback',
      },
      {
        slug: 'danh-sach-danh-gia',
        title: 'Danh sách đánh giá, phản ánh, kiến nghị của tổ chức xã hội',
        route: '/legal/feedback-list',
      },
    ],
  },
];

/** Bài ĐÃ có nội dung. Tách khỏi `LegalArticle` để trang đọc không phải `?.` hay `!` lên `body`. */
export type LegalPage = Required<Pick<LegalArticle, 'slug' | 'title' | 'body'>>;

/** Tra bài theo slug. `undefined` = slug lạ hoặc mục chưa có bài — hai ca cùng một màn. */
export function legalArticle(slug: string): LegalPage | undefined {
  const found = LEGAL_GROUPS.flatMap((g) => g.articles).find((a) => a.slug === slug);
  return found?.body ? { slug: found.slug, title: found.title, body: found.body } : undefined;
}
