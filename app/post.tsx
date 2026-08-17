import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { ListingForm } from '@/components/ListingForm';
import { ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useCreateListing } from '@/queries/listings';
import { useListingPhotos } from '@/queries/upload';

export default function Post() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateListing();
  const photos = useListingPhotos();

  return (
    <Corkboard>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScreenHeader title="Ghim tin mới" />
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ListingForm
              photos={photos}
              submitLabel="📌 Ghim lên bảng"
              busyLabel="Đang ghim..."
              busy={create.isPending}
              onSubmit={({ location, ...values }) =>
                create.mutate(
                  { ...values, ...location, photoUrls: photos.photoUrls },
                  {
                    onSuccess: () => {
                      // Tin vào BE ở trạng thái `pending`, feed chỉ hiện tin `active` — về feed
                      // là không thấy tin đâu và tưởng đăng hụt. Đưa thẳng sang "Tin đã đăng",
                      // nơi có cả tin chờ duyệt.
                      toast('📌 Đã ghim tin — chờ duyệt rồi sẽ lên bảng');
                      router.replace('/mylistings');
                    },
                    onError: (e: Error) => toast(`⚠️ ${e.message}`),
                  },
                )
              }
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Corkboard>
  );
}
