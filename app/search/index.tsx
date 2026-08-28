import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingRow } from '@/components/ListingRow';
import { PinButton, ScreenHeader } from '@/components/ui';
import { SearchFilterPanel } from '@/components/SearchFilterPanel';
import { useToast } from '@/components/Toast';
import { useCategories, useListings } from '@/queries/listings';
import {
  activeFilterCount,
  EMPTY_SEARCH,
  hasSearchCriteria,
  paramsToSearch,
  searchToParams,
} from '@/api/db';
import type { SearchFilter } from '@/api/db';
import { C, F, R } from '@/theme';

/**
 * Bao nhiêu tin gợi ý dưới ngăn lọc. Sáu là đủ để màn không trống trơn khi mới mở, và không đủ
 * để ai tưởng đây là kết quả tìm kiếm — thứ chỉ xuất hiện sau khi bấm nút.
 */
const SUGGEST_MAX = 6;

/**
 * Màn TIÊU CHÍ tìm kiếm — không có kết quả nào ở đây.
 *
 * Bản trước gộp cả hai: ngăn lọc nằm trong `ListHeaderComponent` của danh sách kết quả, và mỗi
 * ký tự gõ vào là một lượt gọi mạng sau 300ms. Hai hệ quả:
 *
 * 1. **Thanh trượt giá kéo không được.** Nó là cú kéo NGANG nằm trong một danh sách cuộn DỌC,
 *    nên `FlatList` giành cú chạm. Ở đây thanh trượt nằm trong màn của chính nó, và màn tạm khoá
 *    cuộn trong lúc ngón tay còn trên thumb (`onPriceDragChange`).
 * 2. **Không ai biết khi nào "xong".** Kết quả tự đổi dưới tay trong lúc còn đang chỉnh bộ lọc,
 *    nên không có mốc nào để dừng lại. Một nút "Tìm kiếm" là mốc đó.
 *
 * Tiêu chí đi sang trang kết quả bằng ROUTE PARAMS (`searchToParams`), không qua store: back trả
 * đúng bộ lọc cũ, và link kết quả gửi được cho người khác.
 */
export default function SearchForm() {
  const router = useRouter();
  const toast = useToast();
  /*
   * Mồi từ params, không phải từ rỗng.
   *
   * Trang kết quả mở lại form này khi không back được (vào bằng deep link), và nó truyền chính
   * bộ lọc đang xem sang. Khởi tạo rỗng là người dùng bấm "Bộ lọc" rồi thấy sạch trơn — tưởng
   * mình vừa mất bộ lọc. Không có params thì `paramsToSearch` trả đúng bộ rỗng.
   */
  const params = useLocalSearchParams();
  const [filter, setFilter] = useState<SearchFilter>(() =>
    paramsToSearch(params as Record<string, string | string[] | undefined>),
  );
  /** Ngón tay đang trên thumb giá → khoá cuộn dọc, xem ghi chú đầu file. */
  const [priceDragging, setPriceDragging] = useState(false);

  // Cùng query mà bảng tin dùng, nên đổi chip danh mục là đọc từ cache chứ không gọi lại mạng.
  const { data: suggestions } = useListings(filter.categoryId ?? '');
  const { data: categories } = useCategories();
  const categoryName = categories?.find((c) => c.id === filter.categoryId)?.name;
  const suggested = (suggestions ?? []).slice(0, SUGGEST_MAX);

  const count = activeFilterCount(filter);
  const ready = hasSearchCriteria(filter);

  const submit = () => {
    if (!ready) {
      // Không chặn im lặng: nút mờ mà bấm không ra gì là người dùng bấm lại lần nữa.
      toast('Nhập từ khoá hoặc chọn ít nhất một bộ lọc');
      return;
    }
    router.push({ pathname: '/search/results', params: searchToParams(filter) });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/*
        Bàn phím mở là nút "Tìm kiếm" bị che — thanh dính đáy nằm trong dòng chảy của màn.
        Cùng lối `KeyboardAvoidingView` mà màn chat đang dùng: iOS đệm thêm chiều cao bàn
        phím, còn Android thì cửa sổ tự co (`adjustResize`) nên `behavior` để trống, thêm nữa
        là đẩy hai lần.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Tìm kiếm" />

        <ScrollView
          scrollEnabled={!priceDragging}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchRow}>
            <Text style={styles.glyph}>🔍</Text>
            <TextInput
              autoFocus
              value={filter.q}
              onChangeText={(q) => setFilter((f) => ({ ...f, q }))}
              placeholder="Tên món đồ, ví dụ: xe đạp, sách 12…"
              placeholderTextColor={C.muted}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={submit}
            />
            {!!filter.q && (
              <Pressable onPress={() => setFilter((f) => ({ ...f, q: '' }))} hitSlop={8}>
                <Text style={styles.clearGlyph}>✕</Text>
              </Pressable>
            )}
          </View>

          <SearchFilterPanel
            filter={filter}
            onChange={setFilter}
            onPriceDragChange={setPriceDragging}
          />

          {/*
            Dải gợi ý — giữ lại danh sách tin mà bản gộp trước đây vẫn hiện ở màn này.
            Nó theo DANH MỤC đang chọn nhưng KHÔNG theo từ khoá/giá/khu vực: đây là chỗ để ngó
            trong lúc còn đang chỉnh bộ lọc, không phải kết quả. Nhãn nói rõ điều đó.
          */}
          {suggested.length > 0 && (
            <View style={styles.suggest}>
              <Text style={styles.suggestLabel}>
                {categoryName ? `Tin mới trong ${categoryName}` : 'Tin mới đăng'}
              </Text>
              <Text style={styles.suggestNote}>
                Chưa phải kết quả — bấm Tìm kiếm để lọc theo tiêu chí ở trên.
              </Text>
              <View style={styles.suggestList}>
                {suggested.map((item, i) => (
                  <ListingRow
                    key={item.id}
                    item={item}
                    index={i}
                    onPress={() => router.push(`/listing/${item.id}`)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Thanh dính đáy: mốc "xong" của cả màn. Nằm ngoài ScrollView nên luôn thấy. */}
        <View style={styles.bar}>
          {count > 0 && (
            // Xoá lọc GIỮ NGUYÊN từ khoá: hai thứ độc lập, gộp lại thì người dùng mất luôn thứ vừa gõ.
            <Pressable onPress={() => setFilter((f) => ({ ...EMPTY_SEARCH, q: f.q }))} hitSlop={8}>
              <Text style={styles.clear}>Xoá lọc</Text>
            </Pressable>
          )}
          <PinButton
            tone="ok"
            label={count > 0 ? `Tìm kiếm · ${count} bộ lọc` : 'Tìm kiếm'}
            onPress={submit}
            disabled={!ready}
            style={styles.cta}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: 18, paddingBottom: 28 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.md,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  glyph: { fontSize: 15 },
  input: { flex: 1, fontFamily: F.ui, fontSize: 14.5, color: C.ink, paddingVertical: 12 },
  clearGlyph: { fontSize: 13, color: C.muted },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  clear: { fontFamily: F.uiSemi, fontSize: 13, color: C.inkSoft },
  cta: { flex: 1 },
  suggest: { marginTop: 24 },
  suggestLabel: { fontFamily: F.uiBold, fontSize: 15, color: C.ink },
  suggestNote: { fontFamily: F.ui, fontSize: 11.5, color: C.muted, marginTop: 3, marginBottom: 12 },
  suggestList: { gap: 10 },
});
