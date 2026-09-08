import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading } from './ui';
import { C, F } from '@/theme';

/**
 * Ngăn chọn một-trong-nhiều, trượt từ dưới lên, có ô tìm kiếm. RN không có `<select>` mà Picker
 * của hệ điều hành thì không lọc được — với danh sách vài chục tới vài trăm mục thì đây là hình
 * thức duy nhất bấm được bằng một ngón cái.
 *
 * Generic theo `T` để giá trị trả về giữ nguyên kiểu của người gọi (vd `ProvinceName`), không
 * phải `string` rồi ép lại — ép ở đây là thủng đúng chỗ cả thiết kế dựa vào để bắt tên sai.
 *
 * Việc LỌC do người gọi truyền vào: chỉ nơi đó biết dữ liệu là gì và còn khớp theo tên cũ hay
 * tên gọi tắt nào — xem `filterProvinces` trong `api/location.ts`.
 */

/**
 * Phần ĐỌC ĐƯỢC của sheet chiếm nhiều nhất bao nhiêu khoảng trống còn lại.
 *
 * Tính trên khoảng còn lại (màn hình trừ bàn phím) chứ không trên cả màn hình: hai con số đó
 * bằng nhau khi bàn phím đóng, nhưng khi mở thì "82% màn hình" gồm luôn phần đang bị bàn phím
 * che — sheet trông như cao 82% mà chỗ đọc được chỉ còn hai dòng.
 *
 * Chừa lại 18% để vệt scrim phía trên còn bấm được: đó là lối đóng sheet mà ngón cái với tới
 * dễ nhất, sheet cao hết màn thì chỉ còn dấu ✕ ở góc.
 */
const SHEET_MAX_RATIO = 0.82;

/**
 * Chiều cao bàn phím đang che, theo dp.
 *
 * Sheet dán vào `bottom: 0` và bàn phím vẽ ĐÈ LÊN cửa sổ modal, nên không có cơ chế layout nào
 * tự đẩy nó lên: ô tìm trong sheet nhận focus là danh sách lựa chọn nằm dưới bàn phím — và cuộn
 * cũng không lôi ra được, vì `FlatList` vẫn đang giữ đúng khung cao như lúc chưa có bàn phím.
 *
 * iOS nghe `keyboardWillChangeFrame`: một sự kiện phủ cả mở, đóng và ĐỔI chiều cao (chuyển sang
 * bàn phím emoji, thanh gợi ý bật lên), lại phát TRƯỚC animation nên sheet đi cùng nhịp với bàn
 * phím. Android không có sự kiện `will*` nào nên phải ghép `didShow`/`didHide`.
 */
function useKeyboardOverlap(): number {
  const { height: screen } = useWindowDimensions();
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const frame = Keyboard.addListener('keyboardWillChangeFrame', (e) =>
        // Bàn phím đóng thì `screenY` đúng bằng đáy màn, trừ ra là 0 — không cần nhánh riêng.
        setOverlap(Math.max(0, screen - e.endCoordinates.screenY)),
      );
      return () => frame.remove();
    }
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setOverlap(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
    // `screen` đổi khi quay máy: mốc để trừ `screenY` đổi theo, phải đăng ký lại.
  }, [screen]);

  return overlap;
}

export type PickerItem<T extends string> = { key: T; label: string; note?: string };
export type PickerSearch<T extends string> = (keyword: string) => readonly PickerItem<T>[];

