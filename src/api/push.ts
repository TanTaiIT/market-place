import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  pushGetPreferences,
  pushRegisterDevice,
  pushSendTest,
  pushUnregisterDevice,
  pushUpdatePreferences,
} from './generated';
import type { PushPreferences, UpdatePushPreferences } from './generated';
import { unwrap } from './client';
import { getHttpPushToken, setHttpPushToken, withAuthRetry } from './http';

/**
 * Push notification phía thiết bị + API đăng ký. Thiết kế tổng:
 * `docs/market/docs/architecture/push-notification.plan.md` §5.
 *
 * Nằm ở `api/**` vì đây là một NGUỒN dữ liệu (quyền, token của hệ điều hành) giống `http.ts`;
 * hook và thời điểm gọi thuộc về `queries/push.ts`.
 */

export type PushPrefs = PushPreferences;
export type PushPrefsPatch = UpdatePushPreferences;
export type PushCategory = keyof PushPreferences['categories'];
export type PushPermission = 'granted' | 'undetermined' | 'denied';

/**
 * Nhãn từng nhóm. Cũng là tên KÊNH Android: id kênh trùng tên nhóm BE gửi trong `channelId`,
 * nên người dùng chỉnh được âm thanh/ưu tiên từng loại trong Cài đặt hệ thống.
 */
export const PUSH_CATEGORY_LABEL: Record<PushCategory, { title: string; hint: string }> = {
  chat: { title: 'Tin nhắn', hint: 'Người mua, người bán nhắn cho bạn' },
  listing_status: { title: 'Tin đăng của bạn', hint: 'Được duyệt, bị từ chối, sắp hết hạn' },
  membership: { title: 'Nhóm của bạn', hint: 'Đơn vào nhóm, lời mời, được giao phụ trách' },
  report: { title: 'Báo cáo của bạn', hint: 'Kết quả xử lý tin bạn đã báo' },
  account: { title: 'Tài khoản', hint: 'Khoá, quản chế, uy tín — luôn bật' },
  wallet: { title: 'Ví Xu', hint: 'Cộng, trừ Xu' },
  group_notice: { title: 'Thông báo của nhóm', hint: 'Quản trị nhóm gửi cho cả nhóm' },
  group_activity: { title: 'Tin mới trong nhóm', hint: 'Mỗi khi thành viên đăng tin mới' },
  support: { title: 'Hỗ trợ', hint: 'Đội ngũ Ghim trả lời bạn' },
};

/** Route push được phép mở — BE đã chốt một lần, app chốt lại trước khi điều hướng. */
const ALLOWED_PATH = /^\/(listing\/[\w-]+|chat\/[\w-]+|org\/[\w-]+|mylistings|settings|feed|notif)$/;
const INBOX_PATH = '/notif';

/** Hội thoại đang mở trên màn hình — push chat của đúng hội thoại đó không hiện banner. */
let activeConversationId: string | null = null;
/**
 * Token FCM/APNs lần gần nhất app tự lấy. Android bắn sự kiện "token mới" SAU MỖI LẦN lấy token,
 * kể cả khi nó không đổi (`PushTokenModule.getDevicePushTokenAsync` gọi `onNewToken`) — không so
 * với bản đã biết thì listener đăng ký lại → lấy token → sự kiện → đăng ký lại, lặp vô hạn.
 */
let knownDeviceToken: string | null = null;

/*
 * Chạy MỘT lần lúc nạp module: handler phải có trước push đầu tiên, kể cả push tới ngay lúc app
 * vừa mở. Không có handler thì app đang mở sẽ nuốt mọi push mà không hiện gì.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const sameChat =
      data?.category === 'chat' &&
      activeConversationId !== null &&
      data.conversationId === activeConversationId;
    return {
      shouldShowBanner: !sameChat,
      shouldShowList: !sameChat,
      shouldPlaySound: !sameChat,
      shouldSetBadge: false,
    };
  },
});

export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

/** Đường dẫn an toàn để mở từ dữ liệu của push; thiếu hoặc lạ thì về hộp thư. */
export function pushPathOf(data: unknown): string {
  const path = (data as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' && ALLOWED_PATH.test(path) ? path : INBOX_PATH;
}

export function pushNotificationIdOf(data: unknown): string | null {
  const id = (data as { notificationId?: unknown } | undefined)?.notificationId;
  return typeof id === 'string' && /^[0-9a-f]{24}$/.test(id) ? id : null;
}

/**
 * Android: kênh phải có TRƯỚC khi xin quyền — Android 13 chỉ hiện hộp thoại xin quyền sau khi
 * app đã tạo ít nhất một kênh. Gọi lại nhiều lần vô hại (cập nhật tên kênh nếu đổi).
 */
export async function ensurePushChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    (Object.keys(PUSH_CATEGORY_LABEL) as PushCategory[]).map((id) =>
      Notifications.setNotificationChannelAsync(id, {
        name: PUSH_CATEGORY_LABEL[id].title,
        description: PUSH_CATEGORY_LABEL[id].hint,
        importance:
          id === 'chat' || id === 'account'
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
      }),
    ),
  );
}

