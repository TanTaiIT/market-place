import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  devicePushToken,
  ensurePushChannels,
  onPushTap,
  onPushTokenChange,
  pushApi,
  pushNotificationIdOf,
  pushPathOf,
  pushPermission,
  requestPushPermission,
  setActiveConversation,
  takeColdStartTap,
} from '@/api/push';
import type { PushPrefs, PushPrefsPatch } from '@/api/push';
import { useAuthStore, useIsAuthenticated } from '@/stores/auth';
import { usePushPromptStore } from '@/stores/push';
import { qk } from './keys';

/** Hỏi lại tối đa hai tuần một lần nếu người dùng bấm "Để sau". */
const PROMPT_EVERY_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Lấy token rồi đăng ký với BE; hỏng thì NÉM kèm lý do thật. Đường nền (mở app) tự bắt và bỏ qua
 * — lượt sau thử lại; thao tác người dùng bấm thì để lỗi lên toast, vì đó là lúc họ cần biết.
 */
async function registerThisDevice(): Promise<void> {
  await ensurePushChannels();
  const res = await devicePushToken();
  if ('reason' in res) throw new Error(res.reason);
  await pushApi.register(res.token);
}

/** Quyền thông báo của máy — đọc lại khi app quay lại từ Cài đặt hệ thống. */
export function usePushPermission() {
  const qc = useQueryClient();
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void qc.invalidateQueries({ queryKey: qk.pushPermission() });
    });
    return () => sub.remove();
  }, [qc]);
  return useQuery({ queryKey: qk.pushPermission(), queryFn: pushPermission, staleTime: 0 });
}

export function usePushPrefs() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: qk.pushPrefs(),
    queryFn: pushApi.preferences,
    enabled: isAuthenticated,
  });
}

/** Công tắc đổi NGAY lúc chạm (lạc quan); lỗi thì trả lại như cũ. */
export function useUpdatePushPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PushPrefsPatch) => pushApi.updatePreferences(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.pushPrefs() });
      const prev = qc.getQueryData<PushPrefs>(qk.pushPrefs());
      if (prev) {
        qc.setQueryData<PushPrefs>(qk.pushPrefs(), {
          ...prev,
          enabled: patch.enabled ?? prev.enabled,
          categories: { ...prev.categories, ...patch.categories },
        });
      }
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.pushPrefs(), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pushPrefs() }),
  });
}

/** Đăng ký lại máy NGAY trước khi gửi thử: máy vừa cài lại / đổi token thì lượt thử tự chữa luôn. */
export function useSendTestPush() {
  return useMutation({
    mutationFn: async () => {
      await registerThisDevice();
      return pushApi.sendTest();
    },
  });
}

/** Xin quyền (hộp thoại hệ thống) rồi đăng ký máy. `false` = người dùng không cấp quyền. */
export function useEnablePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if ((await requestPushPermission()) !== 'granted') return false;
      await registerThisDevice();
      return true;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.pushPermission() }),
  });
}

/**
 * Hỏi ĐÚNG LÚC — sau một việc mà thông báo có ích rõ ràng (vừa đăng tin, vừa nhắn tin). Hộp giải
 * thích của app đứng trước hộp thoại hệ thống: iOS chỉ cho hỏi một lần, bị từ chối là phải vào
 * Cài đặt. Đã có quyền, đã bị chặn hẳn, hoặc vừa hỏi gần đây thì im lặng.
 */
export function usePushPrompt() {
  const enable = useEnablePush();
  return async (reason: string) => {
    const { promptedAt, markPrompted } = usePushPromptStore.getState();
    if (promptedAt !== null && Date.now() - promptedAt < PROMPT_EVERY_MS) return;
    const { status, canAskAgain } = await pushPermission();
    if (status === 'granted' || !canAskAgain) return;
    markPrompted();
    Alert.alert('Bật thông báo?', reason, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Bật', onPress: () => enable.mutate() },
    ]);
  };
}

/**
 * Đăng ký máy mỗi lần mở app / đổi tài khoản — CHỈ khi đã có quyền (không tự bật hộp thoại xin
 * quyền lúc mở app). Đăng ký lại mỗi lần là cách BE biết máy còn dùng (`lastSeenAt`) và là cách
 * máy chuyển sang tài khoản mới khi người khác đăng nhập trên cùng máy.
 */
export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.session?.userId ?? null);
  useEffect(() => {
    if (!userId) return;
    // Một lượt tại một thời điểm: sự kiện token tới dồn trong lúc đang đăng ký thì bỏ, không xếp hàng.
    let running = false;
    const sync = () => {
      if (running) return;
      running = true;
      void pushPermission()
        .then(({ status }) => (status === 'granted' ? registerThisDevice() : undefined))
        // Việc nền — xem `registerThisDevice`.
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };
    sync();
    return onPushTokenChange(sync);
  }, [userId]);
}

/**
 * Chạm vào push → mở đúng màn, và đánh dấu dòng hộp thư tương ứng là đã đọc. Chờ `ready` (Stack
 * đã dựng) mới điều hướng — lượt chạm mở app từ trạng thái tắt hẳn tới trước cả navigator.
 * Nhận `qc` qua tham số: gọi ở thân `RootLayout`, nằm NGOÀI `<QueryClientProvider>`.
 */
export function usePushTaps(qc: QueryClient, ready: boolean, open: (path: string) => void): void {
  useEffect(() => {
    if (!ready) return;
    const handle = (data: unknown) => {
      const id = pushNotificationIdOf(data);
      if (id) {
        void api
          .markNotificationRead(id)
          .then(() => qc.invalidateQueries({ queryKey: qk.notifications() }))
          // Không đánh dấu được thì dòng còn chấm chưa đọc — người dùng tự chạm lại trong hộp thư.
          .catch(() => undefined);
      }
      open(pushPathOf(data));
    };
    void takeColdStartTap().then((data) => data && handle(data));
    return onPushTap(handle);
  }, [qc, ready, open]);
}

/** Đang mở hội thoại này thì push chat của nó không hiện banner — tin đã nằm ngay trên màn. */
export function useSuppressChatPush(conversationId: string | null): void {
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId]);
}
