import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SupportFab } from '@/components/SupportFab';
import { TabBar } from '@/components/TabBar';
import { useAuthStore, usePendingEmailVerify } from '@/stores/auth';
// Lớp phủ tuân thủ TẠM THỜI — xem khối `CỔNG ĐỊNH DANH` bên dưới; hai thứ này cùng bị gỡ.
import { useMyKyc } from '@/queries/kyc';

export default function TabsLayout() {
  const router = useRouter();
  const pendingVerify = usePendingEmailVerify();

  /*
   * Mời xác thực email NGAY SAU khi đăng ký — nhưng từ đây, không từ `register.tsx`.
   *
   * HARD#18 cấm tự điều hướng khi đổi trạng thái auth: `register` bật phiên xong là
   * `Stack.Protected` đổi stack, và một `router.push` bắn cùng lúc sẽ chạy trên stack cũ rồi
   * bị vứt. Đọc cờ ở đây thì lượt điều hướng xảy ra SAU khi stack mới đã mount — đến từ
   * trạng thái app chứ không từ sự kiện đăng nhập, nên không đua với navigator.
   *
   * Xoá cờ trước khi đẩy để lượt mount kế tiếp không đẩy lần hai (React 19 chạy effect hai
   * lượt ở chế độ dev).
   */
  useEffect(() => {
    if (!pendingVerify) return;
    useAuthStore.getState().clearPendingEmailVerify();
    router.push('/verify-email');
  }, [pendingVerify, router]);

  /*
   * CỔNG ĐỊNH DANH — TẠM THỜI, cho vòng kiểm duyệt của Bộ Công Thương.
   *
   * Đây là ĐIỂM CHẠM DUY NHẤT của lớp phủ KYC vào app. Gỡ về sau = xoá `useEffect` này, ba
   * dòng `import`, và ba file `api/kyc.ts` · `queries/kyc.ts` · `app/kyc.tsx`.
   *
   * Đặt cạnh lượt mời xác thực email ở trên vì cùng một lý do HARD#18: điều hướng đến từ
   * TRẠNG THÁI app sau khi stack đã mount, không từ sự kiện đăng nhập — bắn lúc đăng nhập
   * là chạy trên stack cũ rồi bị vứt.
   *
   * `data === undefined` (đang tải, hoặc BE chưa bật cờ nên query lỗi) thì KHÔNG đẩy đi đâu:
   * nghi ngờ thì để người dùng ở lại, đừng ném họ vào một form có thể không ai đang cần.
   */
  const { data: kyc } = useMyKyc();
  useEffect(() => {
    if (kyc === undefined || kyc?.status === 'approved') return;
    router.replace('/kyc');
  }, [kyc, router]);

  return (
    /*
     * `SupportFab` là ANH EM của `<Tabs>`, không nằm trong màn nào: nút phải theo người dùng qua
     * cả bốn tab. Đặt vào từng màn là bốn bản sao có thể lệch nhau, và nút sẽ nhấp nháy mỗi lần
     * đổi tab vì bị mount lại.
     *
     * Khai SAU `<Tabs>` để nằm trên, và `flex: 1` trên khung bọc để navigator vẫn chiếm trọn
     * màn — thiếu nó thì `<Tabs>` co lại bằng nội dung và cả cụm tab biến mất.
     */
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="chatlist" />
        <Tabs.Screen name="notif" />
        <Tabs.Screen name="profile" />
      </Tabs>

      <SupportFab />
    </View>
  );
}