export function PickerSheet<T extends string>({
  visible,
  title,
  placeholder,
  search,
  loading,
  value,
  emptyAll,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  search: PickerSearch<T>;
  loading: boolean;
  value: T | null;
  /** Nhãn cho dòng bỏ chọn ở đầu danh sách. Không truyền = bắt buộc phải chọn một mục. */
  emptyAll?: string;
  onSelect: (value: T | null) => void;
  onClose: () => void;
}) {
  /*
   * `useSafeAreaInsets()` chứ KHÔNG `<SafeAreaView>` — bên trong `<Modal>` thì component đó
   * không chừa được lề an toàn (xem ghi chú ở chỗ dùng bên dưới).
   */
  const insets = useSafeAreaInsets();
  const { height: screen } = useWindowDimensions();
  const keyboard = useKeyboardOverlap();

  /*
   * Bàn phím của màn PHÍA SAU không còn ô nào để gõ vào.
   *
   * Ca này không sinh ra sự kiện nào cho `useKeyboardOverlap` nghe: người dùng gõ ở ô tìm của
   * màn search, bàn phím đang mở, rồi bấm "▾" — sheet trượt lên NẰM DƯỚI bàn phím sẵn có, chiều
   * cao bàn phím không đổi nên không có `willChangeFrame` nào phát ra. Tệ hơn: focus vẫn ở ô
   * phía sau, gõ tiếp là chữ chạy vào một ô đã bị sheet che kín.
   */
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            // Bàn phím mở thì CHÍNH NÓ là mép dưới của nội dung; đóng thì chừa vạch home. Không
            // cộng dồn: lúc bàn phím mở, vạch home nằm sau nó, đệm thêm là 34dp trống vô ích.
            paddingBottom: keyboard > 0 ? keyboard : insets.bottom,
            maxHeight: (screen - keyboard) * SHEET_MAX_RATIO + keyboard,
          },
        ]}
      >
        <View style={styles.head}>
          <Text style={styles.headTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        {/* key: ép dựng lại để từ khoá lần trước không còn lọc sẵn danh sách ở lần mở sau */}
        <SheetBody
          key={String(visible)}
          placeholder={placeholder}
          search={search}
          loading={loading}
          value={value}
          onChoose={(next: T | null) => {
            onSelect(next);
            onClose();
          }}
          emptyAll={emptyAll}
        />
      </View>
    </Modal>
  );
}

function SheetBody<T extends string>({
  placeholder,
  search,
  loading,
  value,
  emptyAll,
  onChoose,
}: {
  placeholder: string;
  search: PickerSearch<T>;
  loading: boolean;
  value: T | null;
  emptyAll?: string;
  onChoose: (value: T | null) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const shown = useMemo(() => search(keyword), [search, keyword]);

  return (
    <>
      <View style={styles.inputRow}>
        <Text style={styles.searchGlyph}>🔍</Text>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          style={styles.input}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(i) => i.key}
        keyboardShouldPersistTaps="handled"
        // Kéo danh sách là bỏ bàn phím: lối lấy lại toàn bộ chiều cao sheet mà không phải với
        // tay lên ✕. `persistTaps` ở trên vẫn cho chọn một dòng bằng MỘT cú chạm.
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        initialNumToRender={14}
        ListHeaderComponent={
          emptyAll ? (
            <Row label={emptyAll} selected={!value} onPress={() => onChoose(null)} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <Row
            label={item.label}
            note={item.note}
            selected={item.key === value}
            onPress={() => onChoose(item.key)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : (
            <Text style={styles.empty}>Không có kết quả cho “{keyword.trim()}”</Text>
          )
        }
      />
    </>
  );
}

function Row({
  label,
  note,
  selected,
  onPress,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{label}</Text>
        {!!note && <Text style={styles.rowNote}>{note}</Text>}
      </View>
      {selected && <Text style={styles.rowPin}>📌</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headTitle: { flex: 1, fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  close: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.chipIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 12, color: C.inkSoft },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 2,
    borderColor: C.pin,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginHorizontal: 18,
    marginTop: 14,
  },
  input: { flex: 1, fontFamily: F.ui, fontSize: 14, color: C.ink, paddingVertical: 9 },
  searchGlyph: { fontSize: 15 },

  list: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowOn: { borderColor: C.pin, backgroundColor: C.sand },
  rowBody: { flex: 1 },
  rowPin: { fontSize: 13 },
  rowLabel: { fontFamily: F.uiSemi, fontSize: 13.5, color: C.ink },
  rowLabelOn: { fontFamily: F.uiBold, color: C.pinDark },
  rowNote: { fontFamily: F.ui, fontSize: 10.5, color: C.inkSoft, marginTop: 2 },
  empty: {
    fontFamily: F.ui,
    fontSize: 12.5,
    color: C.inkSoft,
    textAlign: 'center',
    paddingVertical: 28,
  },
});
