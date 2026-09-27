import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Mốc lần cuối app HỎI người dùng có muốn bật thông báo (hộp giải thích của app, trước hộp thoại
 * hệ thống). Không phải server state: nó là trí nhớ của máy này về một câu đã hỏi.
 *
 * Phải nhớ vì iOS chỉ cho hiện hộp thoại hệ thống MỘT lần — hỏi dồn sau mỗi tin đăng thì người
 * dùng bấm "Để sau" cho xong, rồi tới lúc thật sự cần thì đã mất cơ hội. Hỏi thưa, đúng lúc.
 */
type PushPromptState = {
  promptedAt: number | null;
  markPrompted: () => void;
};

export const usePushPromptStore = create<PushPromptState>()(
  persist(
    (set) => ({
      promptedAt: null,
      markPrompted: () => set({ promptedAt: Date.now() }),
    }),
    { name: 'ghim-push-prompt', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
