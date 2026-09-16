import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface } from '@/components/Surface';
import { ListingForm } from '@/components/ListingForm';
import { ReconcileGate } from '@/components/ReconcileGate';
import { Loading, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useCreateListing,
  useMarkListingSold,
  useQuota,
  useRenewListing,
} from '@/queries/listings';
import { useListingPhotos } from '@/queries/upload';
import { useOrgProfile } from '@/queries/org-discover';

/**
 * Ghim tin mới.
 *
 * Màn này chỉ còn khung: `ListingForm` tự giữ vùng cuộn, tờ giấy và thanh nút dính đáy — nút
 * phải nằm NGOÀI vùng cuộn mới dính được, nên nó không tách ra route được.
 */
export default function Post() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateListing();
  const photos = useListingPhotos();

  /*
   * HÀNG RÀO ĐỐI SOÁT — tin cũ hết hạn phải được trả lời trước khi đăng tin mới.
   *
   * Chờ `quota` xong mới vẽ: hiện form trước rồi mới thay bằng hàng rào là giật mất cái form
   * người dùng đã bắt đầu gõ. Quota lỗi/chưa có phiên thì `isPending` cũng hết — hàng rào
   * không bao giờ chặn ai vì một request hỏng.
   */
  const quota = useQuota();
  const renew = useRenewListing();
  const sold = useMarkListingSold();
  const [busyAll, setBusyAll] = React.useState(false);
  const stale = quota.data?.needsReconcile ?? [];

  /*
   * Gia hạn cả loạt = N request tuần tự, không có endpoint hàng loạt ở BE.
   *
   * Tuần tự chứ không `Promise.all`: `RECONCILE_LIMIT` là 20, mà 20 request song song từ một
   * máy điện thoại thì rate limiter của BE chặn giữa loạt và người dùng thấy một nửa được gia
   * hạn. Chụp `ids` TRƯỚC vòng lặp — mỗi lần `mutateAsync` xong là `stale` co lại.
   */
  // Lỗi của hai nút trả lời đi cùng một cửa — toast, không phải một alert cho mỗi nút.
  const showError = (e: Error) => toast(`⚠️ ${e.message}`);

  const renewAll = async () => {
    const ids = stale.map((l) => l.id);
    setBusyAll(true);
    try {
      // eslint-disable-next-line no-await-in-loop -- tuần tự là CHỦ Ý, xem ghi chú trên
      for (const id of ids) await renew.mutateAsync(id);
      toast(`↻ Đã gia hạn ${ids.length} tin`);
    } catch (e) {
      toast(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusyAll(false);
    }
  };

  /*
   * `?org=<slug>` — đăng thẳng vào một nhóm, đi từ nút trên trang hồ sơ nhóm.
   *
   * Slug đi theo ĐƯỜNG DẪN chứ không mượn `X-Org-Slug`: người thuộc nhiều nhóm không phải
   * đổi "nhóm đang thao tác" chỉ để đăng một tin, và không đăng nhầm vào nhóm đang mở.
   */
  const { org: orgSlug } = useLocalSearchParams<{ org?: string }>();
  const { data: org } = useOrgProfile(orgSlug ?? '');
  const toGroup = orgSlug && org ? { slug: orgSlug, name: org.name } : undefined;

  if (quota.isPending || stale.length > 0) {
    return (
      <Surface>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScreenHeader title="Tin cũ của bạn" />
          {quota.isPending ? (
            <Loading />
          ) : (
            <ReconcileGate
              items={stale}
              onSold={(id) => sold.mutate(id, { onError: showError })}
              onRenew={(id) => renew.mutate(id, { onError: showError })}
              onRenewAll={renewAll}
              busyId={renew.isPending && !busyAll ? renew.variables : undefined}
              busyAll={busyAll}
            />
          )}
        </SafeAreaView>
      </Surface>
    );
  }

  return (
    <Surface>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScreenHeader title={toGroup ? `Đăng vào ${toGroup.name}` : 'Ghim tin mới'} />
          <ListingForm
            photos={photos}
            toGroup={toGroup}
            submitLabel="📌 Ghim lên bảng"
            busyLabel="Đang ghim..."
            busy={create.isPending}
            onSubmit={({ location, ...values }) =>
              create.mutate(
                { ...values, ...location, photoUrls: photos.photoUrls, orgSlug },
                {
                  onSuccess: () => {
                    // Tin vào BE ở trạng thái `pending`, feed chỉ hiện tin `active` — về feed là
                    // không thấy tin đâu và tưởng đăng hụt. Đưa thẳng sang "Tin đã đăng", nơi có
                    // cả tin chờ duyệt.
                    toast('📌 Đã ghim tin — chờ duyệt rồi sẽ lên bảng');
                    router.replace('/mylistings');
                  },
                  onError: (e: Error) => toast(`⚠️ ${e.message}`),
                },
              )
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Surface>
  );
}
