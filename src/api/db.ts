import type { Grad } from '@/theme';

export type Listing = {
  id: number;
  title: string;
  price: string;
  cat: string;
  meta: string;
  /** Cặp màu dựng ảnh giả — dùng khi tin chưa có ảnh thật */
  photo: Grad;
  /** URL Cloudinary theo thứ tự người đăng chọn; phần tử **đầu tiên là ảnh bìa** */
  photoUrls?: string[];
  seller: string;
  avatar: string;
  contact: string;
  desc: string;
  status: 'live' | 'pending';
  mine: boolean;
};

export type Message = { id: string; from: 'me' | 'them'; text: string; time: string };

export type Conversation = {
  id: number;
  listingId: number;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: boolean;
  messages: Message[];
};

export type Notif = {
  id: number;
  icon: string;
  kind: 'org' | 'chain' | 'system';
  badge?: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

export type Profile = {
  name: string;
  org: string;
  phone: string;
  avatar: string;
  posted: number;
  sold: number;
  rating: string;
};

export const CATEGORIES = ['Tất cả', 'Sách vở', 'Xe đạp', 'Điện tử', 'Đồ dùng'];
export const POST_CATEGORIES = ['Sách vở', 'Xe đạp', 'Điện tử', 'Đồ dùng'];

/** "Cơ sở dữ liệu" nằm trong bộ nhớ — đổi sang fetch thật khi có backend */
export const db = {
  profile: {
    name: 'Minh Vũ',
    org: 'Trường Hùng Vương',
    phone: '090 123 4567',
    avatar: 'MV',
    posted: 6,
    sold: 3,
    rating: '4.9',
  } as Profile,

  savedIds: [1, 3] as number[],

  listings: [
    {
      id: 1,
      title: 'Xe đạp thể thao còn mới 90%',
      price: '250.000đ',
      cat: 'Xe đạp',
      meta: 'Trường Hùng Vương · 2 giờ',
      photo: ['#D9D2BC', '#C7BE9E'],
      seller: 'Minh Vũ',
      avatar: 'MV',
      contact: '090 123 4567 · Trường Hùng Vương',
      desc: 'Xe đạp thể thao ít sử dụng, còn bảo hành khung, sang tên nhanh gọn. Lý do bán: chuyển trường nên không dùng tới.',
      status: 'live',
      mine: true,
    },
    {
      id: 2,
      title: 'Bộ sách Toán 12 đầy đủ',
      price: '120.000đ',
      cat: 'Sách vở',
      meta: 'Trường Cao Thắng · 5 giờ',
      photo: ['#C9D9C0', '#9FBF8E'],
      seller: 'Thu Hà',
      avatar: 'TH',
      contact: '091 222 3344 · Trường Cao Thắng',
      desc: 'Bộ sách giáo khoa và sách bài tập Toán 12, còn giữ gìn cẩn thận, không rách trang, có ghi chú bài giải hữu ích.',
      status: 'pending',
      mine: true,
    },
    {
      id: 3,
      title: 'Laptop cũ, pin trâu, học tốt',
      price: '1.850.000đ',
      cat: 'Điện tử',
      meta: 'Trường Hùng Vương · 1 ngày',
      photo: ['#C7C2D9', '#9E97BF'],
      seller: 'Đức Anh',
      avatar: 'ĐA',
      contact: '098 555 6677 · Trường Hùng Vương',
      desc: 'Laptop dùng học tập 1 năm, còn bảo hành hãng 6 tháng, cấu hình đủ dùng Word/Excel/lướt web mượt.',
      status: 'live',
      mine: false,
    },
    {
      id: 4,
      title: 'Cho tặng bàn học gỗ',
      price: 'Free',
      cat: 'Đồ dùng',
      meta: 'Trường Cao Thắng · 1 ngày',
      photo: ['#E0C79E', '#C79E6B'],
      seller: 'Gia Bảo',
      avatar: 'GB',
      contact: '096 888 1122 · Trường Cao Thắng',
      desc: 'Bàn học gỗ còn chắc chắn, chuyển nhà nên cho tặng, ai cần liên hệ qua lấy trong tuần này.',
      status: 'live',
      mine: false,
    },
    {
      id: 5,
      title: 'Balo laptop chống nước',
      price: '180.000đ',
      cat: 'Đồ dùng',
      meta: 'Trường Hùng Vương · 2 ngày',
      photo: ['#D9C2C2', '#BF9797'],
      seller: 'Minh Vũ',
      avatar: 'MV',
      contact: '090 123 4567 · Trường Hùng Vương',
      desc: 'Balo chống nước, nhiều ngăn, còn mới 95%, phù hợp đựng laptop 15 inch.',
      status: 'live',
      mine: true,
    },
    {
      id: 6,
      title: 'Truyện tranh trọn bộ 20 tập',
      price: '150.000đ',
      cat: 'Sách vở',
      meta: 'Trường Cao Thắng · 3 ngày',
      photo: ['#F0D6A6', '#D9B26B'],
      seller: 'Thu Hà',
      avatar: 'TH',
      contact: '091 222 3344 · Trường Cao Thắng',
      desc: 'Bộ truyện tranh đầy đủ 20 tập, không rách, không mất trang, đọc 1 lần rồi cất giữ.',
      status: 'live',
      mine: false,
    },
  ] as Listing[],

  conversations: [
    {
      id: 1,
      listingId: 2,
      name: 'Thu Hà',
      avatar: 'TH',
      lastMsg: 'Sách còn không bạn ơi?',
      time: '5 phút',
      unread: true,
      messages: [
        { id: 'm1', from: 'them', text: 'Chào bạn, bộ sách Toán 12 còn không ạ?', time: '14:00' },
        { id: 'm2', from: 'them', text: 'Sách còn không bạn ơi?', time: '14:02' },
      ],
    },
    {
      id: 2,
      listingId: 3,
      name: 'Đức Anh',
      avatar: 'ĐA',
      lastMsg: 'Mai mình lấy được không?',
      time: '1 giờ',
      unread: true,
      messages: [
        { id: 'm3', from: 'them', text: 'Chào bạn, laptop còn bảo hành đúng không?', time: '10:15' },
        { id: 'm4', from: 'me', text: 'Dạ còn bạn ơi, bảo hành hãng 6 tháng nha', time: '10:20' },
        { id: 'm5', from: 'them', text: 'Mai mình lấy được không?', time: '10:22' },
      ],
    },
    {
      id: 3,
      listingId: 4,
      name: 'Gia Bảo',
      avatar: 'GB',
      lastMsg: 'Cảm ơn bạn nhiều nha!',
      time: '1 ngày',
      unread: false,
      messages: [
        { id: 'm6', from: 'me', text: 'Bàn học vẫn còn nha, bạn qua trường lấy nhé', time: '09:00' },
        { id: 'm7', from: 'them', text: 'Cảm ơn bạn nhiều nha!', time: '09:05' },
      ],
    },
  ] as Conversation[],

  notifications: [
    {
      id: 1,
      icon: '📌',
      kind: 'system',
      title: 'Tin của bạn đã được duyệt',
      body: '"Xe đạp thể thao còn mới 90%" đã hiển thị trên bảng tin.',
      time: '10 phút trước',
      unread: true,
    },
    {
      id: 2,
      icon: '🏫',
      kind: 'org',
      badge: 'Từ trường',
      title: 'Trường Hùng Vương',
      body: 'Hội chợ đồ cũ cuối kỳ diễn ra thứ 7 tuần này tại sân trường.',
      time: '2 giờ trước',
      unread: true,
    },
    {
      id: 3,
      icon: '🔗',
      kind: 'chain',
      badge: 'Từ hệ thống',
      title: 'Hệ thống Hùng Vương - Cao Thắng',
      body: 'Đã mở tính năng xem tin đăng chéo giữa các trường trong hệ thống.',
      time: '1 ngày trước',
      unread: false,
    },
    {
      id: 4,
      icon: '💬',
      kind: 'system',
      title: 'Có người quan tâm tin của bạn',
      body: '1 người đã lưu tin "Bộ sách Toán 12 đầy đủ".',
      time: '1 ngày trước',
      unread: false,
    },
  ] as Notif[],
};

export const CHAT_COLORS = ['#3F6B4A', '#D9A566', '#8C6539', '#6B7F8C', '#B98851'];

export const NEW_PHOTOS: Grad[] = [
  ['#EFCB9C', '#D9A566'],
  ['#C9D9C0', '#9FBF8E'],
  ['#C7C2D9', '#9E97BF'],
  ['#D9C2C2', '#BF9797'],
];
