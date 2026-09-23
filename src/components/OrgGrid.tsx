import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { OrgGridCard, type OrgGridCardProps } from './OrgGridCard';
import { SectionHead } from './SectionHead';
import { S } from '@/theme';

/**
 * Lưới hai cột nhiều MỤC, mỗi mục có tiêu đề — cho màn "Nhóm".
 *
 * Không dùng `numColumns` của `FlatList`: nó xếp MỌI item vào ô, nên một tiêu đề mục chen giữa
 * hai mục cũng chỉ chiếm một ô bằng nửa hàng. Bản trước lách bằng cách nhét mục đầu vào
 * `ListHeaderComponent` — được với một mục, nhưng đó cũng là lý do "Nhóm của bạn" phải mang một
 * hình dạng khác (dòng ngang) so với phần lưới bên dưới.
 *
 * Ở đây dữ liệu là HÀNG: một hàng hoặc là tiêu đề, hoặc là một cặp thẻ. `FlatList` vẫn ảo hoá
 * theo hàng, tiêu đề chiếm trọn bề ngang, và hàng lẻ tự có ô đệm — không cần chèn `null` vào
 * mảng dữ liệu như cách cũ.
 */

/** Một thẻ kèm khoá render. `key` tách riêng chứ không spread vào props — React cấm điều đó. */
export type OrgGridCardItem = OrgGridCardProps & { key: string };

export type OrgGridSection = {
  key: string;
  title: string;
  /** Dòng phụ dưới tiêu đề — xem `SectionHead.note`. */
  note?: string;
  cards: OrgGridCardItem[];
};

type Row =
  | { key: string; kind: 'head'; title: string; note?: string }
  | { key: string; kind: 'pair'; a: OrgGridCardItem; b: OrgGridCardItem | null };

function toRows(sections: OrgGridSection[]): Row[] {
  const rows: Row[] = [];
  for (const s of sections) {
    if (s.cards.length === 0) continue;
    rows.push({ key: `head:${s.key}`, kind: 'head', title: s.title, note: s.note });
    for (let i = 0; i < s.cards.length; i += 2) {
      const a = s.cards[i];
      const b = s.cards[i + 1] ?? null;
      rows.push({ key: `pair:${s.key}:${a.key}`, kind: 'pair', a, b });
    }
  }
  return rows;
}

export function OrgGrid({
  sections,
  empty,
}: {
  sections: OrgGridSection[];
  /** Hiện khi KHÔNG mục nào có thẻ — mục rỗng tự biến mất, không để lại tiêu đề trơ. */
  empty: React.ReactElement;
}) {
  const rows = toRows(sections);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) =>
        item.kind === 'head' ? (
          // Mục thứ hai trở đi cần thở thêm một bậc phía trên: `gap` của danh sách chỉ đủ tách
          // hai hàng thẻ, chưa đủ để đọc ra "hết một mục, sang mục khác".
          <View style={index > 0 && styles.headGap}>
            <SectionHead title={item.title} note={item.note} />
          </View>
        ) : (
          <View style={styles.pair}>
            <Card item={item.a} />
            {/*
              Ô đệm cho cặp lẻ. Thẻ lấy `flex: 1` để chia đôi hàng, nên một hàng chỉ có MỘT thẻ
              sẽ cho thẻ đó ăn trọn bề ngang — rộng gấp đôi, và ảnh vuông cao gấp đôi theo.
            */}
            {item.b ? <Card item={item.b} /> : <View style={{ flex: 1 }} />}
          </View>
        )
      }
      ListEmptyComponent={empty}
    />
  );
}

function Card({ item }: { item: OrgGridCardItem }) {
  const { key: _key, ...props } = item;
  return <OrgGridCard {...props} />;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: S.xxl, gap: 14 },
  /* `SectionHead` đã có `marginBottom` phía dưới; đây là khoảng cách phía TRÊN nó. */
  headGap: { marginTop: S.md },
  pair: { flexDirection: 'row', gap: 14 },
});
