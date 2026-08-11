# store.convention

SoT cho `src/stores/**` — Zustand. Ranh giới với TanStack Query, hình dạng một store, persist, route guard.

Thư viện: `zustand` (+ `@react-native-async-storage/async-storage` cho persist).
Chọn Zustand vì nó là analogue gần nhất của Pinia bên repo cha: store-là-hook, **không cần Provider**
(cây provider trong `app/_layout.tsx` đã 4 tầng), và đọc được ngoài React qua `getState()`.

---

## 1. Ranh giới — cái gì KHÔNG được vào store

Đây là rule quan trọng nhất của file này. Ba loại state, ba nơi ở:

| Loại state                                        | Ở đâu                     | Ví dụ                                        |
| ------------------------------------------------- | ------------------------- | -------------------------------------------- |
| **Server state** — có nguồn sự thật ở backend     | TanStack Query            | listings, profile, conversations, savedIds    |
| **Client state** — sống lâu hơn một màn hình      | Zustand (`src/stores/**`) | phiên đăng nhập                               |
| **UI state** — chết cùng màn hình                 | `useState` tại chỗ        | text ô tìm kiếm, filter danh mục, focus, form |

**Cấm nhân bản server state vào store.** Nếu một giá trị có thể lấy bằng `useQuery`, nó không thuộc về store —
hai nguồn sự thật sẽ lệch nhau ngay lần mutate đầu tiên. `useAuthStore` cố ý chỉ giữ `{ phone }` chứ **không**
giữ cả `Profile`, dù đăng nhập trả về `Profile` đầy đủ: hồ sơ vẫn đọc qua `useProfile()`.

**Cấm dựng store cho state chỉ một màn dùng.** Filter `cat` ở feed, text tìm kiếm, form settings — tất cả vẫn là
`useState`. Store mới chỉ được tạo khi state thật sự bị **≥2 màn hình đọc** hoặc phải **sống qua unmount**.

**Context vẫn tồn tại song song, không phải bị thay thế.** `ToastProvider` giữ nguyên là Context vì nó vừa giữ
state vừa render ra `Animated.View` — đó là component có state, không phải store.

---

## 2. Hình dạng một store

File: `src/stores/<domain>.ts` (lowercase, như `queries/` và `api/`). Xem [`auth.ts`](../../src/stores/auth.ts).

```ts
type AuthState = {
  session: Session | null;      // state
  hydrated: boolean;
  signIn: (session: Session) => void;   // action nằm cùng chỗ với state nó sửa
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()(persist((set) => ({ … }), { … }));
```

- Type state khai tường minh rồi truyền vào `create<T>()(...)` — chú ý **dấu ngoặc rỗng** `()` sau `create<T>`,
  bắt buộc khi có middleware để TS suy đúng.
- Action đặt **trong** store, không phải helper bên ngoài. Action chỉ `set` — không gọi API, không điều hướng.
- Không `immer`, không `devtools`. Chưa có nhu cầu; state đang phẳng và nhỏ.

---

## 3. Selector — luôn đọc từng mảnh

**Cấm** `const { session, signIn } = useAuthStore()` — lấy cả store khiến mọi component re-render với bất kỳ
thay đổi nào. Export sẵn selector nguyên tử ở cuối file store, call-site dùng chúng:

```ts
export const useIsAuthenticated = () => useAuthStore((s) => s.session !== null);
export const useAuthHydrated = () => useAuthStore((s) => s.hydrated);
export const useSignIn = () => useAuthStore((s) => s.signIn);
```

Chỉ export selector **đang có call-site**. Selector "cho đủ bộ" mà không ai gọi là deadcode — thêm một dòng
khi cần vẫn nhanh hơn là đọc một API thừa.

Selector phải trả về **primitive hoặc reference ổn định**. Trả về object/array mới mỗi lần gọi
(`(s) => ({ a: s.a, b: s.b })`) sẽ gây re-render vô hạn ở Zustand v5 — tách thành hai selector.

Ngoài React (guard, callback không phải hook) thì dùng `useAuthStore.getState()` — xem
[`queries/auth.ts`](../../src/queries/auth.ts).

---

## 4. Persist

```ts
{
  name: 'ghim-auth',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (s) => ({ session: s.session }),
  onRehydrateStorage: () => () => useAuthStore.setState({ hydrated: true }),
}
```

- `partialize` **bắt buộc** khi store có cờ runtime: ghi `hydrated` xuống đĩa thì lần mở app sau sẽ đọc lại
  đúng giá trị cũ (`false`) và app treo ở màn boot.
- AsyncStorage là **bất đồng bộ** → phải có cờ `hydrated` và chặn render cho tới khi đọc xong, nếu không guard
  chạy với `session = null` và người dùng thấy màn login nháy lên rồi mới nhảy vào feed.
  Chỗ chặn: `const ready = (loaded || error) && authHydrated` trong
  [app/\_layout.tsx:51-61](../../app/_layout.tsx#L51-L61).
- Callback của `onRehydrateStorage` chạy **cả khi đọc đĩa lỗi** — luôn bật `hydrated` trong mọi nhánh, đừng
  `if (state)` rồi bỏ nhánh lỗi.
- Chỉ persist dữ liệu **không nhạy cảm**. Khi có token thật: đổi sang `expo-secure-store`, không dùng AsyncStorage.

---

## 5. Chiều phụ thuộc

```text
app/**  →  components/**  →  queries/**  →  api/**
                                 ↓
                             stores/**   (lá, chỉ import thư viện ngoài)
```

- `stores/**` **không** import `queries`, `api`, `components`, `app`. Runtime import type từ `api/db.ts` cũng
  tránh luôn — `auth.ts` tự khai `Session` thay vì mượn `Profile`.
- `queries/**` **được** đọc/ghi store. Đó là chỗ đặt việc phối hợp hai layer:

```ts
// queries/auth.ts — đăng xuất phải dọn cả cache, không chỉ xoá phiên
export function useSignOut() {
  const qc = useQueryClient();
  return () => {
    useAuthStore.getState().signOut();
    qc.clear();
  };
}
```

- `app/**` và `components/**` gọi selector trực tiếp cho việc **đọc**; việc **ghi có kèm hệ quả** (dọn cache,
  reset thứ khác) phải đi qua một hook ở `queries/**` — đúng tinh thần HARD#2.

---

## 6. Auth & route guard

Guard dùng `<Stack.Protected guard={boolean}>` của expo-router, khai tập trung tại
[app/\_layout.tsx:76-92](../../app/_layout.tsx#L76-L92). Không tự viết `useEffect` + `router.replace` để chặn route.

**Route mới cần đăng nhập thì phải thêm một dòng `<Stack.Screen>` vào khối `guard={isAuthenticated}`**, kể cả khi
nó không cần option riêng. Screen không khai trong khối đó vẫn được expo-router đăng ký theo file path và mở
được bằng deep link — tức là không hề được bảo vệ.

**Không tự điều hướng sau khi đổi trạng thái auth.** `signIn()` / `signOut()` làm đổi tập route khả dụng; gọi
`router.replace()` ngay trong cùng tick sẽ chạy trước khi route đích kịp đăng ký. Để `Stack.Protected` +
[app/index.tsx](../../app/index.tsx) lo phần điều hướng.

---

## 7. Khi nào được thêm store thứ hai

Chỉ khi state thoả **cả ba**: không phải server state · bị ≥2 màn hình đọc · phải sống qua unmount.
Đạt đủ thì tạo `src/stores/<domain>.ts` mới — **không** nhồi thêm vào `auth.ts`. Một store một domain.