export async function pushPermission(): Promise<{ status: PushPermission; canAskAgain: boolean }> {
  const res = await Notifications.getPermissionsAsync();
  return { status: res.status as PushPermission, canAskAgain: res.canAskAgain };
}

export async function requestPushPermission(): Promise<PushPermission> {
  await ensurePushChannels();
  const res = await Notifications.requestPermissionsAsync();
  return res.status as PushPermission;
}

/**
 * Token Expo của máy này, hoặc LÝ DO không lấy được. Không ném, và không nuốt lý do: đường nền
 * (mở app) bỏ qua lý do, còn thao tác người dùng bấm ("Bật thông báo", "Gửi thử") cần nói ra đúng
 * chỗ hỏng — một câu "chưa đăng ký" chung chung không chỉ ra được bản build nào thiếu gì.
 */
export async function devicePushToken(): Promise<{ token: string } | { reason: string }> {
  if (!Device.isDevice) return { reason: 'Máy ảo không nhận được thông báo — thử trên điện thoại thật' };
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return { reason: 'Bản app thiếu EAS projectId — chạy `eas init` rồi build lại' };

  let device: Notifications.DevicePushToken;
  try {
    device = await Notifications.getDevicePushTokenAsync();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Firebase chưa khởi tạo = APK được build mà không có google-services.json.
    const hint = /firebase/i.test(message) ? ' — bản build thiếu google-services.json, cần build lại' : '';
    return { reason: `Không lấy được token FCM: ${message}${hint}` };
  }
  knownDeviceToken = String(device.data);
  try {
    // Truyền sẵn token thiết bị để Expo khỏi lấy lại lần nữa (mỗi lần lấy là một sự kiện).
    return { token: (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken: device })).data };
  } catch (e) {
    return { reason: `Expo không cấp push token: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Token thiết bị THẬT SỰ đổi (hiếm: FCM xoay khoá, khôi phục máy) — caller lấy lại token Expo rồi
 * đăng ký lại. Sự kiện mang đúng token vừa lấy thì bỏ qua — xem `knownDeviceToken`.
 */
export function onPushTokenChange(listener: () => void): () => void {
  const sub = Notifications.addPushTokenListener((token) => {
    const next = String(token.data);
    if (next === knownDeviceToken) return;
    knownDeviceToken = next;
    listener();
  });
  return () => sub.remove();
}

/** Người dùng chạm vào một push lúc app đang chạy (nền hoặc mở). */
export function onPushTap(listener: (data: unknown) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    Notifications.clearLastNotificationResponse();
    listener(res.notification.request.content.data);
  });
  return () => sub.remove();
}

/**
 * Lượt chạm đã MỞ app từ trạng thái tắt hẳn — listener ở trên chưa kịp gắn lúc đó. Đọc xong thì
 * xoá, để effect chạy lại (đổi phiên, remount) không mở lại đúng màn đó thêm lần nữa.
 */
export async function takeColdStartTap(): Promise<unknown | null> {
  const res = await Notifications.getLastNotificationResponseAsync();
  if (!res) return null;
  await Notifications.clearLastNotificationResponseAsync();
  return res.notification.request.content.data;
}

export const pushApi = {
  async register(token: string): Promise<void> {
    const res = await withAuthRetry(() =>
      pushRegisterDevice({
        body: {
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          appVersion: Constants.expoConfig?.version ?? '',
          deviceName: Device.modelName ?? '',
        },
      }),
    );
    unwrap(res, 'Không đăng ký được thông báo');
    setHttpPushToken(token);
  },

  /** Không cần phiên còn sống — xem route BE. Lỗi mạng thì thôi: server tự dọn máy chết qua receipt. */
  async unregister(): Promise<void> {
    const token = getHttpPushToken();
    setHttpPushToken(null);
    if (!token) return;
    await pushUnregisterDevice({ body: { token } }).catch(() => undefined);
  },

  async preferences(): Promise<PushPrefs> {
    const res = await withAuthRetry(() => pushGetPreferences());
    return unwrap(res, 'Không tải được cài đặt thông báo');
  },

  async updatePreferences(patch: PushPrefsPatch): Promise<PushPrefs> {
    const res = await withAuthRetry(() => pushUpdatePreferences({ body: patch }));
    return unwrap(res, 'Không lưu được cài đặt thông báo');
  },

  async sendTest(): Promise<number> {
    const res = await withAuthRetry(() => pushSendTest());
    return unwrap(res, 'Không gửi được thông báo thử').devices;
  },
};
