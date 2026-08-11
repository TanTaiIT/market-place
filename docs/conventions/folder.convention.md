# folder.convention

SoT cho: tập layer, file-based routing, đặt tên file/thư mục, alias & import, hình dạng export,
chiều phụ thuộc. **Đọc file này TRƯỚC khi tạo / đổi tên / di chuyển bất kỳ file hay thư mục nào** (HARD#15).

---

## 1. Tập layer đóng

Chỉ tồn tại hai gốc, không thêm gốc thứ ba:

```text
app/          — routes. expo-router resolve theo file path. KHÔNG chứa gì ngoài route + layout.
src/
├── api/      — nguồn dữ liệu + domain type (db.ts, client.ts)
├── queries/  — TanStack hook + key factory
├── stores/   — Zustand store cho client state sống lâu hơn màn hình
├── components/ — UI dùng lại, không gắn với một route cụ thể
└── theme/    — token màu / font / shadow
```

Tên layer con **không được lặp lại lồng nhau**: cấm `src/components/components/`, `src/api/api/`.

Muốn thêm layer mới (`utils/`, `hooks/`, `constants/`…): chỉ khi có **≥2 call-site thật** đã tồn tại.
Một helper dùng một chỗ thì để ngay trong file dùng nó — `nowTime()`/`delay()`/`clone()` trong
[client.ts:9-15](../../src/api/client.ts#L9-L15) là hình mẫu đúng, đừng promote lên `utils/`.

---

## 2. `app/**` — file-based routing

| Loại              | Quy tắc đặt tên                | Ví dụ đang có                                    |
| ----------------- | ------------------------------ | ------------------------------------------------ |
| Route thường      | lowercase, chính là URL segment | `feed.tsx`, `post.tsx`, `mylistings.tsx`         |
| Route động        | `[param].tsx`                  | `listing/[id].tsx`, `chat/[id].tsx`              |
| Layout            | `_layout.tsx`                  | `app/_layout.tsx`, `app/(tabs)/_layout.tsx`      |
| Group không ảnh hưởng URL | `(name)/`              | `app/(tabs)/`                                    |
| Entry redirect    | `index.tsx`                    | `app/index.tsx` → redirect `/login`              |

Quy tắc:

- **Một file = một route.** Không đặt file phụ trợ (`helpers.ts`, `types.ts`, sub-component) trong `app/**` —
  expo-router sẽ coi nó là route. Thứ dùng lại đi vào `src/components/**`.
- Route file `export default function <TênMànHình>()` — tên hàm PascalCase mô tả màn hình, **không** cần trùng
  tên file: `mylistings.tsx` → `MyListings`, `listing/[id].tsx` → `ListingDetail`.
- Route mới có tab → thêm vào `app/(tabs)/` **và** khai báo trong `META` của
  [TabBar.tsx:9-14](../../src/components/TabBar.tsx#L9-L14); thiếu bước hai thì tab bị filter mất im lặng.
- Route cần animation riêng → khai `<Stack.Screen name="…" options={…}>` trong
  [app/\_layout.tsx](../../app/_layout.tsx), không đặt option rải rác trong từng màn.

---

## 3. `src/**` — đặt tên file

| Thư mục       | Casing     | Nội dung một file                                       |
| ------------- | ---------- | ------------------------------------------------------- |
| `components/` | PascalCase | Một component (hoặc một cụm Provider + hook của nó)      |
| `queries/`    | lowercase  | Hook theo domain (`listings.ts`, `chat.ts`) + `keys.ts`  |
| `stores/`     | lowercase  | Một store một domain (`auth.ts`)                        |
| `api/`        | lowercase  | `db.ts` (fixture + type), `client.ts` (lớp gọi)          |
| `theme/`      | lowercase  | `index.ts`                                              |

- Tên file PascalCase **là tên tính năng**, không bắt buộc là tên export duy nhất:
  `Toast.tsx` export `ToastProvider` + `useToast` — hợp lệ, vì cả hai thuộc cùng một tính năng.
- Ngoại lệ có chủ đích: [`ui.tsx`](../../src/components/ui.tsx) là **barrel các primitive nhỏ**
  (`TapeChip`, `PinButton`, `Field`, `Avatar`, `ScreenHeader`, `EmptyState`, `Loading`…), nên đặt lowercase để
  phân biệt với file-một-component. Đừng tạo thêm barrel thứ hai; primitive mới vào chính `ui.tsx`.
- Tách khỏi `ui.tsx` khi component đạt **một trong hai**: cần state/animation riêng đáng kể, hoặc >60 dòng.
  Lúc đó lên file PascalCase riêng (`NoteCard.tsx`, `Corkboard.tsx` là tiền lệ).

---

## 4. Export shape (HARD#1)

- `app/**`: **phải** có `export default`. Đây là hợp đồng của expo-router.
- `src/**`: **chỉ** named export. Toàn repo hiện có 0 `export default` trong `src/` — giữ nguyên con số đó.
- Hệ quả cho deadcode review: mọi default export dưới `app/**` là route, **không có importer nào cả** —
  đừng bao giờ báo nó là dead code.

---

## 5. Import & alias

```jsonc
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```

| Tình huống                      | Viết                                | Ghi chú                        |
| ------------------------------- | ----------------------------------- | ------------------------------ |
| Khác layer                      | `import { api } from '@/api/client'` | Bắt buộc                       |
| Cùng thư mục                    | `import { qk } from './keys'`        | Hợp lệ, đang dùng              |
| Đi ngược lên cha                | `../anything`                        | **Cấm** — oxlint error         |

Thứ tự import (theo đúng thói quen đang có, không có formatter tự sắp — làm tay):

1. `react`
2. `react-native`
3. Thư viện ngoài (`expo-router`, `expo-linear-gradient`, `@tanstack/react-query`, `react-native-reanimated`,
   `react-native-safe-area-context`…)
4. Nội bộ theo `@/` — components → queries → api → theme

Xem [feed.tsx:1-10](<../../app/(tabs)/feed.tsx#L1-L10>) làm mẫu chuẩn.

---

## 6. Chiều phụ thuộc — một chiều, không ngoại lệ

```text
app/** → components/** → queries/** → api/** → theme
                             ↓
                         stores/**
```

- `theme` và `stores` là lá: chỉ được import thư viện ngoài. Import layer khác trong repo = vi phạm.
- `api/db.ts` được phép `import type { Grad } from '@/theme'` — type-only, không tạo phụ thuộc runtime.
- `components/**` được đọc query hook (`TabBar` dùng `useConversations`), nhưng **không được gọi mutation**.
  Mutation chỉ khởi phát từ `app/**` — hiện đúng 100% call-site, đừng phá.
- `queries/**` được đọc/ghi store (`queries/auth.ts` dùng `useAuthStore.getState()`); chiều ngược lại thì cấm.
- Cấm `api/**` biết tới `queries`, `stores`, `components`, hay `app`.

---

## 7. Không thuộc về đâu cả

Không tạo mới: `docs/` con khác, `openspec/`, delta-spec, hay file convention thứ sáu — bộ này là đủ.
Không tạo `index.ts` barrel cho `components/` hay `queries/`: import trực tiếp theo đường dẫn rõ ràng, như hiện tại.

---

## Known deviations — đã biết, đừng mở lại tranh luận

- `ui.tsx` lowercase (mục §3) — có chủ ý.
- `app/index.tsx` chỉ chứa một `<Redirect href="/login" />` — đúng vai trò entry, không cần gộp vào chỗ khác.
