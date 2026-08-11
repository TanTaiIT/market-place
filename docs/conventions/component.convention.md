# component.convention

SoT cho: component & hook React Native — hình dạng props, state, Reanimated, danh sách, safe-area,
trạng thái rỗng/đang tải, LOC caps.

---

## 1. Thứ tự quyết định khi cần một mảnh UI

1. Có sẵn trong [`@/components/ui`](../../src/components/ui.tsx) chưa? (`PinButton`, `GhostButton`, `Field`,
   `Avatar`, `TapeChip`, `CatTape`, `ScreenHeader`, `TabHeader`, `EmptyState`, `Loading`)
2. Chưa có nhưng ≥2 màn sẽ dùng → thêm vào `ui.tsx` (nếu nhỏ) hoặc file PascalCase riêng (nếu có state/animation).
3. Chỉ một màn dùng → viết inline ngay trong route.

**Không dựng raw `<TextInput>`/`<Pressable>` cho nút và ô nhập khi đã có primitive tương ứng.**
Ngoại lệ hợp lệ: input có layout đặc thù không nhét vừa `Field` — ô giá có tiền tố `đ` và ô mô tả multiline
trong [post.tsx:120-141](../../app/post.tsx#L120-L141).

---

## 2. Khung một component

```tsx
import React from 'react';
import { …RN } from 'react-native';
// … external, rồi @/ nội bộ

/** WHY-only, tiếng Việt, nếu cần */
const TILTS = [-2, 1.6, 1, -1.4, -0.6, 2];      // hằng module — ngoài component, viết HOA

export function NoteCard({ item, index, onPress }: { … }) {
  // hooks → derived value → handler → return JSX
}

const styles = StyleSheet.create({ … });          // luôn ở cuối file
```

- Hằng số dùng lại (`TILTS`, `CHIP_TILTS`, `META`, `RECENT`, `CELL`, `AUTO_REPLIES`) đặt **ngoài** component
  ở đầu file, SCREAMING_SNAKE. Đặt trong component = tạo lại mỗi lần render.
- Không magic number lặp lại tại nhiều chỗ trong JSX — đặt tên thành hằng module.
- Không `React.memo`/`useCallback`/`useMemo` mang tính phòng xa. `useMemo` chỉ dùng khi vòng lặp thật sự tốn —
  tiền lệ duy nhất là `useDots` trong [Corkboard.tsx:12-32](../../src/components/Corkboard.tsx#L12-L32)
  (sinh vài trăm chấm theo kích thước màn hình).

---

## 3. State

- `useState` cục bộ cho UI state (form, filter, focus, toggle). Không đưa state server vào `useState`.
- Ba nơi chứa state, chọn đúng nơi: server state → TanStack Query · state sống lâu hơn màn hình → Zustand
  (`src/stores/**`, xem `store.convention.md`) · còn lại → `useState` tại chỗ. **Mặc định là `useState`** —
  chỉ lên store khi state bị ≥2 màn hình đọc và phải sống qua unmount.
- Context chỉ cho component vừa giữ state vừa render, hiện đúng một cái: `ToastProvider`. Nhu cầu "chia sẻ
  state" thuần tuý thì dùng store, đừng dựng Context mới.
- Form nhiều field gom thành một object state + setter phái sinh:

```ts
const [form, setForm] = useState({ name: '', phone: '', org: '' });
const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
```

- `useEffect` chỉ cho side-effect có lý do rõ: debounce ([search.tsx:19-22](../../app/search.tsx#L19-L22)),
  đồng bộ form từ server data ([settings.tsx:16-18](../../app/settings.tsx#L16-L18)), ẩn splash. Effect có
  timer **phải** cleanup. Cấm dùng `useEffect` để fetch — đó là việc của `useQuery`.

---

## 4. Reanimated 4

- Shared value + animated style khai ngay đầu component, đặt tên theo hiệu ứng (`press`, `bounce`, `rot`,
  `drop`, `scale`), style hậu tố `Style` (`pressStyle`, `saveStyle`, `pinStyle`).
- Animation vào-màn dùng preset entering, stagger theo index:
  `entering={FadeInDown.delay(index * 90).duration(420).springify().damping(16)}`.
- Animation do tương tác dùng `withSpring`/`withSequence`/`withTiming` trong handler, **không** trong render.
- Feedback nhấn đơn giản (scale/opacity) dùng luôn callback style của `Pressable`, không cần Reanimated:
  `style={({ pressed }) => [styles.card, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}`.
- `react-native-worklets/plugin` phải là plugin **cuối cùng** trong `babel.config.js` (Reanimated 4 đổi gói).
  Sai tên/sai vị trí → animation im lặng không chạy, không có lỗi nào báo.

---

## 5. Danh sách & scroll

- Danh sách dữ liệu → `FlatList`, `keyExtractor={(item) => String(item.id)}`. **Không** `.map()` trong `ScrollView`
  cho dữ liệu từ server.
- Header của màn cuộn được → `ListHeaderComponent` của chính `FlatList`, không lồng `FlatList` trong `ScrollView`.
- `ScrollView` chỉ cho nội dung ngắn cố định: hàng chip ngang, form.
- Màn có input trong vùng cuộn → `keyboardShouldPersistTaps="handled"` +
  `KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.
- Pull-to-refresh nối thẳng vào TanStack: `refreshing={isRefetching} onRefresh={refetch}`.

---

## 6. Loading / Empty / Error

Một màn chỉ có ba nhánh, dùng đúng primitive có sẵn:

```tsx
// nhánh chặn cả màn: detail chưa có dữ liệu
if (isLoading || !listing) return <Loading />;

// nhánh trong danh sách
ListEmptyComponent={isLoading ? <Loading onDark /> : <EmptyState icon="📌" text="…" />}
```

- Trên nền bần (`Corkboard`) phải truyền `onDark` để chữ/spinner không chìm.
- Lỗi của query **không** toast (xem `query.convention.md` §5) — rơi về `EmptyState`.
- Nút đang submit: khoá bằng `disabled={mutation.isPending}` + đổi nhãn/`loading`, không tự dựng cờ `useState`.

---

## 7. Safe area & nền

- Màn nền giấy: `<SafeAreaView style={styles.screen} edges={['top', 'bottom']}>` từ
  `react-native-safe-area-context` (không phải bản của `react-native`).
- Màn có `FlatList` tràn viền: dùng `useSafeAreaInsets()` rồi cộng vào `contentContainerStyle.paddingTop`,
  giữ nội dung cuộn dưới notch thay vì cắt cứng.
- Thanh cố định đáy: `paddingBottom: insets.bottom || <fallback>`.
- Nền bần: bọc `<Corkboard>`; nền giấy: `backgroundColor: C.paper`.

---

## 8. Điều hướng

- `const router = useRouter()`, `router.push('/listing/…')` cho đi tiếp, `router.replace()` sau khi hoàn tất
  một luồng (đăng nhập xong, đăng tin xong).
- Back phải có fallback vì route có thể mở trực tiếp bằng deep link:
  `router.canGoBack() ? router.back() : router.replace('/(tabs)/feed')` — đã đóng gói sẵn trong `ScreenHeader`,
  dùng lại chứ đừng chép.

---

## 9. LOC caps (HARD#11)

Đo bằng **tổng số dòng** của file (`wc -l`), không phải dòng có nội dung.

| Loại                        | Cap  |
| --------------------------- | ---- |
| Route / màn hình (`app/**`) | 250  |
| Component dùng chung        | 350  |
| Query module                | 200  |

Vượt cap → tách **theo vùng UI có state riêng**, không tách máy móc cho đủ số dòng.

**Known baseline — không mở lại tranh luận:** `app/chat/[id].tsx` (264) và `src/components/ui.tsx` (352, là
barrel có chủ ý) đã vượt cap từ trước. Chỉ chặn khi các file này *tăng thêm*, không chặn hiện trạng.
Các file còn lại đều dưới cap; sát nhất là `app/post.tsx` (242) — cẩn thận khi thêm vào nó.

---

## 10. Nhắc lại ranh giới

- Component trong `src/components/**` được đọc query hook, **không** được gọi mutation (HARD, xem `folder` §6).
- Component nhận dữ liệu qua props khi caller đã có sẵn (`NoteCard` nhận `item`), tự gọi hook chỉ khi dữ liệu đó
  độc lập với caller (`TabBar` tự đọc `useConversations` để chấm badge).
