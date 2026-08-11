# Conventions Hub — Ghim (VueRoute)

Index **duy nhất** cho convention của repo này. Quy tắc dùng: tra ở đây trước; chỉ mở **≤1** file
`.convention.md` khi thực sự cần chi tiết để implement. Không bao giờ bulk-read cả thư mục.

| File                          | Sở hữu                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `folder.convention.md`        | Tập layer, file-based routing, đặt tên file, alias/import, export shape, chiều phụ thuộc |
| `typescript.convention.md`    | strict mode, props typing, `as const`, type import, parse route param, cấm `any`         |
| `component.convention.md`     | Component & hook RN: props shape, state, Reanimated, list, safe-area, LOC caps           |
| `query.convention.md`         | `src/api/**` + `src/queries/**`: `qk`, query/mutation, optimistic, bề mặt lỗi            |
| `store.convention.md`         | `src/stores/**` (Zustand): ranh giới với Query, selector, persist, auth & route guard     |
| `style.convention.md`         | Theme token `C`/`F`/`shadow`, `StyleSheet.create`, style động, port CSS → RN             |

---

## Must-Know Router — câu hỏi → chỗ trả lời

| Đang làm gì                                     | Đọc              |
| ----------------------------------------------- | ---------------- |
| Thêm màn hình mới / route mới                   | folder           |
| Đặt tên file, tạo thư mục, di chuyển file       | folder           |
| Thêm data hook, sửa cache, optimistic update    | query            |
| Thêm endpoint / đổi `client.ts` sang HTTP thật  | query            |
| Upload ảnh, Cloudinary, xử lý secret / khoá API | query §9         |
| Đăng nhập/đăng xuất, chặn route, state dùng chung | store          |
| Phân vân state để ở đâu (Query / store / local) | store §1         |
| Viết component dùng chung, tách component       | component        |
| Animation (Reanimated), gesture, danh sách dài  | component        |
| Màu, font, shadow, spacing, style động          | style            |
| Type cho props / route param / domain model     | typescript       |
| Hiển thị lỗi, toast, empty state, loading       | query §5 + component §6 |

---

## Trả lời nhanh (không cần mở file nào)

- Alias: `@/*` → `./src/*`. Cross-layer dùng `@/`, cùng thư mục dùng `./`. `../` bị oxlint chặn.
- `export default` chỉ có ở `app/**`. `src/**` luôn named export.
- Route file đặt tên lowercase theo URL segment; component trong `src/components/**` đặt PascalCase.
- Query key: luôn `qk.xxx()` từ `src/queries/keys.ts`.
- State: server → TanStack · sống lâu hơn màn hình → Zustand `src/stores/**` · còn lại → `useState`.
- Route mới cần đăng nhập → thêm `<Stack.Screen>` vào khối `guard={isAuthenticated}` trong `app/_layout.tsx`.
- Màu: `C.pin`, `C.ink`… từ `@/theme`. Font: `F.uiBold`, `F.hand`… Shadow: `shadow` / `shadowSoft`.
- Lỗi hiện ra bằng `useToast()` từ `@/components/Toast`.
- **Không secret nào được nằm trong repo này** — upload ảnh chỉ qua Cloudinary unsigned preset.
- Comment tiếng Việt, WHY-only.
- Dữ liệu đến từ BE thật qua SDK generated; `src/api/generated/**` không sửa tay, regen bằng `npm run api:sync`.
- Base URL của BE: `EXPO_PUBLIC_API_URL` trong `.env` (xem `.env.example`) — thiết bị thật phải dùng IP LAN.
- Verify: `npm run lint` + `npm run typecheck` (cwd = `docs/market-place`).
