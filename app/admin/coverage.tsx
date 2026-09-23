import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminFilter, AdminScreen } from '@/components/AdminScreen';
import { normalizeVi } from '@/api/location';
import { EmptyState, Loading } from '@/components/ui';
import { useCoverage, useMyGrants } from '@/queries/admin';
import { useCategoryAxisGrants } from '@/queries/org-admin';
import { isMaster } from '@/api/admin';
import { C, F } from '@/theme';

/**
 * Ma trận phủ sóng (danh mục × tỉnh) của master.
 *
 * Mỗi ô KHÔNG có người phụ trách là một dòng tin chảy thẳng vào hàng đợi của master. Với 34
 * tỉnh × N danh mục thì số ô trống lớn hơn trực giác rất nhiều, và master chỉ phát hiện khi
 * đã ngập. Màn này tồn tại để nhìn thấy trước lúc đó.
 *
 * BE chỉ trả các ô ĐÁNG CHÚ Ý — ô có người và không tồn đọng bị lược đi, nên danh sách rỗng ở
 * đây là tin tốt, không phải lỗi tải.
 *
 * Ô đã có người thì hiện luôn TÊN họ. `/moderation/coverage` cố ý chỉ trả cờ `hasModerator`
 * (ma trận phải đọc trọn 34 tỉnh × N danh mục, nhồi thêm danh tính vào đó là phình một response
 * vốn đã lớn), nên tên ghép từ `/role-grants/category-axis` — cùng tập grant, một lượt gọi cho
 * cả màn. Thiếu nó thì ô tồn đọng chỉ nói "đã có người" mà master vẫn không biết gọi ai.
 */
/**
 * Bốn câu hỏi master thật sự mở màn này để hỏi — KHÔNG phải bốn lát cắt của cùng một tập.
 *
 * `gap` là ô không ai duyệt: tin rơi thẳng về hàng đợi master. `partial` là ô có người nhưng
 * chỉ vài phường — trạng thái thứ ba mà bản trước ép vào "chưa có ai", và là nguyên nhân của
 * một lần hiểu nhầm thật. `backlog` cắt ngang cả hai: ô đã có người vẫn tồn đọng được.
 */
const VIEWS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'gap', label: 'Chưa có ai' },
  { value: 'partial', label: 'Chỉ vài phường' },
  { value: 'backlog', label: 'Đang tồn đọng' },
] as const;

/** `CellView` chứ không `View`: `View` là component của React Native, trùng tên là che mất nó. */
type CellView = (typeof VIEWS)[number]['value'];

type Cell = {
  categoryId: string;
  categoryName: string;
  provinceCode: string;
  hasModerator: boolean;
  partialByWard: boolean;
  pending: number;
};

/** Ô có khớp lát cắt đang chọn không — hàm THUẦN, tách ra để đọc được từng vế một. */
function matchesView(cell: Cell, view: CellView): boolean {
  if (view === 'gap') return !cell.hasModerator && !cell.partialByWard;
  if (view === 'partial') return cell.partialByWard;
  if (view === 'backlog') return cell.pending > 0;
  return true;
}

