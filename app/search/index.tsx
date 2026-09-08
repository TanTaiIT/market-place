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
import { PinButton, ScreenHeader } from '@/components/ui';
import { SearchFilterPanel } from '@/components/SearchFilterPanel';
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
 * Màn TIÊU CHÍ tìm kiếm — không có kết quả nào ở đây.
 *
 * Bản trước gộp cả hai: ngăn lọc nằm trong `ListHeaderComponent` của danh sách kết quả, và mỗi
 * ký tự gõ vào là một lượt gọi mạng sau 300ms. Không ai biết khi nào "xong" — kết quả tự đổi
 * dưới tay trong lúc còn đang chỉnh bộ lọc, nên không có mốc nào để dừng lại. Nút "Tìm kiếm"
 * dính đáy màn này là mốc đó.
 *
 * Lý do thứ hai của việc tách màn — "thanh trượt giá bị `FlatList` giành cú kéo" — đã tự tiêu:
 * bộ lọc giá nay là ô nhập (`PriceField`), không còn cử chỉ nào để tranh chấp. Việc tách vẫn
 * đúng vì lý do đầu.
 *
 * Tiêu chí đi sang trang kết quả bằng ROUTE PARAMS (`searchToParams`), không qua store: back trả
 * đúng bộ lọc cũ, và link kết quả gửi được cho người khác.
 */
export default function SearchForm() {
  const router = useRouter();
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

  const count = activeFilterCount(filter);

  /**
   * Không còn cửa chặn nào: bộ lọc rỗng là một lượt tìm hợp lệ, trả về tất cả tin.
   *
   * Trước đây nút bị `disabled` kèm một toast "Nhập từ khoá hoặc chọn ít nhất một bộ lọc". Cửa
   * đó chỉ hợp lý khi form là màn ĐẦU của luồng tìm; giờ nó là màn thứ hai (mở ra từ trang kết
   * quả), nên "xoá hết bộ lọc rồi tìm lại" là thao tác bình thường — mà nút mờ thì không làm
   * được, và người dùng mắc lại đúng cái tờ khai họ vừa muốn dọn.
   */
  /*
   * `dismissTo` chứ không `push`: form này gần như luôn được mở TỪ trang kết quả, nên đường
   * đúng là quay lại chính màn đó với bộ lọc mới, không phải xếp thêm một màn kết quả nữa lên
   * trên. `push` mỗi vòng sửa bộ lọc là một tầng stack — sửa năm lần thì phải bấm back sáu lần
   * mới về được bảng tin, đúng cái bẫy mà `applyFilter` bên kia đã dùng `replace` để tránh.
   *
   * Nó cũng phủ nốt ca deep link thẳng vào `/search`: khi `/search/results` không có trong
   * stack, `dismissTo` tự chuyển thành `replace` (hành vi khai trong typings) — nên không cần
   * nhánh `canGoBack()` viết tay như bản trước.
   *
   * Params VẪN được áp: `dismissTo` là `linkTo(href, { event: 'POP_TO' })`, tức là đi qua đúng
   * đường phân giải href kèm params, không phải một lượt pop trần.
   */
  const submit = () =>
    router.dismissTo({ pathname: '/search/results', params: searchToParams(filter) });

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
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchRow}>
            <Text style={styles.glyph}>🔍</Text>
            {/*
              KHÔNG `autoFocus`. Bàn phím bật lên ngay lúc mở màn che mất hơn nửa dưới — đúng
              phần chứa ngăn lọc, tức là gần hết thứ màn này bày ra. Từ khi ô tìm kiếm ở bảng
              tin đi thẳng vào trang kết quả, màn này là chỗ người ta tới để CHỌN bộ lọc,
              không phải để gõ — bật bàn phím trước là đoán sai ý định.
            */}
            <TextInput
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

          <SearchFilterPanel filter={filter} onChange={setFilter} />
        </ScrollView>

        {/* Thanh dính đáy: mốc "xong" của cả màn. Nằm ngoài ScrollView nên luôn thấy. */}
        <View style={styles.bar}>
          {count > 0 && (
            // Xoá lọc GIỮ NGUYÊN từ khoá: hai thứ độc lập, gộp lại thì người dùng mất luôn thứ vừa gõ.
            <Pressable onPress={() => setFilter((f) => ({ ...EMPTY_SEARCH, q: f.q }))} hitSlop={8}>
              <Text style={styles.clear}>Xoá lọc</Text>
            </Pressable>
          )}
          {/*
            Nhãn nói ra thứ sắp xảy ra. Chưa có tiêu chí nào thì bấm là mở TẤT CẢ tin — gọi nó
            là "Tìm kiếm" thì người dùng tưởng mình quên nhập gì đó và ngồi lại điền.
            `activeFilterCount` cố tình không đếm từ khoá (ô riêng, ngoài ngăn lọc), nên phải
            hỏi `hasSearchCriteria` chứ không dựa vào `count`.
          */}
          <PinButton
            tone="ok"
            label={
              !hasSearchCriteria(filter)
                ? 'Xem tất cả tin'
                : count > 0
                  ? `Tìm kiếm · ${count} bộ lọc`
                  : 'Tìm kiếm'
            }
            onPress={submit}
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
});
