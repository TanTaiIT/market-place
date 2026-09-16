import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { groupDigits } from '@/api/client';
import { shortDong } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Lọc theo giá: chip khoảng giá gợi ý + hai ô nhập chính xác.
 *
 * **Thay cho thanh kéo hai đầu.** Thanh kéo hỏng vì ba lý do không sửa được bằng cách chỉnh
 * tham số:
 *
 * 1. Nó là cú kéo NGANG nằm trong một màn cuộn DỌC, nên phải mượn `onDragChange` để tạm khoá
 *    cuộn của màn cha — một sợi dây xuyên qua ba tầng component chỉ để một widget đừng bị cướp
 *    cú chạm. Cú kéo chéo vẫn tuột.
 * 2. Nó chạy trên CHỈ SỐ của một thang bậc cố định, nên người dùng không chọn được 3.500.000 —
 *    chỉ chọn được 2tr hoặc 5tr. Với giá, "gần đúng" là sai.
 * 3. Trên thang 17 mốc trong ~300px, mỗi mốc rộng chưa tới 18px: chạm hụt một mốc là lệch cả
 *    một bậc giá, và hai thumb lúc sát nhau thì không phân biệt được đang kéo đầu nào.
 *
 * Ô nhập không có vấn đề nào trong ba: không có cử chỉ nào để tranh chấp, gõ được số bất kỳ,
 * và đọc lại được chính xác thứ mình vừa nhập. Chip gợi ý gánh phần "chọn nhanh" mà thanh kéo
 * từng hứa — nhưng theo ĐÚNG bậc giá của danh mục đang xem, xem `LADDERS`.
 */

/**
 * Bốn mốc chia thang giá của mỗi danh mục thành năm khoảng: `< a`, `a–b`, `b–c`, `c–d`, `> d`.
 *
 * Theo danh mục chứ không dùng chung một thang: "dưới 1 triệu" là một khoảng có nghĩa ở Sách
 * vở nhưng vô nghĩa ở Bất động sản, nơi mọi tin đều nằm trên 500 triệu. Một thang chung nghĩa
 * là 4 trong 5 chip luôn trả về 0 kết quả ở ít nhất một nửa số danh mục.
 *
 * Mảng 4 số chứ không phải 5 object `{label, min, max}`: nhãn suy được từ chính các mốc
 * (`shortDong`), nên viết tay nhãn chỉ tạo cơ hội cho nhãn lệch khỏi số nó mô tả.
 */
const LADDERS: Record<string, [number, number, number, number]> = {
  'dien-thoai': [2_000_000, 5_000_000, 10_000_000, 20_000_000],
  'do-dien-tu': [1_000_000, 5_000_000, 15_000_000, 30_000_000],
  'thoi-trang': [100_000, 300_000, 700_000, 2_000_000],
  'bat-dong-san': [500_000_000, 1_000_000_000, 2_000_000_000, 5_000_000_000],
  'xe-co': [5_000_000, 20_000_000, 60_000_000, 300_000_000],
  'sach-vo': [50_000, 100_000, 300_000, 700_000],
  'do-gia-dung': [500_000, 2_000_000, 5_000_000, 15_000_000],
  'the-thao': [200_000, 500_000, 2_000_000, 8_000_000],
  'thu-cung': [500_000, 2_000_000, 5_000_000, 10_000_000],
  khac: [200_000, 1_000_000, 3_000_000, 8_000_000],
};

/** Chưa chọn danh mục thì đang tìm xuyên chợ — thang phải trải rộng nhất có thể. */
const DEFAULT_LADDER: [number, number, number, number] = [
  500_000, 2_000_000, 10_000_000, 50_000_000,
];

interface Preset {
  label: string;
  min: number | null;
  max: number | null;
}

function presetsOf(categorySlug: string | null): Preset[] {
  const [a, b, c, d] = (categorySlug && LADDERS[categorySlug]) || DEFAULT_LADDER;
  return [
    { label: `Dưới ${shortDong(a)}`, min: null, max: a },
    { label: `${shortDong(a)} – ${shortDong(b)}`, min: a, max: b },
    { label: `${shortDong(b)} – ${shortDong(c)}`, min: b, max: c },
    { label: `${shortDong(c)} – ${shortDong(d)}`, min: c, max: d },
    { label: `Trên ${shortDong(d)}`, min: d, max: null },
  ];
}

export function PriceField({
  min,
  max,
  categorySlug,
  onChange,
}: {
  min: number | null;
  max: number | null;
  /** Danh mục đang lọc — chỉ để chọn thang chip. `null` = chưa chọn, dùng thang chung. */
  categorySlug: string | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
}) {
  const presets = presetsOf(categorySlug);
  // Khoảng không hợp lệ KHÔNG bị tự sửa. Đảo hai đầu hộ người dùng giữa lúc họ còn đang gõ là
  // sửa dữ liệu sau lưng họ; báo ra rồi để họ tự chỉnh mới đúng thứ tự.
  const invalid = min !== null && max !== null && min > max;

  return (
    <View>
      <View style={styles.chips}>
        {presets.map((p) => {
          const on = p.min === min && p.max === max;
          return (
            <Pressable
              key={p.label}
              // Bấm lại chip đang chọn là BỎ lọc giá — không có nút "xoá" riêng cho một hàng chip.
              onPress={() => onChange(on ? { min: null, max: null } : { min: p.min, max: p.max })}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <MoneyInput label="Giá từ" value={min} onChange={(n) => onChange({ min: n, max })} />
        <Text style={styles.dash}>—</Text>
        <MoneyInput label="Giá đến" value={max} onChange={(n) => onChange({ min, max: n })} />
      </View>

      {invalid && <Text style={styles.warn}>Giá từ đang lớn hơn giá đến — đổi lại giúp nhé.</Text>}
    </View>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <View style={styles.box}>
      <TextInput
        value={value === null ? '' : groupDigits(String(value))}
        /*
         * Chỉ giữ chữ số rồi chấm nghìn lại — cùng cách `AttrFilters.NumInput` làm, và vì cùng
         * một lý do: bàn phím số của iOS vẫn gõ được dấu phân cách, mà `minPrice`/`maxPrice`
         * lên BE là number nên một dấu phẩy lọt xuống là 400 cho cả lượt tìm.
         *
         * Chấm nghìn ngay trong ô, không chỉ ở nhãn: 500000000 và 50000000 nhìn giống hệt nhau
         * ở cỡ chữ này, và sai một số 0 ở bộ lọc giá thì kết quả trống mà không ai hiểu vì sao.
         */
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '');
          onChange(digits ? Number(digits) : null);
        }}
        placeholder={label}
        placeholderTextColor={C.muted}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Text style={styles.suffix}>đ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: C.moss, borderColor: C.moss },
  chipText: { fontFamily: F.ui, fontSize: 12, color: C.ink },
  chipTextOn: { color: C.paperWarm },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dash: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 9, fontFamily: F.mono, fontSize: 12.5, color: C.ink },
  suffix: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginLeft: 6 },
  warn: { fontFamily: F.ui, fontSize: 11.5, color: C.pin, marginTop: 8 },
});
