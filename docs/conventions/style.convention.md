# style.convention

SoT cho: theme token, `StyleSheet.create`, style động, cách port CSS của prototype sang React Native.

---

## 1. Token là nguồn duy nhất (HARD#8)

[`src/theme/index.ts`](../../src/theme/index.ts) giữ các nhóm sau, port thẳng từ `:root` của prototype:

| Export        | Dùng cho                                                                     |
| ------------- | ---------------------------------------------------------------------------- |
| `C`           | Màu: `ink`, `inkSoft`, `paper`, `paperWarm`, `cork`, `pin`, `tape`, `moss`, … |
| `F`           | Tên font sau khi `useFonts` load: `hand`, `ui`, `uiBold`, `mono`, …           |
| `shadow` / `shadowLift` | Đổ bóng cross-platform (`Platform.select`)                          |
| `Grad`        | Type cặp màu gradient thay `linear-gradient` của web                          |
| `G`           | Dải màu cho `<LinearGradient>`: `brand`, `hero`, `auth`, `glow`, `sheen`     |

Quy tắc:

- Gradient **luôn** `G.*`. Ghép tay `colors={[C.a, C.b]}` tại call-site là cách sinh dải phẳng lúc palette
  đổi (hero `profile` từng chết vì `cork` và `paper` cùng về một sắc). Chặng tắt dần là alpha-0 của chính
  màu đó, **không** `'transparent'` — Android nội suy qua sắc đen.
- Mặt kính trên nền thương hiệu/ảnh dùng `C.glass*` (`glass`, `glassRaise`, `glassLine`, `glassTx`,
  `glassLift`), không viết `rgba(255,255,255,…)` rời.
- Kính là **ba lớp**, không phải một màu: trộn `glassFace` vào style của khối rồi đặt `<GlassSheen />`
  làm con ĐẦU TIÊN (`GlassSurface.tsx`). Chỉ đặt `backgroundColor: C.glassRaise` thì ra "màu nhạt
  hơn", không ra vật liệu. Repo KHÔNG có `expo-blur`, và blur cũng vô dụng ở đây — nền phía sau các
  mặt này là gradient đặc.
- Màu mới **phải** thêm vào `C` rồi mới dùng. Không hardcode hex tại call-site.
- Font **luôn** qua `F.*`. Không viết `fontFamily: 'Manrope_700Bold'` trực tiếp; không dùng `fontWeight` để giả
  đậm — RN cần đúng family đã load. Font mới: thêm vào `useFonts` ở
  [app/\_layout.tsx:38-48](../../app/_layout.tsx#L38-L48) **và** vào `F` cùng lúc.
- Đổ bóng **luôn** `...shadow` / `...shadowLift`. Không tự viết `shadowColor + elevation` trừ khi bóng có màu
  riêng — ngoại lệ hợp lệ duy nhất: FAB đổ bóng đỏ theo màu `C.pin`
  ([TabBar.tsx:100-104](../../src/components/TabBar.tsx#L100-L104)).

**Ngoại lệ được tha:** `'#fff'` cho chữ trên nền đậm. Nó xuất hiện khắp nơi và thêm `C.white` lúc này chỉ tạo
diff ồn — cứ viết `'#fff'`.

---

## 2. `StyleSheet.create` — vị trí và ranh giới

- Đúng **một** `const styles = StyleSheet.create({…})` mỗi file, đặt **cuối file**, sau mọi component.
- Style **tĩnh** vào `styles`. Style **phụ thuộc state/props** để trong mảng inline:

```tsx
style={[styles.chip, active && { backgroundColor: C.pin }, { transform: [{ rotate: `${tilt}deg` }] }]}
```

- Layout dùng-một-lần, ngắn (`{ flex: 1 }`, `{ marginTop: 8 }`, `contentContainerStyle` với padding của riêng
  màn đó) được phép inline — đừng đẩy vào `styles` cho "sạch", nó chỉ làm khó đọc.
- Đặt tên key theo **vai trò trong màn**, không theo hình thức: `searchBar`, `sellerCard`, `priceFloat`,
  `ctaSecondary` — không `redBox`, `container2`.

---

## 3. Spacing & kích thước

- Dùng `gap` cho khoảng cách giữa các con (RN 0.81 hỗ trợ đầy đủ), không rải `marginRight` từng phần tử.
- Số lẻ (`12.5`, `13.5`, `1.6`) là cố ý — đó là kết quả port 1-1 từ CSS gốc. Đừng "làm tròn cho đẹp".
- Vòng tròn: `borderRadius: size / 2` tính từ `size`, không hardcode cả hai.

---

## 4. Port CSS → React Native

| CSS gốc                             | Cách làm trong repo                                                        |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `linear-gradient(135deg, …)`        | `<LinearGradient colors={G.x} start={{x:0,y:0}} end={{x:1,y:1}} />`        |
| `repeating-radial-gradient` (vân bần) | Lưới chấm tính sẵn **deterministic** trong `Corkboard.tsx` — không random |
| `box-shadow: 0 6px 0 <color>`       | Lớp `View` nền tối cố định + mặt nút `translateY` khi nhấn (`PinButton`)    |
| `box-shadow` mờ thường              | `...shadow` từ theme                                                       |
| `transform: rotate(...)`            | `transform: [{ rotate: '-1.5deg' }]` — **chuỗi có đơn vị**, không phải số   |
| `:active { transform: scale(…) }`   | `Pressable style={({ pressed }) => …}`                                     |
| `@keyframes`                        | Reanimated — xem `component.convention.md` §4                               |
| `text-transform: uppercase`         | `textTransform: 'uppercase'` + `letterSpacing`                              |

Khi port thêm hiệu ứng mới, ghi comment WHY trỏ về selector/keyframe gốc — đúng như code hiện có:
`/* @keyframes pinPress — nút lún xuống rồi bật nhẹ lên */`.

Không random trong render (`Math.random()` sinh vị trí, góc nghiêng…): mọi biến thể thị giác phải suy ra từ
`index` qua mảng hằng (`TILTS`, `CHIP_TILTS`) hoặc từ seed tính toán — nếu không, mỗi lần re-render layout sẽ nhảy.

---

## 5. Không dùng

- Thư viện styling ngoài (styled-components, nativewind, tamagui…). Repo dùng `StyleSheet` thuần, giữ nguyên.
- `Dimensions.get('window')` ở top level — dùng hook `useWindowDimensions()` để đúng khi xoay máy.
- `zIndex` tuỳ tiện: hiện chỉ có 3 giá trị đang dùng (`3` pinhead, `5` nút nổi trên hero, `100` toast).
  Cần lớp mới thì chèn vào giữa các mốc đó, đừng nhảy lên `9999`.

---

## Known deviations — đã biết, đừng mở lại tranh luận

Các hex rời còn sót lại, chấp nhận ở hiện trạng; **nhưng code mới không được thêm cái thứ hai**:

| Vị trí                                         | Giá trị                              |
| ---------------------------------------------- | ------------------------------------ |
| `login.tsx:133`                                | `'#B7AE95'` — trùng hệt `C.muted`    |
| `login.tsx:132`, `login.tsx:107`               | `'#E3DCC6'`, `'#ff9b8a'`             |
| `mylistings.tsx:45`, `notif.tsx:9`             | `'#FDEFD9'` (lặp ở 2 file)           |
| `mylistings.tsx:63`                            | `'#FCE4E1'`                          |
| `ui.tsx` (`ghostBtn`)                          | `'#C9BE9F'`                          |

Chạm vào một trong các dòng trên vì lý do khác → nhân tiện nâng lên token `C`. Không mở PR riêng chỉ để dọn.
