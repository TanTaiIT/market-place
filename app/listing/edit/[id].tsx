import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface } from '@/components/Surface';
import { ListingForm, listingToFormValues } from '@/components/ListingForm';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useListing, useUpdateListing } from '@/queries/listings';
import { useListingPhotos } from '@/queries/upload';
import type { Listing } from '@/api/db';

/**
 * Sửa tin của chính mình. Cùng form với màn ghim tin mới — cùng một schema bên BE.
 *
 * Chỉ vào được từ "Tin đã đăng", nhưng chủ tin vẫn do BE chốt: sửa tin của người khác trả 403
 * và rơi ra toast, app không tự dựng thêm một lớp kiểm quyền bằng bản chụp trong tay mình.
 */
export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = id ?? '';
  const { data: listing, error, isLoading } = useListing(listingId);

  return (
    <Surface>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScreenHeader title="Sửa tin" />
          {isLoading ? (
            <Loading onDark />
          ) : error || !listing ? (
            <EmptyState
              icon="📡"
              onDark
              text={(error as Error | null)?.message ?? 'Không tìm thấy tin này'}
            />
          ) : (
            /* Mount sau khi tin đã về: cả bộ ảnh cũ lẫn giá trị điền sẵn chỉ được đọc ở lần
               mount đầu, dựng sớm là form trắng và người dùng lưu đè bằng bản rỗng. */
            <EditForm listing={listing} />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Surface>
  );
}

function EditForm({ listing }: { listing: Listing }) {
  const router = useRouter();
  const toast = useToast();
  const update = useUpdateListing();
  const photos = useListingPhotos(listing.photoUrls);

  return (
    <ListingForm
      photos={photos}
      initial={listingToFormValues(listing)}
      submitLabel="💾 Lưu thay đổi"
      busyLabel="Đang lưu..."
      busy={update.isPending}
      onSubmit={({ location, ...values }) =>
        update.mutate(
          { id: listing.id, ...values, ...location, photoUrls: photos.photoUrls },
          {
            onSuccess: () => {
              // Về "Tin đã đăng" chứ không `back()`: sửa tin đã duyệt có thể đẩy nó về hàng đợi,
              // và đó là màn duy nhất hiện được trạng thái chờ duyệt cho người đăng thấy.
              toast('💾 Đã lưu thay đổi');
              router.replace('/mylistings');
            },
            onError: (e: Error) => toast(`⚠️ ${e.message}`),
          },
        )
      }
    />
  );
}
