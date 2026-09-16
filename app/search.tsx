import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingRow } from '@/components/ListingRow';
import { SearchFilterPanel } from '@/components/SearchFilterPanel';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useSearch } from '@/queries/listings';
import { activeFilterCount, EMPTY_SEARCH, hasSearchCriteria } from '@/api/db';
import type { SearchFilter } from '@/api/db';
import { C, F } from '@/theme';

export default function Search() {
  const router = useRouter();
  /** Thứ người dùng đang chỉnh — hiện ngay trên các ô nhập. */
  const [draft, setDraft] = useState<SearchFilter>(EMPTY_SEARCH);
  // Mở sẵn: người vào màn tìm kiếm thường đã biết mình muốn lọc gì, bắt bấm thêm một nhịp để
  // thấy bộ lọc là che mất thứ họ tới để dùng. Nút thu gọn vẫn giữ cho ai cần chỗ xem kết quả.
  const [panelOpen, setPanelOpen] = useState(true);

  // Chờ 300ms rồi mới gọi query. Debounce CẢ bộ lọc chứ không riêng từ khoá: ô giá cũng là gõ
  // phím, gọi thẳng thì gõ "500000" bắn sáu request. Tỉnh/danh mục là thao tác dứt khoát nên
  // 300ms không ai thấy.
  const [filter, setFilter] = useState<SearchFilter>(EMPTY_SEARCH);
  useEffect(() => {
    const t = setTimeout(() => setFilter(draft), 300);
    return () => clearTimeout(t);
  }, [draft]);

  const { data, error, isFetching } = useSearch(filter);
  const idle = !hasSearchCriteria(draft);
  const filterCount = activeFilterCount(draft);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Tìm kiếm" />

      <View style={styles.inputRow}>
        <Text style={{ fontSize: 15 }}>🔍</Text>
        <TextInput
          autoFocus
          value={draft.q}
          onChangeText={(q) => setDraft((f) => ({ ...f, q }))}
          placeholder="Tìm xe đạp, sách, laptop..."
          placeholderTextColor={C.muted}
          style={styles.input}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        /*
          Ngăn lọc nằm TRONG danh sách, không phải anh em của nó.

          Đặt ngoài thì nó là một khối cố định trong cột flex: bộ lọc của Xe cộ có 17 field nên
          nó dài hơn màn hình, tràn ra ngoài và không có gì cuộn được. Nằm trong header của
          `FlatList` thì lọc và kết quả cuộn chung một mạch.

          Truyền PHẦN TỬ chứ không phải hàm (`{() => <X/>}`): hàm inline tạo một component type
          mới ở mỗi lần render, `FlatList` remount cả header, và mọi `TextInput` trong ngăn lọc
          (giá, khoảng số) mất focus sau từng ký tự.
        */
        ListHeaderComponent={
          <>
            <View style={styles.filterBar}>
              <Pressable
                onPress={() => setPanelOpen((v) => !v)}
                style={({ pressed }) => [
                  styles.filterBtn,
                  filterCount > 0 && styles.filterBtnOn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.filterBtnText, filterCount > 0 && { color: C.paperWarm }]}>
                  {panelOpen ? '⌃' : '⌄'} Bộ lọc{filterCount > 0 ? ` · ${filterCount}` : ''}
                </Text>
              </Pressable>

              {filterCount > 0 && (
                // Xoá lọc giữ nguyên từ khoá: hai thứ độc lập, gộp lại thì người dùng mất luôn
                // thứ họ vừa gõ chỉ vì muốn bỏ một cái chip.
                <Pressable onPress={() => setDraft((f) => ({ ...EMPTY_SEARCH, q: f.q }))} hitSlop={6}>
                  <Text style={styles.clear}>Xoá lọc</Text>
                </Pressable>
              )}
            </View>

            {panelOpen && <SearchFilterPanel filter={draft} onChange={setDraft} />}
          </>
        }
        renderItem={({ item, index }) => (
          <ListingRow
            item={item}
            index={index}
            onPress={() => router.push(`/listing/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          isFetching ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState
              icon="🔍"
              text={idle ? 'Nhập từ khoá hoặc chọn khu vực' : 'Không tìm thấy tin phù hợp'}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
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
    marginTop: 10,
    marginBottom: 14,
  },
  // Không có `paddingHorizontal`: khối này giờ nằm trong `contentContainerStyle` của FlatList,
  // vốn đã có 18 — thêm nữa là lề đôi.
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  filterBtn: {
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  filterBtnOn: { backgroundColor: C.moss, borderColor: C.moss },
  filterBtnText: { fontFamily: F.uiSemi, fontSize: 12, color: C.ink },
  clear: { fontFamily: F.ui, fontSize: 12, color: C.pin },
  input: { flex: 1, fontFamily: F.ui, fontSize: 14, color: C.ink, paddingVertical: 9 },
});
