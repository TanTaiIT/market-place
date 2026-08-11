import { CHAT_COLORS, db, NEW_PHOTOS } from './db';
import type { Conversation, Listing, Message, Notif, Profile } from './db';

/**
 * Lớp "API giả". Mọi hàm đều async + có độ trễ để React Query
 * thể hiện đúng loading / refetch / optimistic update.
 * Khi có backend thật, chỉ cần thay ruột từng hàm bằng fetch().
 */
const delay = (ms = 450) => new Promise<void>((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const AUTO_REPLIES = [
  'Dạ bạn ơi, để mình xem lại rồi nhắn bạn nha 😊',
  'Vẫn còn bạn nhé, bạn qua lấy lúc nào cũng được!',
  'Cảm ơn bạn đã quan tâm nha!',
  'Ok bạn, mình rep liền á 👍',
];

export const api = {
  /* ---------------- auth ---------------- */
  async login(phone: string, _password: string) {
    await delay(700);
    if (!phone.trim()) throw new Error('Nhập số điện thoại để đăng nhập');
    return clone(db.profile);
  },

  async register(input: { name: string; phone: string; org: string }) {
    await delay(800);
    if (!input.name.trim()) throw new Error('Nhập họ tên để tạo tài khoản');
    db.profile.name = input.name;
    db.profile.org = input.org || db.profile.org;
    db.profile.phone = input.phone || db.profile.phone;
    db.profile.avatar = input.name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
    return clone(db.profile);
  },

  /* ---------------- listings ---------------- */
  async getListings(cat = 'Tất cả'): Promise<Listing[]> {
    await delay();
    const items = cat === 'Tất cả' ? db.listings : db.listings.filter((l) => l.cat === cat);
    return clone(items);
  },

  async getListing(id: number): Promise<Listing> {
    await delay(250);
    const found = db.listings.find((l) => l.id === id);
    if (!found) throw new Error('Không tìm thấy tin này');
    return clone(found);
  },

  async searchListings(q: string): Promise<Listing[]> {
    await delay(300);
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return clone(
      db.listings.filter(
        (l) => l.title.toLowerCase().includes(t) || l.cat.toLowerCase().includes(t),
      ),
    );
  },

  async getMyListings(): Promise<Listing[]> {
    await delay(350);
    return clone(db.listings.filter((l) => l.mine));
  },

  async createListing(input: {
    title: string;
    price: string;
    desc: string;
    cat: string;
    /** URL Cloudinary do FE upload trước đó; BE chỉ lưu mảng chuỗi này */
    photoUrls?: string[];
  }): Promise<Listing> {
    await delay(900);
    if (!input.title.trim()) throw new Error('Đặt tên cho món đồ trước khi ghim');
    const id = Math.max(0, ...db.listings.map((l) => l.id)) + 1;
    const item: Listing = {
      id,
      title: input.title.trim(),
      price: input.price.trim() ? `${input.price.trim()}đ` : 'Free',
      cat: input.cat,
      meta: `${db.profile.org} · vừa xong`,
      photo: NEW_PHOTOS[id % NEW_PHOTOS.length],
      photoUrls: input.photoUrls,
      seller: db.profile.name,
      avatar: db.profile.avatar,
      contact: `${db.profile.phone} · ${db.profile.org}`,
      desc: input.desc.trim() || 'Chưa có mô tả.',
      status: 'pending',
      mine: true,
    };
    db.listings.unshift(item);
    db.profile.posted += 1;
    return clone(item);
  },

  async deleteListing(id: number) {
    await delay(400);
    const i = db.listings.findIndex((l) => l.id === id);
    if (i >= 0) db.listings.splice(i, 1);
    db.savedIds = db.savedIds.filter((s) => s !== id);
    return { id };
  },

  /* ---------------- saved ---------------- */
  async getSavedIds(): Promise<number[]> {
    await delay(200);
    return [...db.savedIds];
  },

  async getSavedListings(): Promise<Listing[]> {
    await delay(350);
    return clone(db.listings.filter((l) => db.savedIds.includes(l.id)));
  },

  async toggleSaved(id: number): Promise<number[]> {
    await delay(300);
    db.savedIds = db.savedIds.includes(id)
      ? db.savedIds.filter((s) => s !== id)
      : [...db.savedIds, id];
    return [...db.savedIds];
  },

  /* ---------------- chat ---------------- */
  async getConversations(): Promise<Conversation[]> {
    await delay(400);
    return clone(db.conversations);
  },

  async getConversation(id: number): Promise<Conversation> {
    await delay(250);
    const c = db.conversations.find((x) => x.id === id);
    if (!c) throw new Error('Cuộc trò chuyện không tồn tại');
    c.unread = false;
    return clone(c);
  },

  /** Mở (hoặc tạo mới) cuộc trò chuyện gắn với một tin đăng */
  async openConversationFor(listingId: number): Promise<Conversation> {
    await delay(300);
    const listing = db.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Không tìm thấy tin này');
    if (listing.mine) throw new Error('Đây là tin của bạn');
    let c = db.conversations.find((x) => x.listingId === listingId);
    if (!c) {
      c = {
        id: Math.max(0, ...db.conversations.map((x) => x.id)) + 1,
        listingId,
        name: listing.seller,
        avatar: listing.avatar,
        lastMsg: 'Bắt đầu cuộc trò chuyện',
        time: 'Vừa xong',
        unread: false,
        messages: [],
      };
      db.conversations.unshift(c);
    }
    c.unread = false;
    return clone(c);
  },

  async sendMessage(conversationId: number, text: string): Promise<Message> {
    await delay(220);
    const c = db.conversations.find((x) => x.id === conversationId);
    if (!c) throw new Error('Cuộc trò chuyện không tồn tại');
    const msg: Message = { id: `m${Date.now()}`, from: 'me', text, time: nowTime() };
    c.messages.push(msg);
    c.lastMsg = text;
    c.time = 'Vừa xong';
    c.unread = false;
    return clone(msg);
  },

  /** Đối phương "đang nhập..." rồi trả lời — chạy sau khi gửi tin */
  async fetchReply(conversationId: number): Promise<Message> {
    await delay(1400);
    const c = db.conversations.find((x) => x.id === conversationId);
    if (!c) throw new Error('Cuộc trò chuyện không tồn tại');
    const text = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    const msg: Message = { id: `m${Date.now()}`, from: 'them', text, time: nowTime() };
    c.messages.push(msg);
    c.lastMsg = text;
    c.time = 'Vừa xong';
    return clone(msg);
  },

  /* ---------------- misc ---------------- */
  async getNotifications(): Promise<Notif[]> {
    await delay(400);
    return clone(db.notifications);
  },

  async getProfile(): Promise<Profile> {
    await delay(200);
    return clone(db.profile);
  },

  async updateProfile(input: Partial<Profile>): Promise<Profile> {
    await delay(600);
    Object.assign(db.profile, input);
    return clone(db.profile);
  },
};

export const chatColor = (index: number) => CHAT_COLORS[index % CHAT_COLORS.length];
