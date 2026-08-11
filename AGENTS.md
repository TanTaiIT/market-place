# Ghim (VueRoute) — Agent Rules

Expo SDK 54 · React Native 0.81 · React 19 · expo-router 6 · TanStack Query v5 · Zustand · Reanimated 4 · TS 5.9 strict.

File này = **invariants only**. Chi tiết nằm ở `docs/conventions/*.convention.md`, dispatch qua
`conventions.hub.md`. Đừng chép lại chi tiết vào đây — sửa file SoT.

---

## HARD Rules — vi phạm = reject ngay

`SoT` = convention file giữ chi tiết (`—` = file này chính là SoT).
`Gate` = thứ bắt lỗi một cách cơ học. **`Gate —` nghĩa là review-only, tức là rule bạn phải thực sự thuộc.**

| #  | Invariant                                                                                            | SoT         | Gate            |
| -- | ---------------------------------------------------------------------------------------------------- | ----------- | --------------- |
| 1  | `export default` **chỉ** trong `app/**` (expo-router resolve theo file path); `src/**` luôn named export | folder      | —               |
| 2  | Không gọi API / đặt business rule trong `app/**`; route compose hook từ `src/queries/**`               | query       | —               |
| 3  | Mọi query key qua factory `qk` (`src/queries/keys.ts`) — không array literal inline tại call-site      | query       | —               |
| 4  | Mutation có `onMutate` **bắt buộc** kèm rollback `onError` + invalidate `onSettled`/`onSuccess`        | query       | —               |
| 5  | `useQuery` cho read · `useMutation` cho write · query nhận param phải có `enabled` guard               | query       | —               |
| 6  | Một lần thất bại = **một** bề mặt lỗi, qua `useToast`. Cấm `catch` nuốt lỗi, cấm 2 surface/call-site   | query §5    | —               |
| 7  | Cross-layer import dùng alias `@/`; `../` bị cấm; cùng thư mục dùng `./`                               | folder      | oxlint          |
| 8  | Màu / font / shadow lấy từ `@/theme` (`C`, `F`, `shadow`) — không hardcode hex mới tại call-site        | style       | —               |
| 9  | Không `any`; type-only import phải là `import type`                                                    | typescript  | oxlint          |
| 10 | Style tĩnh nằm trong `StyleSheet.create` cuối file; chỉ phần phụ thuộc state mới inline                | style       | —               |
| 11 | LOC caps (tổng dòng): route ≤250 · component chia sẻ ≤350 · query module ≤200                          | component   | —               |
| 12 | Comment WHY-only, **tiếng Việt** (khớp code hiện có) — không diễn giải lại WHAT                        | typescript  | —               |
| 13 | `react-native-worklets/plugin` phải là plugin **cuối cùng** trong `babel.config.js`                     | —           | —               |
| 14 | Không chạy `scripts/hooks/review-gate.mjs --write` từ repo này (đóng dấu nhầm cây app cha)             | —           | —               |
| 15 | Tạo/đổi tên file hoặc thư mục → đọc `folder.convention.md` TRƯỚC                                        | folder      | —               |
| 16 | Server state ở TanStack · state sống lâu hơn màn hình ở Zustand · còn lại `useState`. Cấm nhân bản server state vào store | store | —      |
| 17 | Route cần đăng nhập **phải** khai `<Stack.Screen>` trong khối `guard={isAuthenticated}` của `app/_layout.tsx` | store   | —               |
| 18 | Đổi trạng thái auth thì **không** tự `router.replace` — để `Stack.Protected` điều hướng                 | store       | —               |
| 19 | **Không secret trong repo này.** Bundle RN giải nén được: cấm `apiSecret`/`apiKey`/token bên thứ ba. Upload ảnh chỉ qua unsigned preset | query §9 | — |

---

`npm run lint` hiện resolve `oxlint` từ `node_modules/.bin` của repo cha qua ancestor PATH — chỉ chạy được từ
checkout này. Nếu báo "command not found" thì repo đã bị clone standalone: thêm `oxlint` vào devDependencies riêng.

Commit trong repo này dùng bypass đã ghi nhận để lý do nằm lại trong git history:
`[skip-review: nested repo, reviewed via /review-diff-rn]`.

---

## Kiến trúc — chiều phụ thuộc một chiều

```text
app/**  (routes, expo-router)
   ↓
src/components/**  ──┐
   ↓                 │
src/queries/**  ─────┤→  src/theme · src/stores  (lá, chỉ import thư viện ngoài)
   ↓                 │
src/api/**  ─────────┘
```

- Mũi tên ngược = vi phạm. `src/api/**` không được biết tới `queries`/`stores`/`components`/`app`.
- `src/components/**` được phép đọc query (vd `TabBar.tsx` dùng `useConversations`), nhưng **mutation chỉ
  được gọi từ `app/**`** — đó là ranh giới đang đúng trên toàn bộ codebase, giữ nguyên nó.
- `src/queries/**` được đọc/ghi store (`queries/auth.ts`); chiều ngược lại thì cấm.
- `src/api/db.ts` khai báo domain type + giữ phần state còn local (tin đã lưu, hội thoại). Tin đăng, hồ sơ
  và thông báo đã đi qua BE thật: `client.ts` gọi SDK trong `src/api/generated/**` (generate từ OpenAPI của
  repo `market` bằng `npm run api:sync`, **không sửa tay**), `http.ts` giữ base URL + Bearer token.
  Chi tiết phần nào thật / phần nào còn local: `query.convention.md` §1.

---

## Convention Router — hub dispatch

1. Đọc `docs/conventions/conventions.hub.md` (index + Must-Know Router).
2. Tra cứu / việc nhỏ → dừng ở hub.
3. Implement cần chi tiết → đọc **≤1** file `.convention.md` khớp nhất.

Không có dòng nào khớp và hub không đủ → hỏi user trước khi đọc thêm convention file.
