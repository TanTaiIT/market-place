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
import Animated, { SlideInDown } from 'react-native-reanimated';
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
 * Sheet cao nhiều nhất bao nhiêu phần khoảng trống CÒN LẠI.
 *
 * Là PHẦN TRĂM chứ không phải số dp tính tay, và đó là điểm mấu chốt: phần trăm quy chiếu về ô
 * cha, mà ô cha chính là cửa sổ modal — nên nó tự đúng trên cả hai hệ, kể cả khi Android đã thu
 * cửa sổ lại vì bàn phím. Bản trước tính `(screen - keyboard) * 0.82 + keyboard` từ
 * `useWindowDimensions()`, tức đo bằng MÀN HÌNH trong khi sheet sống trong CỬA SỔ MODAL — trên
 * Android hai số đó lệch nhau đúng bằng chiều cao bàn phím.
 *
 * Chừa lại 18% để vệt scrim phía trên còn bấm được: đó là lối đóng sheet mà ngón cái với tới dễ
 * nhất, sheet cao hết màn thì chỉ còn dấu ✕ ở góc.
 */
const SHEET_MAX_HEIGHT = '82%' as const;

/**
 * Chiều cao bàn phím đang che, theo dp.
 *
 * CHỈ iOS cần: ở đó cửa sổ modal không thu lại khi bàn phím mở, nên không có cơ chế layout nào
 * tự đẩy sheet lên — ô tìm nhận focus là danh sách nằm dưới bàn phím. Android thì hệ điều hành
 * lo việc đó (xem `SHEET_MAX_HEIGHT`); ở đó giá trị này chỉ dùng để biết bàn phím có đang mở,
 * để thôi chừa vạch home.
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
    /* `fade` + `entering` chứ không `slide` — xem lý do đầy đủ ở `AdminListingSheet`. */
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/*
        Bù bàn phím CHỈ trên iOS.

        Android chạy `softwareKeyboardLayoutMode: 'resize'` (mặc định của Expo; app.json không
        đặt khác), nên hệ điều hành đã thu cửa sổ modal xuống còn đúng phần bàn phím không che.
        Chừa thêm một lần nữa ở đây là bù HAI LẦN: sheet cao hơn cửa sổ, và vì nó neo đáy nên
        phần thừa trào ra ĐẦU MÀN — tiêu đề với ô tìm biến mất khỏi mép trên, danh sách bị cắt
        cụt, còn khoảng đệm thừa nằm lại thành mảng trống giữa danh sách và bàn phím.

        iOS thì cửa sổ modal KHÔNG thu, nên ở đó vẫn phải tự chừa.
      */}
      <View style={[styles.fill, Platform.OS === 'ios' && { paddingBottom: keyboard }]}>
        <Pressable style={styles.scrim} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.duration(260)}
          // Bàn phím mở thì mép dưới đã là bàn phím, không cần chừa vạch home nữa.
          style={[styles.sheet, { paddingBottom: keyboard > 0 ? 0 : insets.bottom }]}
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
        </Animated.View>
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
        // Nhường khi đụng trần của sheet: thiếu dòng này thì danh sách giữ nguyên chiều cao tự
        // nhiên và tràn ra ngoài khung bo góc thay vì cuộn bên trong nó.
        style={styles.listBox}
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
  /* Ô phủ kín cửa sổ modal — cái mà `maxHeight: '82%'` của sheet quy chiếu vào. */
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: C.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // Bo góc chỉ ăn thua khi ruột bị cắt theo: `FlatList` cuộn sát mép trên của sheet.
    overflow: 'hidden',
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

  listBox: { flexShrink: 1 },
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