export default function Coverage() {
  const { data, error, isLoading } = useCoverage();
  const master = isMaster(useMyGrants().data);
  const { data: axis } = useCategoryAxisGrants({}, master);

  /*
   * Khoá theo `categoryId` chứ không theo ô: grant TOÀN QUỐC (`provinceCodes` rỗng) phủ mọi
   * tỉnh, nên dựng map theo cặp (danh mục, tỉnh) sẽ bỏ sót đúng người phủ rộng nhất.
   */
  const [view, setView] = useState<CellView>('all');
  const [term, setTerm] = useState('');

  const holdersOf = (categoryId: string, province: string) =>
    (axis ?? [])
      .filter(
        (g) =>
          g.categoryId === categoryId &&
          (g.provinceCodes.length === 0 || g.provinceCodes.includes(province)),
      )
      .map((g) => g.holderName);

  /*
   * Lọc ngay trên máy, không gọi lại BE: `/moderation/coverage` vốn đã trả TRỌN tập ô đáng
   * chú ý trong một lượt (nó phải thế, vì ba thẻ số ở trên là tổng của cả tập). Thêm tham số
   * lọc ở BE là thêm một lượt gọi cho mỗi ký tự gõ, đổi lấy đúng con số không.
   *
   * Bỏ dấu bằng `normalizeVi` — gõ "ha noi" phải ra "Hà Nội", cùng cách `AdminOrgPicker` làm.
   */
  const needle = normalizeVi(term.trim());
  const cells = (data?.cells ?? []).filter(
    (c) =>
      matchesView(c, view) &&
      (needle === '' ||
        normalizeVi(c.categoryName).includes(needle) ||
        normalizeVi(c.provinceCode).includes(needle)),
  );

  return (
    <AdminScreen title="Phủ sóng" note="ô nào chưa ai duyệt · tin sẽ dồn về master">
      {data ? (
        <View style={styles.kpis}>
          <Kpi label="Ô (danh mục × tỉnh)" value={String(data.totalCells)} />
          <Kpi label="Chưa có người" value={String(data.uncovered)} warn={data.uncovered > 0} />
          <Kpi label="Tin tồn đọng" value={String(data.backlog)} warn={data.backlog > 0} />
        </View>
      ) : null}

      {/*
        Một dòng nói màn này để LÀM GÌ. Tên "Phủ sóng" không tự giải thích được, và không đọc
        ra thì cả bảng chỉ là những con số không gắn với hành động nào.
      */}
      <Text style={styles.why}>
        Tin lên sàn được định tuyến theo ô (danh mục × tỉnh). Ô không có ai phụ trách thì tin
        rơi thẳng về hàng đợi của master — bảng này để thấy trước lúc đó, và để biết gọi ai.
      </Text>

      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Lọc theo danh mục hoặc tỉnh…"
          placeholderTextColor={C.deskTxtDim}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {/*
          Đếm ô ĐANG HIỆN, không phải tổng — ba thẻ số trên vẫn nói về cả hệ thống, và hai con
          số cạnh nhau mà một cái lọc một cái không thì phải nói rõ cái nào là cái nào.
        */}
        <Text style={styles.searchCount}>{cells.length}</Text>
      </View>

      <AdminFilter options={[...VIEWS]} value={view} onChange={(v) => setView(v as CellView)} />

      <FlatList
        data={cells}
        keyExtractor={(c) => `${c.categoryId}-${c.provinceCode}`}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.hasModerator && styles.rowGap]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cell}>
                {item.categoryName} · {item.provinceCode}
              </Text>
              <Text style={styles.meta}>
                {statusText(item, holdersOf(item.categoryId, item.provinceCode))}
                {item.pending > 0 ? ` · ${item.pending} tin chờ` : ''}
              </Text>
            </View>
            {item.pending > 0 ? <Text style={styles.count}>{item.pending}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (data?.cells ?? []).length > 0 ? (
            /* Có ô, chỉ là bộ lọc không khớp — nói đúng câu đó, đừng mừng hụt bằng dấu ✅. */
            <EmptyState icon="🔍" text="Không ô nào khớp bộ lọc" />
          ) : (
            <EmptyState icon="✅" text="Mọi ô đều có người phụ trách và không tồn đọng" />
          )
        }
      />
    </AdminScreen>
  );
}

/**
 * Trạng thái một ô, ba câu chứ KHÔNG phải hai.
 *
 * `partialByWard` là ca đã làm người đọc hiểu sai: grant tầng PHƯỜNG phủ vài phường của tỉnh,
 * và ma trận cố ý không tính nó là "đã phủ tỉnh" — gộp vào là báo với master rằng tỉnh đó đã
 * có người lo, sai đúng chiều nguy hiểm. Nhưng in nhị phân "CHƯA có ai" thì cũng sai: master
 * nhìn thấy tên người đó ở bảng Phân quyền rồi tưởng ma trận hỏng.
 *
 * Nói đủ cả hai vế: CÓ người ở mức phường, và phần CÒN LẠI của tỉnh vẫn trống.
 */
function statusText(
  cell: { hasModerator: boolean; partialByWard: boolean },
  names: string[],
): string {
  if (cell.hasModerator) return holderText(names);
  if (cell.partialByWard) {
    const who = names.length > 0 ? ` (${holderText(names)})` : '';
    return `Chỉ phủ vài PHƯỜNG${who} — phần còn lại của tỉnh chưa có ai`;
  }
  return 'CHƯA có ai phụ trách';
}

/**
 * Tên người phụ trách, hoặc câu chung khi chưa tra ra.
 *
 * Rỗng KHÔNG đồng nghĩa "chưa có ai": master có thể chưa tải xong bảng danh tính. Nói "Đã có
 * người phụ trách" trong ca đó thì vẫn đúng.
 */
function holderText(names: string[]): string {
  if (names.length === 0) return 'Đã có người phụ trách';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, warn && { color: C.badText }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  searchIcon: { fontSize: 13, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: F.ui, fontSize: 13, color: C.deskTxt },
  searchCount: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim },
  why: {
    fontFamily: F.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.deskTxtDim,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  kpi: { flex: 1, backgroundColor: C.deskRaise, borderRadius: 8, padding: 12 },
  kpiValue: { fontFamily: F.monoBold, fontSize: 20, color: C.deskTxt },
  kpiLabel: { fontFamily: F.ui, fontSize: 10.5, color: C.deskTxtDim, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.deskRaise,
    borderRadius: 8,
    padding: 12,
  },
  // Ô trống là thứ phải nhảy ra khỏi danh sách — nó mới là lý do màn này tồn tại.
  rowGap: { borderLeftWidth: 3, borderLeftColor: C.badText },
  cell: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxt },
  meta: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 2 },
  count: { fontFamily: F.monoBold, fontSize: 16, color: C.tape },
});
