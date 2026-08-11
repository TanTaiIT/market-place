# typescript.convention

SoT cho: strict mode, cách type props, `as const`, type-only import, parse route param, cấm `any`.
Gate: `npm run typecheck` (`tsc --noEmit`, baseline sạch) + `npm run lint`.

---

## 1. Nền

`tsconfig.json` extends `expo/tsconfig.base`, bật `"strict": true`. Không nới lỏng: cấm thêm
`strictNullChecks: false`, `noImplicitAny: false`, hay `skipLibCheck` để né lỗi thật.

`jsx` đến từ `expo/tsconfig.base` **bên trong `node_modules`**. Nếu typecheck bỗng tuôn ra hàng loạt
`ts(17004)`, đó là thiếu dependency chứ không phải hỏng type — chạy `npm install` trước khi sửa gì.

---

## 2. Cấm tuyệt đối

| Cấm                                   | Thay bằng                                                        |
| ------------------------------------- | ---------------------------------------------------------------- |
| `any` (oxlint **error**)              | `unknown` + narrow, hoặc generic                                  |
| `@ts-ignore` / `@ts-expect-error`      | Sửa type. Nếu bất khả kháng: `@ts-expect-error` + comment lý do   |
| `import { type X }` lẫn value import  | `import type { X } from …` riêng (oxlint `consistent-type-imports`) |
| Non-null `!` để né `strictNullChecks` | Optional chain + fallback: `savedIds?.includes(id) ?? false`      |

Chỗ đang làm đúng: `const saved = !!savedIds?.includes(listingId)` tại
[listing/\[id\].tsx:32](<../../app/listing/[id].tsx#L32>) — coerce rõ ràng thay vì `!`.

---

## 3. Type props của component

**Inline object type ngay tại tham số** là hình dạng chuẩn của repo này — không tách `type XxxProps` riêng
trừ khi type đó được export hoặc dùng lại:

```ts
export function NoteCard({ item, index, onPress }: {
  item: Listing;
  index: number;
  onPress: () => void;
}) { … }
```

Mở rộng props của primitive RN thì giao với type gốc, không chép lại field:

```ts
// ui.tsx — Field kế thừa toàn bộ TextInputProps
export function Field({ label, hand, style, ...props }: TextInputProps & { label: string; hand?: boolean }) { … }
```

Props tuỳ chọn có default → khai `?` rồi default ở destructure (`size = 36`, `depth = 6`, `index = 0`),
**không** dùng `defaultProps`.

Callback prop luôn có kiểu hàm tường minh: `onPress: () => void`, không `Function`.

---

## 4. Domain type

Domain model sống ở [`src/api/db.ts`](../../src/api/db.ts) và là **SoT duy nhất**: `Listing`, `Message`,
`Conversation`, `Notif`, `Profile`. Mọi layer khác `import type` từ đó, không định nghĩa bản sao.

- Union literal cho trạng thái hữu hạn: `status: 'live' | 'pending'`, `from: 'me' | 'them'`,
  `kind: 'org' | 'chain' | 'system'`. Không dùng `string` cho tập đóng, không dùng runtime `enum`.
- Tuple readonly khi độ dài cố định: `export type Grad = readonly [string, string]`.
- Fixture khai kiểu bằng `as` **một lần ở mảng ngoài** (`] as Listing[]`), không annotate từng phần tử.

Khi sang backend thật: type ở `db.ts` vẫn là domain type; nếu wire shape khác domain shape, map trong
`client.ts` — **không** để shape của server rò lên `queries/` hay `app/`.

---

## 5. `as const` — dùng khi nào

Dùng cho bảng tra cứu và tập token cần literal type:

```ts
export const C  = { ink: '#182412', … } as const;   // theme/index.ts
export const qk = { listing: (id: number) => ['listing', id] as const, … };
const ICON_BG   = { org: C.mossLight, chain: '#FDEFD9', system: C.sand } as const;  // notif.tsx
```

`as const` trên return của `qk.*` là bắt buộc — TanStack cần key là readonly tuple để suy luận đúng.

Mảng thuần dữ liệu hiển thị (`CATEGORIES`, `TILTS`, `AUTO_REPLIES`, `RECENT`) **không** cần `as const`;
chúng chỉ được index bằng số. Đừng thêm cho "đồng bộ".

Bảng tra theo khoá union thì khai `Record<K, V>` tường minh:
`const META: Record<string, { icon: string; label: string }>` ([TabBar.tsx:9](../../src/components/TabBar.tsx#L9)).

---

## 6. Route param

Param từ expo-router **luôn là string**. Type tại nguồn rồi ép sang domain type ngay dòng dưới:

```ts
const { id } = useLocalSearchParams<{ id: string }>();
const listingId = Number(id);
```

Số đã ép **phải** được guard trước khi fetch — xem `enabled: Number.isFinite(id)` trong
[queries/listings.ts:23](../../src/queries/listings.ts#L23). Không truyền `NaN` xuống query.

---

## 7. Generic & narrowing

- Generic ngắn gọn, chỉ khi thật sự đa hình: `const clone = <T,>(v: T): T => …`.
  (Dấu phẩy sau `T` là bắt buộc trong file `.ts` compile bằng Babel/JSX — đừng bỏ.)
- Mutation context: đừng annotate thủ công, để TanStack suy từ giá trị `onMutate` trả về
  (`return { prev }` → `ctx?.prev` có type đúng). Chỉ cần `ctx?.` guard vì context có thể `undefined`.
- Type param của cache helper đặt ở generic, không ở biến:
  `qc.getQueryData<Listing[]>(qk.myListings())`, `qc.setQueryData<Conversation>(key, (old) => …)`.
- Biến không dùng phải prefix `_` (`onError: (_e, _id, ctx) => …`) — oxlint chỉ tha pattern `^_`.

---

## 8. Type assertion

Assertion là lựa chọn cuối. Hiện chỉ có một loại được chấp nhận:

```ts
export const shadow = Platform.select({ ios: {…}, default: { elevation: 4 } }) as object;
```

`Platform.select` trả `T | undefined` dù nhánh `default` luôn có; `as object` là để spread `...shadow` vào
`StyleSheet.create` không vỡ. **Đây là deviation đã biết** — không nhân bản pattern này sang chỗ khác, và
đừng đề xuất "sửa cho sạch" trong review.

---

## 9. Comment & JSDoc

- Tiếng Việt, WHY-only. Nêu lý do hoặc nguồn gốc, không mô tả lại code.
- JSDoc một dòng cho export có ý nghĩa nghiệp vụ hoặc bắt nguồn từ prototype CSS:

```ts
/** Bỏ tim / thả tim với optimistic update — UI phản hồi ngay lập tức */
/** Tái tạo `box-shadow: 0 6px 0 var(--pin-dark)` của web: lớp nền tối + mặt nút trượt xuống khi nhấn. */
```

- Không JSDoc cho hook `useQuery` thuần một dòng (`useProfile`, `useNotifications`…) — tên đã đủ nghĩa.
