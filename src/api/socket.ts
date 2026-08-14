import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './http';

/**
 * Kết nối Socket.IO tới BE. Chỉ để **nhận** sự kiện thời gian thực — gửi tin nhắn vẫn đi
 * `POST /chats/:id/messages`, vì BE chốt REST là đường ghi duy nhất (một chỗ kiểm tra quyền,
 * và tin gửi lúc socket rớt không mất trắng).
 *
 * File này nằm ở `src/api/**` nên KHÔNG được biết tới `stores/**` (folder.convention §6):
 * access token do `queries/chat.ts` đẩy vào, giống cách `http.ts` nhận phiên.
 *
 * Mô hình ở đây là **khai báo nguyện vọng, không ra lệnh trực tiếp**: call-site nói "tôi muốn ở
 * phòng X", "tôi muốn nghe sự kiện Y", còn việc phát `chat:join` và gắn listener lên đúng
 * instance socket nào là việc của file này. Lý do: trên mobile kết nối chết và sống lại liên
 * tục, mà mỗi lần sống lại là một socket MỚI không mang theo gì của socket cũ — call-site tự
 * emit/gắn một lần lúc mount thì sau lần rớt đầu tiên nó im lặng mất realtime, trong khi màn
 * hình vẫn trông bình thường vì REST vẫn chạy.
 */

/** BE mount Socket.IO ở gốc server, còn `API_BASE_URL` đã kèm `/api/v1` — cắt phần đó đi. */
const SOCKET_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** Sự kiện BE phát xuống. Union thay vì `string` để một cú gõ nhầm là lỗi biên dịch. */
type ServerEvent = 'chat:message' | 'admin:activity';
type EventHandler = (payload: unknown) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Trạng thái app ĐANG MUỐN có — không phải trạng thái server đang giữ. Server xoá sạch room
 * membership mỗi lần socket rớt, và app xuống background 45 giây là đủ để nó ping-timeout
 * (pingInterval 25s + pingTimeout 20s của engine.io). Giữ ở module scope rồi dựng lại toàn bộ
 * sau mỗi lần `connect` là cách duy nhất để màn hình còn mở thì còn nhận được sự kiện.
 */
const wantedRooms = new Set<string>();
let wantsAdminRoom = false;
const handlers = new Map<ServerEvent, Set<EventHandler>>();

function applyWantedState(target: Socket): void {
  if (wantsAdminRoom) target.emit('admin:join');
  for (const conversationId of wantedRooms) target.emit('chat:join', conversationId);
}

/**
 * Mở kết nối, hoặc mở lại khi token đổi. Gọi lại với cùng token là no-op — hook gọi nó mỗi
 * lần session thay đổi identity nên phải rẻ.
 */
export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) return socket;

  disconnectSocket();
  currentToken = token;

  const next = io(SOCKET_URL, {
    auth: { token },
    // KHÔNG giới hạn số lần thử lại. Rớt kết nối là chuyện thường ngày của app mobile (xuống
    // background, khoá màn hình, đổi Wi-Fi ↔ 4G), mà hết lượt thử thì client bỏ cuộc VĨNH VIỄN:
    // realtime chết im lặng cho tới khi người dùng kill app. Backoff mặc định đã chặn trên ở
    // 5s/lần nên không sợ spam. Token hỏng thì server từ chối handshake, và `withAuthRetry`
    // bên HTTP mới là chỗ phát hiện phiên chết — không phải vòng lặp reconnect này.
    // websocket trước, polling dự phòng. Chỉ khai mỗi websocket thì gặp proxy không upgrade
    // được là hỏng hẳn thay vì chậm hơn một chút — đã kiểm cả hai đều thông tới bản deploy.
    transports: ['websocket', 'polling'],
  });

  // `connect` bắn cả ở lần nối đầu tiên lẫn mọi lần nối lại, nên đây là chỗ DUY NHẤT cần biết
  // về việc khôi phục trạng thái. Đăng ký trước khi trả về để không lỡ lần `connect` đầu.
  next.on('connect', () => applyWantedState(next));
  for (const [event, set] of handlers) {
    for (const handler of set) next.on(event, handler);
  }

  socket = next;
  return next;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  currentToken = null;
  // Cố tình KHÔNG dọn `wantedRooms`/`handlers`: hàm này chạy cả khi token vừa được làm mới, lúc
  // đó màn chat vẫn đang mở và phải vào lại đúng phòng cũ. Khi đăng xuất thật thì màn hình
  // unmount trước (cleanup của con chạy trước cha) nên các tập này đã tự rỗng.
}

/**
 * Đánh thức kết nối khi app trở lại foreground. No-op nếu đang nối hoặc chưa đăng nhập —
 * `socket.connect()` trên một socket đang sống không tạo thêm kết nối nào.
 */
export function reconnectSocket(): void {
  if (socket && !socket.connected) socket.connect();
}

/**
 * Vào phòng của một hội thoại. Gọi được cả khi socket **chưa tồn tại**: mở app bằng deep-link
 * thẳng vào màn chat thì effect của màn con chạy trước effect mở socket ở layout cha, và bản cũ
 * đọc socket hiện tại, thấy `null` là bỏ luôn chứ không bao giờ thử lại.
 */
export function joinConversation(conversationId: string): void {
  wantedRooms.add(conversationId);
  if (socket?.connected) socket.emit('chat:join', conversationId);
}

export function leaveConversation(conversationId: string): void {
  wantedRooms.delete(conversationId);
  if (socket?.connected) socket.emit('chat:leave', conversationId);
}

/** Phòng quản trị. BE chặn bằng role trong JWT nên emit thẳng từ tài khoản thường không lách được. */
export function joinAdminRoom(): void {
  wantsAdminRoom = true;
  if (socket?.connected) socket.emit('admin:join');
}

export function leaveAdminRoom(): void {
  wantsAdminRoom = false;
  // Không có `admin:leave` bên BE — rời phòng xảy ra khi socket đóng. Bỏ cờ là đủ để lần
  // reconnect sau không tự vào lại.
}

/** Nghe một sự kiện của server. Trả về hàm huỷ đăng ký — gọi trong cleanup của effect. */
export function onSocketEvent(event: ServerEvent, handler: EventHandler): () => void {
  const set = handlers.get(event) ?? new Set<EventHandler>();
  set.add(handler);
  handlers.set(event, set);
  socket?.on(event, handler);

  return () => {
    set.delete(handler);
    socket?.off(event, handler);
  };
}
