# query.convention

SoT cho: `src/api/**` + `src/queries/**` — key factory, read/write split, optimistic update, bề mặt lỗi.
Đây là layer chịu nhiều HARD rule nhất (#2 → #6).

---

## 1. Phân vai ba file

| File                     | Chịu trách nhiệm                                                              | Cấm                                 |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------- |
| `src/api/db.ts`          | Domain type + hằng dữ liệu (`CATEGORIES`, `CHAT_COLORS`) + state local còn lại | Gọi hook, biết tới React            |
| `src/api/client.ts`      | Mọi hàm truy cập dữ liệu + mapper DTO → domain, ném `Error` khi hỏng           | Import React / TanStack / component |
| `src/api/http.ts`        | Base URL + Bearer token cho SDK (`runtimeConfigPath`)                          | Import `stores/**` (§6 folder)      |
| `src/api/generated/**`   | Output của `npm run api:sync` — **không sửa tay**, oxlint đã ignore            | Bị import ngoài `client.ts`         |
| `src/api/cloudinary.ts`  | Upload ảnh lên Cloudinary — dịch vụ ngoài **thật**                             | Chứa bất kỳ khoá bí mật nào (§9)    |
| `src/queries/*.ts`       | Hook `useQuery`/`useMutation`, quản lý cache                                   | Chứa business rule của màn hình     |

`client.ts` gọi **BE thật** qua SDK generated từ OpenAPI của repo `docs/market`. Chữ ký hàm giữ nguyên để
hook và màn hình không đổi; ngoại lệ duy nhất là `id` đã thành `string` (ObjectId 24 hex), không còn là số.

**Không còn nhóm nào là local.** Bảng liệt kê ba ngoại lệ ở đây (tin đã lưu, chat, `createListing`)
đã bị gỡ vì cả ba đều đã có route thật: `/favorites` (thêm sau cùng), `/chats`, `POST /listings`.
Thứ duy nhất không đi qua OpenAPI là **realtime của chat** — nó đi socket, xem `src/api/socket.ts`.

Hệ quả: một hàm mới trong `client.ts` mà không gọi SDK là dấu hiệu sai, không phải một ngoại lệ nữa.

SDK **không throw**, nó trả `{ data, error }`. `unwrap()` trong `client.ts` là chỗ duy nhất đổi cả hai
nhánh thành `Error` tiếng Việt — mọi hàm mới phải đi qua nó, đừng đọc `res.error` ở call-site.

Regenerate: `npm run api:sync` (đọc `../market/openapi.json`, đổi chỗ thì set `OPENAPI_INPUT`).
Bên `docs/market` phải chạy `npm run openapi:export` trước để file spec mới nhất.

**Listing/notification bắt buộc có token**: BE lấy tenant từ JWT, gọi ẩn danh trả
`400 Missing tenant context`. Mọi màn dùng chúng đều nằm sau auth guard nên đúng luồng thật.

Hàm trong `client.ts` phải `throw new Error('<thông điệp tiếng Việt>')` khi thất bại, không trả `null` im lặng:

```ts
const found = db.listings.find((l) => l.id === id);
if (!found) throw new Error('Không tìm thấy tin này');
```

---

## 2. Query key — luôn qua `qk` (HARD#3)

Mọi key nằm trong [`src/queries/keys.ts`](../../src/queries/keys.ts). Call-site **không bao giờ** viết array
literal cho `queryKey`.

```ts
queryKey: qk.listing(id)        // ✅
queryKey: ['listing', id]       // ❌
```

Ngoại lệ duy nhất đang tồn tại: **invalidate theo prefix** dùng literal gốc để quét cả nhánh —
`qc.invalidateQueries({ queryKey: ['listings'] })` xoá cả `qk.listings(cat)` lẫn `qk.myListings()`.
Cho phép, nhưng chỉ với prefix một phần tử đã có trong `keys.ts`; đừng dựng key đầy đủ bằng tay.

Thêm key mới = thêm một hàm vào `qk`, kể cả key không tham số (`() => ['profile'] as const`) — nhất quán
call-shape quan trọng hơn tiết kiệm một cặp ngoặc.

---

## 3. Read vs Write (HARD#5)

**Read → `useQuery`.** Query nhận param từ ngoài **bắt buộc** có `enabled` guard:

```ts
export function useListing(id: number) {
  return useQuery({
    queryKey: qk.listing(id),
    queryFn: () => api.getListing(id),
    enabled: Number.isFinite(id),      // chặn NaN từ route param
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: qk.search(q.trim()),      // trim ở key để 'a ' và 'a' dùng chung cache
    queryFn: () => api.searchListings(q),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,  // list/search: giữ kết quả cũ, không nháy trắng
  });
}
```

- `placeholderData: keepPreviousData` cho query **danh sách đổi filter liên tục** (`useListings`, `useSearch`).
  Không dùng cho query detail.
- Query không tham số viết một dòng: `useQuery({ queryKey: qk.profile(), queryFn: api.getProfile })`.
  Truyền thẳng reference hàm, không bọc arrow thừa.
- Reactive param nằm ở **key**, không dùng `watch`/`useEffect` gọi `refetch()`.

**Write → `useMutation`.** `mutationFn` nhận đúng một argument; nhiều field thì gói object
(`(v: { phone: string; password: string }) => …`).

---

## 4. Optimistic update — bộ ba bắt buộc (HARD#4)

Có `onMutate` thì **phải** có đủ cả ba. Thiếu rollback = bug im lặng khi mạng lỗi.

```ts
onMutate: async (id) => {
  await qc.cancelQueries({ queryKey: qk.savedIds() });   // 1. chặn refetch đang bay đè lên
  const prev = qc.getQueryData<number[]>(qk.savedIds()) ?? [];
  qc.setQueryData<number[]>(qk.savedIds(), /* patch */);
  return { prev };                                        // 2. trả snapshot làm context
},
onError: (_e, _id, ctx) => {
  if (ctx?.prev) qc.setQueryData(qk.savedIds(), ctx.prev); // 3. rollback
},
onSettled: () => {
  qc.invalidateQueries({ queryKey: ['saved'] });           // 4. đồng bộ lại với nguồn thật
},
```

Tham chiếu chuẩn: `useToggleSaved` và `useDeleteListing`
([queries/listings.ts:70-111](../../src/queries/listings.ts#L70-L111)), `useSendMessage`
([queries/chat.ts:33-70](../../src/queries/chat.ts#L33-L70)).

Mutation **không** optimistic thì chỉ cần `onSuccess`: hoặc ghi thẳng cache khi server trả về entity đầy đủ
(`onSuccess: (data) => qc.setQueryData(qk.profile(), data)`), hoặc invalidate nhánh liên quan. Đừng làm cả hai.

Quy tắc chọn: **`setQueryData` khi server trả về chính entity đó; `invalidateQueries` khi mutation làm lệch
các list khác.** `useCreateListing` invalidate `['listings']` + `qk.profile()` vì tin mới ảnh hưởng cả bảng tin
lẫn số đếm hồ sơ.

---

## 5. Một call, một bề mặt lỗi (HARD#6)

Toàn app có **đúng một** bề mặt lỗi cho người dùng: `useToast()` từ [`@/components/Toast`](../../src/components/Toast.tsx).

- Xử lý lỗi ở **call-site**, qua option thứ hai của `mutate()` — không phải trong định nghĩa hook:

```ts
create.mutate(payload, {
  onSuccess: () => toast('✓ Đã ghim tin lên bảng thành công!'),
  onError: (e: Error) => toast(`⚠️ ${e.message}`),
});
```

  Lý do: `onError` trong hook là hạ tầng (rollback), `onError` ở call-site là UX của màn hình đó.
- **Cấm** `try/catch` nuốt lỗi rồi trả giá trị mặc định.
- **Cấm** hai bề mặt cho cùng một call (toast + banner, hoặc toast ở cả hook lẫn call-site).
- Lỗi của `useQuery` **không** toast. Query hỏng thì render trạng thái rỗng qua `EmptyState`/`Loading` — xem §6
  của `component.convention.md`.
- Thông điệp lỗi lấy từ `e.message` của `client.ts` (đã là tiếng Việt, hướng người dùng). Không hardcode lại
  chuỗi lỗi ở màn hình trừ khi lỗi không mang thông tin (`onError: () => toast('⚠️ Không lưu được, thử lại nhé')`).

---

## 6. `app/**` không được chứa business rule (HARD#2)

Route được phép: đọc param, giữ form state, gọi hook, điều hướng, chạy animation.

Route **không** được phép: gọi `api.*` trực tiếp, đụng `db`, tự tính giá / trạng thái / định dạng nghiệp vụ,
tự dựng `queryKey`, hay tự `useQueryClient()` để vá cache.

Đặt đâu:

| Việc                                            | Chỗ đúng                     |
| ----------------------------------------------- | ---------------------------- |
| Sinh id, gán default, chuẩn hoá payload         | `client.ts`                  |
| Patch cache, rollback, invalidate               | `queries/*.ts`               |
| Debounce input, animation, điều hướng sau thành công | route (`app/**`)         |

`useSendMessage` là ví dụ đúng: chuỗi "gửi → chờ đối phương trả lời" nằm trọn trong `mutationFn`
(`await api.sendMessage(...); return api.fetchReply(...)`), màn chat chỉ gọi `send.mutate(text)`.

---

## 7. Cấu hình QueryClient

Default nằm một chỗ duy nhất, [app/\_layout.tsx:27-35](../../app/_layout.tsx#L27-L35):
`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`.

Chỉ override tại hook khi có lý do cụ thể, và ghi comment WHY. Không nhân bản `staleTime`/`retry` xuống từng hook.

---

## 8. LOC

Query module ≤200 dòng (tổng số dòng). Vượt thì tách theo **domain**, không theo read/write —
`listings.ts` (133) và `chat.ts` (70) là ranh giới hiện tại; domain mới thì thêm file mới cạnh chúng.

---

## 9. Upload ảnh & secret (HARD#19)

Luồng đã chốt: **FE upload thẳng lên Cloudinary, BE chỉ lưu URL.** Không có file nào đi qua BE.

Ảnh **upload ngay lúc chọn**, không đợi submit — người dùng còn đang gõ tiêu đề thì ảnh đã bay lên rồi,
nên bấm "Ghim" chỉ còn chờ đúng một chặng tạo tin thay vì hai chặng nối tiếp:

```text
PhotoPicker: chọn ảnh (tối đa 6, nén quality 0.7)
   → onAdd(uris)
       → useListingPhotos().addPhotos    (queries/upload.ts)
           → uploadImage() cho từng ảnh, song song, độc lập nhau
              trạng thái per-ảnh: uploading → done { url } | error
   … người dùng điền form trong lúc ảnh đang bay …

bấm Ghim → create.mutate({ …, photoUrls })     ← chỉ còn chặng này
```

`Listing.photoUrls` giữ **đúng thứ tự người dùng chọn** và phần tử `[0]` là **ảnh bìa** — thẻ tin và kết quả
tìm kiếm chỉ đọc `photoUrls?.[0]`. Đừng sort lại mảng này ở bất kỳ đâu.

`useListingPhotos` là ngoại lệ có chủ ý của "queries chỉ chứa hook TanStack": nó ôm `useState` cho trạng
thái ảnh đang bay. State này **không** thuộc về store (chết cùng form) và cũng **không** để trong `app/**`
được (điều phối upload là business logic — HARD#2). Đừng nhân thêm ngoại lệ kiểu này cho việc khác.

**Cấm tuyệt đối mọi secret trong repo này.** Bundle React Native giải nén được, nên `apiSecret`, `apiKey`,
hay bất kỳ token bên thứ ba nào nhét vào đây đều coi như đã công khai. Upload từ client **chỉ** được dùng
**unsigned upload preset**: đủ `cloudName` + tên preset, không cần khoá nào. Cloud name không phải bí mật —
nó nằm sẵn trong mọi URL ảnh Cloudinary trả về.

Cần upload có ký (giới hạn dung lượng, ràng buộc folder theo user…) thì signature **phải** do BE cấp; khi đó
luồng không còn là "FE upload thẳng" nữa và phải sửa lại quyết định kiến trúc ở trên trước, đừng lách bằng
cách nhúng secret.

Quy tắc phụ:

- Nén **trên máy** trước khi gửi (`quality` của expo-image-picker). Ảnh gốc điện thoại 3–12MB.
- Component chọn ảnh **không** tự upload — nó chỉ trả mảng `uri` lên; mutation do route gọi (HARD#2).
- Hiển thị ảnh qua đúng hai component, đừng render `<Image>` trực tiếp ở call-site mới:
  [`ListingPhoto`](../../src/components/ListingPhoto.tsx) cho ảnh bìa (thẻ tin, kết quả tìm kiếm) ·
  [`ListingGallery`](../../src/components/ListingGallery.tsx) cho hero vuốt ngang ở màn chi tiết.
  Cả hai cùng rơi về gradient `photo` khi tin chưa có ảnh thật.
- Mỗi ảnh upload **độc lập**: một ảnh hỏng không kéo theo ảnh khác, người dùng chạm vào chính ảnh đó để
  thử lại. Lỗi hiện **trên thumbnail**, không toast — 6 ảnh hỏng sẽ thành 6 toast chồng nhau và vẫn không
  cho biết ảnh nào hỏng. Đây là ngoại lệ hợp lệ của §5: bề mặt vẫn là một, chỉ là inline thay vì toast.
- Nút "Ghim" bị khoá khi còn ảnh `uploading`, và chặn kèm toast khi còn ảnh `error`. Không bao giờ tạo tin
  với bộ ảnh thiếu.
- Upload sớm đổi lại bằng **ảnh mồ côi**: bỏ ngang form hoặc xoá ảnh sau khi chọn thì file đã nằm trên
  Cloudinary. Dọn chúng cần chữ ký nên là việc của BE, FE không làm được.
