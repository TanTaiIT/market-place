import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface } from '@/components/Surface';
import { ListingForm } from '@/components/ListingForm';
import { ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useCreateListing } from '@/queries/listings';
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
   * `?org=<slug>` — đăng thẳng vào một nhóm, đi từ nút trên trang hồ sơ nhóm.
   *
   * Slug đi theo ĐƯỜNG DẪN chứ không mượn `X-Org-Slug`: người thuộc nhiều nhóm không phải
   * đổi "nhóm đang thao tác" chỉ để đăng một tin, và không đăng nhầm vào nhóm đang mở.
   */
  const { org: orgSlug } = useLocalSearchParams<{ org?: string }>();
  const { data: org } = useOrgProfile(orgSlug ?? '');
  const toGroup = orgSlug && org ? { slug: orgSlug, name: org.name } : undefined;

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
