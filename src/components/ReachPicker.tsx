import { StyleSheet, Text, View } from 'react-native';
import { TapeChip } from '@/components/ui';
import type { ListingReach } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Chọn BẬC PHỦ SÓNG của tin — và qua đó là chọn AI DUYỆT nó.
 *
 * Đây không phải một tuỳ chọn hiển thị thuần tuý: `routeListing` bên BE định tuyến hàng đợi
 * theo chính giá trị này. Vì vậy màn hình phải nói rõ hệ quả ngay dưới nút chọn, không để người
 * dùng đoán vì sao tin của mình lại do người lạ duyệt.
 *
 * Thay `VisibilityPicker` (hai giá trị `org_internal`/`public`). Bậc ở giữa — `group_open`, tin
 * nằm trong nhóm nhưng ai cũng đọc được — là thứ mô hình cũ không diễn đạt nổi, và cũng là lý
 * do nó bị thay: nhóm công khai mà tin bên trong vẫn kín là một điểm gãy có thật.
 *
 * KHÔNG tự đọc nhóm từ store như bản trước. Nhóm đích có thể là nhóm đang thao tác HOẶC một
 * nhóm khác (đăng từ trang hồ sơ nhóm), và chỉ nơi gọi mới biết là cái nào — tự đoán ở đây là
 * đoán sai đúng ở ca người dùng thuộc nhiều nhóm.
 */

/** Nhóm đích. `null` = không đăng vào nhóm nào, lúc đó chỉ còn một bậc hợp lệ. */
export type ReachTarget = { name: string; isPublic: boolean } | null;

/**
 * Bậc mặc định — gương của `defaultReachFor` bên BE.
 *
 * Giữ khớp hai bên là có lý do: nếu app bày sẵn một bậc còn BE lại mặc định bậc khác, thì tin
 * gửi đi không kèm `reach` sẽ rơi vào hàng đợi khác với thứ người dùng vừa nhìn thấy.
 */
export function defaultReach(target: ReachTarget): ListingReach {
  if (!target) return 'marketplace';
  return target.isPublic ? 'group_open' : 'members';
}

/**
 * Bậc hợp lệ cho một nhóm đích, theo đúng thứ tự kín → mở.
 *
 * `group_open` vắng mặt ở nhóm riêng tư vì BE từ chối thẳng tổ hợp đó. `marketplace` vắng mặt
 * khi `lockToGroup` — người bấm "Đăng tin" trên trang một nhóm đang nói "gửi cho nhóm này
 * duyệt", mà tin lên sàn thì đi bàn danh mục và quản trị nhóm không có lấy một lượt duyệt nào.
 */
export function reachOptions(target: ReachTarget, lockToGroup: boolean): ListingReach[] {
  if (!target) return ['marketplace'];
  const inGroup: ListingReach[] = target.isPublic ? ['members', 'group_open'] : ['members'];
  return lockToGroup ? inGroup : [...inGroup, 'marketplace'];
}

const LABEL: Record<ListingReach, string> = {
  members: 'Chỉ thành viên',
  group_open: 'Cả nhóm + người ngoài',
  marketplace: 'Bảng tin chung',
};

/** Hệ quả THẬT của từng bậc: ai đọc được, và ai duyệt. Hai câu đó mới là thứ cần biết. */
function noteFor(reach: ListingReach, target: ReachTarget): string {
  if (reach === 'marketplace') {
    return 'Lên bảng tin chung, do người phụ trách danh mục tại tỉnh của bạn duyệt — nhớ chọn tỉnh bên dưới.';
  }
  const who = target ? target.name : 'nhóm';
  return reach === 'members'
    ? `Chỉ thành viên ${who} đọc được. ${target ? 'Nhóm' : 'Chính nhóm'} duyệt tin này.`
    : `Nằm trong ${who} nhưng ai cũng đọc được, kể cả người chưa tham gia. Nhóm vẫn là nơi duyệt.`;
}

export function ReachPicker({
  value,
  target,
  lockToGroup,
  onChange,
}: {
  value: ListingReach;
  target: ReachTarget;
  /** Đăng từ trang hồ sơ nhóm — bỏ hẳn lựa chọn lên sàn. */
  lockToGroup: boolean;
  onChange: (next: ListingReach) => void;
}) {
  const options = reachOptions(target, lockToGroup);

  // Một lựa chọn thì không có gì để chọn — bày một hàng chip chỉ có một nút là hỏi một câu đã
  // có sẵn đáp án. Vẫn giữ câu giải thích, vì hệ quả thì người dùng cần biết.
  if (options.length === 1) {
    return <Text style={styles.soleNote}>{noteFor(options[0], target)}</Text>;
  }

  return (
    <>
      <Text style={styles.label}>Đăng ở đâu</Text>
      <View style={styles.row}>
        {options.map((reach, i) => (
          <TapeChip
            key={reach}
            label={LABEL[reach]}
            active={value === reach}
            index={i}
            onPress={() => onChange(reach)}
          />
        ))}
      </View>
      <Text style={styles.note}>{noteFor(value, target)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 17 },
  soleNote: {
    fontFamily: F.ui,
    fontSize: 11.5,
    color: C.inkSoft,
    marginTop: 18,
    lineHeight: 17,
  },
});
