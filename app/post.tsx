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
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { PhotoPicker } from '@/components/PhotoPicker';
import { EMPTY_LOCATION, LocationFields, type ListingLocation } from '@/components/LocationFields';
import { validateListingDraft } from '@/components/listingDraft';
import { VisibilityPicker, type PostVisibility } from '@/components/VisibilityPicker';
import { CatTape, Field, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useCategories, useCreateListing } from '@/queries/listings';
import { useOrgSlug } from '@/stores/auth';
import { useListingPhotos } from '@/queries/upload';
import { C, F, shadow } from '@/theme';

export default function Post() {
  const router = useRouter();
  const toast = useToast();
  const activeOrg = useOrgSlug();
  const create = useCreateListing();
  const { photos, addPhotos, removePhoto, retryPhoto, photoUrls, uploadingCount, hasFailed } =
    useListingPhotos();

  const { data: categories } = useCategories();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  // Giữ id chứ không giữ tên: BE nhận `categoryId` là ObjectId. Rỗng cho tới khi danh mục
  // tải xong hoặc người dùng chọn.
  const [categoryId, setCategoryId] = useState('');
  // Mặc định nội bộ: tin ở lại trong tổ chức cho tới khi người đăng chủ động đưa ra công khai.
  // Không thuộc tổ chức nào thì chỉ còn một lựa chọn, và nó đã đúng.
  const [visibility, setVisibility] = useState<PostVisibility>(
    activeOrg ? 'org_internal' : 'public',
  );
  // Tên tỉnh/xã, không phải mã — BE lưu và lọc bằng chính chuỗi này.
  const [location, setLocation] = useState<ListingLocation>(EMPTY_LOCATION);

  /* @keyframes pinPress — nút lún xuống rồi bật nhẹ lên */
  const press = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value }] }));

  // Khoá nút khi còn ảnh đang bay: ảnh chưa xong thì tin sẽ thiếu URL của nó
  const blocked = create.isPending || uploadingCount > 0;

  const submit = () => {
    press.value = withSequence(
      withTiming(6, { duration: 140 }),
      withSpring(-3, { damping: 6 }),
      withSpring(0),
    );

    const error = validateListingDraft({
      title,
      price,
      desc,
      categoryId,
      photoCount: photoUrls.length,
      hasFailedPhoto: hasFailed,
      location,
    });
    if (error) return toast(error);

    create.mutate(
      { title, price, desc, categoryId, photoUrls, visibility, ...location },
      {
        onSuccess: () => {
          // Tin vào BE ở trạng thái `pending`, feed chỉ hiện tin `active` — về feed là không
          // thấy tin đâu và tưởng đăng hụt. Đưa thẳng sang "Tin đã đăng", nơi có tin chờ duyệt.
          toast('📌 Đã ghim tin — chờ duyệt rồi sẽ lên bảng');
          router.replace('/mylistings');
        },
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );
  };

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
            <PhotoPicker
              photos={photos}
              onAdd={addPhotos}
              onRemove={removePhoto}
              onRetry={retryPhoto}
            />

            <Field
              label="Tên món đồ"
              hand
              value={title}
              onChangeText={setTitle}
              placeholder="Ví dụ: Xe đạp thể thao..."
            />

            <Text style={styles.label}>Giá bán</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dong}>đ</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                style={styles.priceInput}
              />
            </View>

            <Text style={styles.label}>Mô tả ngắn</Text>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="Tình trạng, lý do bán, ghi chú thêm..."
              placeholderTextColor={C.muted}
              multiline
              style={styles.textarea}
            />

            <Text style={[styles.label, { marginTop: 18 }]}>Danh mục</Text>
            <View style={styles.catRow}>
              {(categories ?? []).map((c) => (
                <CatTape
                  key={c.id}
                  label={c.icon ? `${c.icon} ${c.name}` : c.name}
                  active={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>

            <VisibilityPicker value={visibility} onChange={setVisibility} />

            <LocationFields value={location} onChange={setLocation} />

            <Animated.View style={[{ marginTop: 18 }, pressStyle]}>
              <View style={styles.submitShadow} />
              <Pressable
                onPress={submit}
                disabled={blocked}
                style={[styles.submit, blocked && { opacity: 0.7 }]}
              >
                <Text style={styles.submitText}>
                  {create.isPending
                    ? 'Đang ghim...'
                    : uploadingCount > 0
                      ? `Đang tải ảnh (${photos.length - uploadingCount}/${photos.length})...`
                      : '📌 Ghim lên bảng'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Corkboard>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: C.inkSoft,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    marginBottom: 18,
  },
  dong: { fontFamily: F.monoBold, color: C.pin, fontSize: 16 },
  priceInput: { flex: 1, fontFamily: F.handLight, fontSize: 18, color: C.ink, paddingVertical: 6 },
  textarea: {
    borderBottomWidth: 2,
    borderBottomColor: C.lineInput,
    minHeight: 76,
    textAlignVertical: 'top',
    fontFamily: F.ui,
    fontSize: 15,
    lineHeight: 26,
    color: C.ink,
    paddingVertical: 6,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  submitShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    bottom: -6,
    backgroundColor: C.pinDark,
    borderRadius: 10,
  },
  submit: {
    backgroundColor: C.pin,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow,
  },
  submitText: { color: '#fff', fontFamily: F.uiBlack, fontSize: 15.5 },
});
