import React, { useEffect } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/ListingCard';
import { SearchCrumbBar } from '@/components/SearchCrumbBar';
import { useRequireAuth } from '@/components/GuestGate';
import { EmptyState, Loading, PagedFooter, ScreenHeader } from '@/components/ui';
import { useSavedIds, useSearch, useToggleSaved } from '@/queries/listings';
import { useRecordSearch } from '@/stores/search-history';
import { hasSearchCriteria, paramsToSearch, searchToParams } from '@/api/db';
import type { SearchFilter } from '@/api/db';
import { C } from '@/theme';

/**
 * Danh sách tin theo tiêu chí người dùng vừa chọn ở `/search`.
 *
 * Tiêu chí đọc từ ROUTE PARAMS, không từ store — nên màn này mở được bằng deep link, nút back
 * trả về đúng form cũ, và `SearchCrumbBar` sửa bộ lọc bằng cách viết lại chính URL này. Params
 * hỏng thì `paramsToSearch` rơi về rỗng chứ không ném (xem `db.ts`).
 */
export default function SearchResults() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const filter = paramsToSearch(params as Record<string, string | string[] | undefined>);
  const { data, error, isFetching, total, loadMore, isFetchingNextPage } = useSearch(filter);

  /*
   * Ghi lượt tìm làm tín hiệu cho "Gợi ý cho bạn" — ghi ở ĐÂY chứ không ở form `/search`.
   *
   * Màn kết quả là nơi duy nhất mọi đường tìm kiếm đi qua: form lọc, chip danh mục ở thanh đầu
   * bảng tin, ô tìm nhanh, và cả deep link. Ghi ở form thì ba đường kia không được đếm.
   *
   * Bỏ qua lượt "mở trang kết quả rỗng" (không tiêu chí nào): nó không nói lên sở thích gì, mà
   * lại là đường người dùng bấm nhiều nhất — đếm nó vào là làm loãng mọi tín hiệu thật.
   */
  const recordSearch = useRecordSearch();
  // Tách ba trường ra biến rời: `filter` là object MỚI mỗi lần render, để nó trong mảng
  // dependency là effect chạy mỗi khung hình và ghi lại cùng một lượt tìm hàng chục lần.
  const { q, categoryId, province } = filter;
  // Chỉ ghi khi có tín hiệu THẬT trong ba trường được ghi xuống. `hasSearchCriteria` rộng hơn
  // thế (còn tính giá, xã, nhóm), nên dựa vào nó sẽ ghi những bản ghi rỗng không nói lên gì.
  const hasSignal = q.trim() !== '' || categoryId !== null || province !== null;
  useEffect(() => {
    if (!hasSignal) return;
    recordSearch({ q: q.trim(), categoryId, province });
  }, [hasSignal, q, categoryId, province, recordSearch]);

  /*
   * Thẻ tin của bảng tin cần bốn thứ ngoài `item`: trạng thái đã lưu, hành động lưu, tên tổ chức
   * và cửa chặn khách. Trang này công khai (khách xem được), nên `useSavedIds` tự tắt khi chưa
   * đăng nhập — trái tim hiện rỗng, chạm vào thì `requireAuth` đưa sang màn đăng nhập.
   */
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const requireAuth = useRequireAuth();

  const saved = new Set(savedIds ?? []);

  /*
   * Bỏ một tiêu chí = viết lại params, và `replace` chứ không `push`.
   *
   * Params LÀ nguồn duy nhất của bộ lọc nên không có state nào phải đồng bộ theo. Còn `push` thì
   * mỗi lần bấm ✕ chồng thêm một trang: bỏ ba chip là phải bấm back bốn lần mới về được form.
   */
  const applyFilter = (next: SearchFilter) =>
    router.replace({ pathname: '/search/results', params: searchToParams(next) });

  /**
   * Mở form lọc, mang theo đúng bộ lọc đang xem.
   *
   * `push` chứ KHÔNG `back()`. Bản trước dùng `back()` với lý do "form nằm ngay dưới trong
   * stack" — điều đó chỉ đúng hồi luồng là `bảng tin → form → kết quả`. Từ khi bảng tin đi
   * thẳng vào kết quả, thứ nằm dưới là chính bảng tin, nên bấm "Bộ lọc" lại nhảy về trang chủ.
   *
   * Đường về do `dismissTo` ở form lo (xem `search/index.tsx`): nó pop lại đúng màn kết quả này
   * và áp params mới, nên `push` ở đây không làm stack phình theo mỗi vòng sửa bộ lọc.
   */
  const openForm = () =>
    router.push({ pathname: '/search', params: searchToParams(filter) });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Kết quả" />

      <SearchCrumbBar
        filter={filter}
        count={data ? total : null}
        loading={isFetching}
        onChange={applyFilter}
        onEdit={openForm}
      />

      <FlatList
        data={data ?? []}
        keyExtractor={(i) => String(i.id)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} />}
        contentContainerStyle={styles.body}
        renderItem={({ item, index }) => (
          <ListingCard
            item={item}
            index={index}
            saved={saved.has(item.id)}
            onPress={() => router.push(`/listing/${item.id}`)}
            onToggleSave={() =>
              requireAuth(
                () => toggleSaved.mutate({ id: item.id, saved: !saved.has(item.id) }),
                'Đăng nhập để lưu tin',
              )
            }
          />
        )}
        ListEmptyComponent={
          isFetching ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : hasSearchCriteria(filter) ? (
            <EmptyState
              icon="🔍"
              text="Không có tin nào khớp. Thử bỏ một tiêu chí ở trên, hoặc mở rộng khoảng giá."
            />
          ) : (
            /*
             * Bộ lọc rỗng mà vẫn không có tin: cả chợ đang trống, không phải người dùng thiếu
             * nhập gì. Bản trước ghi "Chọn khu vực, danh mục hoặc nhập từ khoá để bắt đầu tìm"
             * — câu đó chỉ đúng hồi lượt tìm rỗng bị chặn; giờ nó sẽ đổ lỗi cho người dùng về
             * một cái kho rỗng.
             */
            <EmptyState icon="📭" text="Chưa có tin nào đang đăng." />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  // Cùng nhịp lề/khoảng cách với bảng tin: hai trang bày CÙNG một loại thẻ thì không được lệch
  // nhau vài pixel — người dùng đọc ra ngay là hai màn khác nhau dù cùng nội dung.
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 14 },
});
