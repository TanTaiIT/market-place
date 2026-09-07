import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/ListingCard';
import { SearchCrumbBar } from '@/components/SearchCrumbBar';
import { useRequireAuth } from '@/components/GuestGate';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useSavedIds, useSearch, useToggleSaved } from '@/queries/listings';
import { useMyOrgs } from '@/queries/org';
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
  const { data, error, isFetching } = useSearch(filter);

  /*
   * Thẻ tin của bảng tin cần bốn thứ ngoài `item`: trạng thái đã lưu, hành động lưu, tên tổ chức
   * và cửa chặn khách. Trang này công khai (khách xem được), nên `useSavedIds` tự tắt khi chưa
   * đăng nhập — trái tim hiện rỗng, chạm vào thì `requireAuth` đưa sang màn đăng nhập.
   */
  const { data: savedIds } = useSavedIds();
  const toggleSaved = useToggleSaved();
  const requireAuth = useRequireAuth();
  const { data: myOrgs } = useMyOrgs();

  const saved = new Set(savedIds ?? []);
  // BE không snapshot tên tổ chức vào tin; tra từ danh sách tổ chức của chính người xem là đủ và
  // trung thực. Tra không ra (khách, hoặc tin công khai) thì thẻ tự bỏ dòng đó chứ không bịa tên.
  const orgNameById = new Map((myOrgs ?? []).map((o) => [o.id, o.name]));

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
        count={data ? data.length : null}
        loading={isFetching}
        onChange={applyFilter}
        onEdit={openForm}
      />

      <FlatList
        data={data ?? []}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={styles.body}
        renderItem={({ item, index }) => (
          <ListingCard
            item={item}
            index={index}
            orgName={item.organizationId ? orgNameById.get(item.organizationId) : undefined}
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
