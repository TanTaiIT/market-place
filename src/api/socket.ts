import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './http';

/**
 * Kết nối Socket.IO tới BE. Chỉ để **nhận** tin nhắn thời gian thực — gửi vẫn đi
 * `POST /chats/:id/messages`, vì BE chốt REST là đường ghi duy nhất (một chỗ kiểm tra quyền,
 * và tin gửi lúc socket rớt không mất trắng).
 *
 * File này nằm ở `src/api/**` nên KHÔNG được biết tới `stores/**` (folder.convention §6):
 * access token do `queries/chat.ts` đẩy vào, giống cách `http.ts` nhận phiên.
 */

/** BE mount Socket.IO ở gốc server, còn `API_BASE_URL` đã kèm `/api/v1` — cắt phần đó đi. */
const SOCKET_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Mở kết nối, hoặc mở lại khi token đổi. Gọi lại với cùng token là no-op — hook gọi nó mỗi
 * lần session thay đổi identity nên phải rẻ.
 */
export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) return socket;

  disconnectSocket();
  currentToken = token;
  socket = io(SOCKET_URL, {
    auth: { token },
    // BE từ chối handshake thiếu/sai token; tự thử lại mãi sẽ thành vòng lặp vô ích khi
    // phiên đã hết hạn. Để `queries/chat.ts` mở lại sau khi token được làm mới.
    reconnectionAttempts: 5,
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  currentToken = null;
}

export function getSocket(): Socket | null {
  return socket;
}
