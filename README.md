# Ghim — React Native (Expo SDK 54)

Bản port đầy đủ của prototype HTML `ghim-mobile-ui.html` sang React Native, dùng
**expo-router**, **TanStack React Query v5** và **Reanimated 4**.

Đã kiểm chứng: `tsc --noEmit` sạch lỗi và `expo export` bundle thành công với
expo 54.0.36 / react-native 0.81.4 / react 19.1.0.

---

## 1. Chạy dự án

```bash
cd ghim
npm install
npx expo start -c
```

Mở Expo Go trên iPhone → quét mã QR. Dự án nhắm đúng **SDK 54** nên Expo Go
client 1017756 của bạn chạy được ngay, không cần dev build.

Nếu về sau muốn Expo tự chỉnh version cho khớp SDK:

```bash
npx expo install --fix
```

---

## 2. Hai điểm dễ vấp đã xử lý sẵn

**Reanimated 4 đổi babel plugin.** Từ bản 4.x, plugin chuyển sang gói
`react-native-worklets`. Dùng tên cũ sẽ khiến animation im lặng không chạy:

```js
// babel.config.js — plugin phải nằm cuối cùng
plugins: ['react-native-worklets/plugin']
```

**`babel-preset-expo` bị cài lồng.** npm đặt gói này trong
`node_modules/expo/node_modules/`, khiến Metro báo
`Cannot find module 'babel-preset-expo'`. Đã khai báo tường minh trong
`devDependencies` để Babel resolve được từ thư mục gốc.

---

## 3. Cấu trúc

```
app/                        # expo-router: mỗi file là một route
├── _layout.tsx             # font, QueryClientProvider, ToastProvider, Stack
├── index.tsx               # redirect → /login
├── login.tsx  register.tsx
├── (tabs)/
│   ├── _layout.tsx         # Tabs + tab bar tự vẽ
│   ├── feed.tsx            # bảng tin (corkboard, 2 cột)
│   ├── chatlist.tsx  notif.tsx  profile.tsx
├── search.tsx              # tìm kiếm có debounce
├── post.tsx                # ghim tin mới
├── listing/[id].tsx        # chi tiết tin
├── chat/[id].tsx           # phòng chat
└── mylistings.tsx  saved.tsx  settings.tsx

src/
├── theme/index.ts          # màu + font + shadow, port từ :root của CSS
├── api/db.ts               # dữ liệu mẫu trong bộ nhớ
├── api/client.ts           # lớp API giả (có độ trễ)
├── queries/keys.ts         # query key tập trung
├── queries/listings.ts     # hook cho tin đăng, saved, profile
├── queries/chat.ts         # hook cho chat
└── components/             # Corkboard, NoteCard, TabBar, Toast, ui.tsx
```

---

## 4. React Query

`src/api/client.ts` là lớp API giả, mọi hàm đều `async` và có `delay()` để
loading / refetch / optimistic update hoạt động thật. **Khi có backend, chỉ cần
thay ruột từng hàm bằng `fetch()`** — toàn bộ hook và màn hình giữ nguyên.

Ba mutation dùng optimistic update, UI phản hồi trước khi server trả lời:

| Hành động | Cách hoạt động |
|---|---|
| Thả tim / bỏ tim | `onMutate` sửa cache `saved.ids` ngay, lỗi thì rollback |
| Xoá tin đăng | Gỡ khỏi list ngay, kèm animation `SlideOutRight` |
| Gửi tin nhắn | Bong bóng hiện tức thì, rồi hiện "đang nhập..." và tự trả lời |

Query key nằm gọn trong `src/queries/keys.ts` để invalidate không bị lệch.

---

## 5. Animation đã port

| Prototype (CSS) | React Native |
|---|---|
| `@keyframes pinFall` | `withSpring` translateY từ -140 (màn login) |
| `@keyframes noteIn` + delay so le | `FadeInDown.delay(i * 90).springify()` |
| `.note-card:nth-child(n)` xoay | mảng `TILTS` xoay `-2°/1.6°/1°/-1.4°/-0.6°/2°` |
| `box-shadow: 0 6px 0 var(--pin-dark)` | lớp nền tối + mặt nút trượt xuống khi nhấn |
| `@keyframes saveBounce` | `withSequence(withSpring(1.3), withSpring(1))` + xoay |
| `@keyframes pinPress` | `withSequence` lún 6px → nảy -3px → về 0 |
| `.photo-drop.filled` + kẹp giấy xoay | `withTiming` opacity/scale + `withSpring` góc kẹp |
| `.toast.show` | `withSpring` translateY, ToastProvider dùng chung |
| `@keyframes typingDot` | `withRepeat` + `withDelay` cho từng chấm |
| `:active { transform: scale(...) }` | `Pressable` với style theo `pressed` |

Vân bảng bần: RN không có `repeating-radial-gradient` nên `Corkboard.tsx` rải
lưới chấm tính sẵn (deterministic, không random lại mỗi lần render).
Ảnh của tin dùng `expo-linear-gradient` thay `linear-gradient(135deg, …)`.

---

## 6. Khác biệt có chủ ý so với prototype

**Bottom nav còn 4 mục + FAB** thay vì 6 mục. Sáu mục trên màn hình thật rất
chật, và bản thân prototype cũng ẩn nav khi vào màn Tìm kiếm. Tìm kiếm giờ vào
qua ô search ở đầu bảng tin — lối này prototype đã có sẵn.

Muốn quay lại đúng 6 mục: thêm route vào `app/(tabs)/` và bổ sung vào `META`
trong `src/components/TabBar.tsx`.

---

## 7. Việc cần làm khi lên production

- Thay `src/api/client.ts` bằng HTTP thật; cân nhắc thêm `AsyncStorage`
  persister cho React Query để dùng offline.
- Đăng nhập hiện chưa lưu phiên — thêm token vào SecureStore và chặn route.
- `expo-image-picker` cho ô chọn ảnh (hiện chỉ là animation demo).
- Icon và splash: thêm file vào `assets/` rồi khai báo trong `app.json`.
