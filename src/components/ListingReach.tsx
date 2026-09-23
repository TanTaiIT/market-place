import { StyleSheet, Text, View } from 'react-native';
import { TapeChip } from '@/components/ui';
import { useMyOrgs } from '@/queries/org';
import { C, F, S } from '@/theme';

/**
 * Thang phủ sóng của một tin: `members` ⊂ `group_open` ⊂ `marketplace`.
 *
 * Bậc trên BAO bậc dưới — tin `marketplace` vẫn nằm trong bảng tin nhóm của nó. Vì vậy đây
 * không phải "chọn một trong hai bảng" như `visibility` cũ, và người đăng không còn phải đăng
 * hai tin để vừa bán trong nhóm vừa bán ra sàn.
 */
export type ListingReach = 'members' | 'group_open' | 'marketplace';

/** Bậc + nhóm đích đi LIỀN NHAU: bậc dưới `marketplace` vô nghĩa nếu không có nhóm. */
export type ReachPick = { reach: ListingReach; orgId: string | null };

/** Nhóm người đăng chọn được. `isPublic` là ĐIỀU KIỆN của bậc `group_open`, không phải trang trí. */
export type PostGroup = { id: string; name: string; isPublic: boolean };

const LADDER: { reach: ListingReach; label: string; note: string }[] = [
  {
    reach: 'members',
    label: 'Chỉ trong nhóm',
    note: 'Chỉ thành viên nhóm đọc được. Quản trị nhóm duyệt.',
  },
  {
    reach: 'group_open',
    label: 'Ai cũng xem được',
    note: 'Ai mở hồ sơ nhóm hoặc tìm kiếm đều đọc được, nhưng vẫn do quản trị nhóm duyệt.',
  },
  {
    reach: 'marketplace',
    label: 'Đăng lên sàn',
    note: 'Lên cả bảng tin chung, do người phụ trách danh mục tại tỉnh của bạn duyệt — nhớ chọn tỉnh bên dưới.',
  },
];

/**
 * Các nhóm người đăng chọn được.
 *
 * `locked` (đi từ hồ sơ nhóm) rút danh sách về đúng nhóm đó: người bấm "Đăng tin" trên trang
 * một nhóm đang nói "gửi cho nhóm này", và bày cho họ chọn nhóm khác là hỏi lại một câu đã
 * được trả lời. Thang vẫn đủ ba bậc — khoá NHÓM không có nghĩa là khoá tầm phủ.
 *
 * Nhóm đang bị khoá (`status !== 'active'`) rơi khỏi danh sách: đăng vào đó là một cú 403.
 */
export function usePostGroups(locked?: PostGroup): PostGroup[] {
  const { data } = useMyOrgs();
  if (locked) return [locked];
  return (data ?? [])
    .filter((o) => o.status === 'active')
    .map((o) => ({ id: o.id, name: o.name, isPublic: o.isPublic }));
}

/**
 * Lựa chọn mặc định — hàm THUẦN, và cố ý KHÔNG chọn hộ khi có nhiều nhóm.
 *
 * Đúng một nhóm thì mặc định vào nhóm đó, ở bậc BE cũng sẽ chọn (`defaultReachFor`): nhóm công
 * khai → `group_open`, nhóm kín → `members`. Từ hai nhóm trở lên thì `marketplace` + không
 * nhóm, và người đăng tự chỉ ra — đoán hộ chính là cái "tổ chức đang thao tác" vừa bị bỏ, nơi
 * tin rơi vào bất kỳ nhóm nào app đang mở.
 */
export function defaultPick(groups: PostGroup[]): ReachPick {
  const only = groups.length === 1 ? groups[0] : undefined;
  if (!only) return { reach: 'marketplace', orgId: null };
  return { reach: only.isPublic ? 'group_open' : 'members', orgId: only.id };
}

export function ListingReachField({
  value,
  groups,
  locked,
  onChange,
}: {
  value: ReachPick;
  groups: PostGroup[];
  /** Nhóm đến từ `?org=` — hiện thành chữ tĩnh thay vì một ô chọn chỉ có một đáp án. */
  locked?: PostGroup;
  onChange: (next: ReachPick) => void;
}) {
  // Không nhóm nào thì không có bậc nào để chọn: mọi tin đều lên sàn, và một ô chọn một đáp án
  // chỉ làm form dài thêm.
  if (groups.length === 0) return null;

  const target = groups.find((g) => g.id === value.orgId);
  // `group_open` chỉ tồn tại ở nhóm CÔNG KHAI — BE chặn ở `routeListing`, nên bày nó ở nhóm kín
  // là dẫn thẳng người dùng tới 400. Chưa chọn nhóm thì cũng chưa biết, và ẩn là phía an toàn.
  const rungs = LADDER.filter((r) => r.reach !== 'group_open' || target?.isPublic);
  // Chọn bậc trong nhóm mà chưa chỉ ra nhóm nào: mở ô chọn. Một nhóm thì gắn luôn, không hỏi.
  const pickGroup = value.reach !== 'marketplace' && !locked && groups.length > 1;

  return (
    <>
      <Text style={styles.label}>Ai xem được tin này</Text>
      <View style={styles.row}>
        {rungs.map((r, i) => (
          <TapeChip
            key={r.reach}
            label={r.label}
            index={i}
            active={value.reach === r.reach}
            // Lên sàn thì bỏ nhóm đang chọn, trừ khi nhóm bị khoá bởi `?org=`: tin lên sàn mang
            // tên nhóm là một lời cam kết thay nhóm, không phải một tuỳ chọn tiện tay.
            onPress={() =>
              onChange({
                reach: r.reach,
                orgId: locked
                  ? locked.id
                  : r.reach === 'marketplace'
                    ? null
                    : (value.orgId ?? (groups.length === 1 ? groups[0].id : null)),
              })
            }
          />
        ))}
      </View>
      <Text style={styles.note}>{LADDER.find((r) => r.reach === value.reach)?.note}</Text>

      {locked || (groups.length === 1 && value.reach !== 'marketplace') ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>ĐĂNG VÀO NHÓM</Text>
          <Text style={styles.groupName}>{(locked ?? groups[0]).name}</Text>
        </View>
      ) : null}

      {pickGroup ? (
        <>
          <Text style={styles.label}>Nhóm nào</Text>
          <View style={styles.row}>
            {groups.map((g, i) => (
              <TapeChip
                key={g.id}
                label={g.name}
                index={i}
                active={value.orgId === g.id}
                // Đổi sang nhóm KÍN trong lúc đang ở `group_open` thì hạ về `members` — bậc kia
                // không tồn tại ở đó, để nguyên là gửi lên một tổ hợp BE từ chối.
                onPress={() =>
                  onChange({
                    orgId: g.id,
                    reach: !g.isPublic && value.reach === 'group_open' ? 'members' : value.reach,
                  })
                }
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 17 },
  group: {
    backgroundColor: C.mossLight,
    borderRadius: 8,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.moss,
    marginTop: S.lg,
  },
  groupLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.moss },
  groupName: { fontFamily: F.uiBold, fontSize: 15, color: C.ink, marginTop: S.xs },
});
