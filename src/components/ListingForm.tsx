import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AttrFields, visibleAttrFields } from './AttrFields';
import { PhotoPicker } from './PhotoPicker';
import { EMPTY_LOCATION, LocationFields, type ListingLocation } from './LocationFields';
import { validateListingDraft } from './listingDraft';
import { VisibilityPicker, type PostVisibility } from './VisibilityPicker';
import { CatTape, Field } from './ui';
import { useToast } from './Toast';
import { useCategories } from '@/queries/listings';
import { useCategoryTemplate } from '@/queries/templates';
import type { ListingPhotosController } from '@/queries/upload';
import type { Listing, ListingAttributes } from '@/api/db';
import { useOrgSlug } from '@/stores/auth';
import { C, F, shadow } from '@/theme';

/**
 * Form của một tin đăng, dùng chung cho ghim tin mới và sửa tin.
 *
 * Hai màn nhập ĐÚNG cùng một tập field vì chúng nói chuyện với cùng một schema của BE. Giữ hai
 * bản JSX song song thì lần thêm field sau chỉ sửa một bên, và bên còn lại lặng lẽ gửi thiếu.
 *
 * Form giữ state + luật hợp lệ, KHÔNG gọi mutation: submit đi ngược lên route qua `onSubmit`
 * (AGENTS §Kiến trúc — mutation chỉ khởi động từ `app/**`).
 */

type ListingFormValues = {
  title: string;
  /** Chuỗi thô từ `TextInput`; đổi sang số là việc của `client.ts`, không phải của form. */
  price: string;
  desc: string;
  categoryId: string;
  visibility: PostVisibility;
  location: ListingLocation;
  /** Thuộc tính động theo template của danh mục — rỗng khi danh mục chưa có field nào. */
  attributes: ListingAttributes;
  /**
   * Bản template của tin đang sửa. Chỉ form SỬA mới có — tin mới luôn dùng bản mới nhất.
   * Không gửi lên BE; nó chỉ quyết định form hỏi template nào.
   */
  templateVersion?: number;
};

/**
 * Tin đã lưu → giá trị điền sẵn cho form sửa.
 *
 * Đọc `priceValue` chứ không phải `price`: bản hiển thị đã qua `formatPrice`, và "Miễn phí"
 * thì không còn đường nào quay về `0`.
 */
export function listingToFormValues(listing: Listing): ListingFormValues {
  return {
    title: listing.title,
    price: String(listing.priceValue),
    desc: listing.desc,
    categoryId: listing.categoryId,
    visibility: listing.visibility,
    attributes: listing.attributes ?? {},
    templateVersion: listing.templateVersion,
    location: {
      province: listing.province ?? null,
      ward: listing.ward ?? null,
      address: listing.address ?? '',
    },
  };
}

export function ListingForm({
  photos,
  initial,
  submitLabel,
  busyLabel,
  busy,
  onSubmit,
}: {
  photos: ListingPhotosController;
  /**
   * Chỉ đọc ở lần mount đầu — dữ liệu về sau không ghi đè thứ người dùng đang gõ dở. Màn sửa
   * vì thế phải chờ tin tải xong rồi mới render form này.
   */
  initial?: ListingFormValues;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  onSubmit: (values: ListingFormValues) => void;
}) {
  const toast = useToast();
  const activeOrg = useOrgSlug();
  const { data: categories } = useCategories();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  // Giữ id chứ không giữ tên: BE nhận `categoryId` là ObjectId. Rỗng cho tới khi danh mục
  // tải xong hoặc người dùng chọn.
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  // Mặc định nội bộ: tin ở lại trong tổ chức cho tới khi người đăng chủ động đưa ra công khai.
  // Không thuộc tổ chức nào thì chỉ còn một lựa chọn, và nó đã đúng.
  const [visibility, setVisibility] = useState<PostVisibility>(
    initial?.visibility ?? (activeOrg ? 'org_internal' : 'public'),
  );
  // Tên tỉnh/xã, không phải mã — BE lưu và lọc bằng chính chuỗi này.
  const [location, setLocation] = useState<ListingLocation>(initial?.location ?? EMPTY_LOCATION);

  const [attributes, setAttributes] = useState<ListingAttributes>(initial?.attributes ?? {});

  /**
   * Ghim version của tin đang sửa — nhưng CHỈ khi danh mục chưa đổi.
   *
   * Đổi danh mục thì version cũ thuộc về một template khác hẳn; ghim nó là hỏi "bản 1 của
   * danh mục Xe cộ" bằng số version của danh mục Điện thoại. BE cũng ghim theo đúng luật này
   * lúc validate (`listing.service.update`), nên hai bên xét cùng một bộ field.
   */
  const pinnedVersion = categoryId === initial?.categoryId ? initial?.templateVersion : undefined;
  const { data: template } = useCategoryTemplate(categoryId, pinnedVersion);
  const attrFields = template?.fields ?? [];

  /**
   * Đổi danh mục là đổi cả template → thuộc tính cũ thuộc về một bộ field khác, phải xoá.
   *
   * Giữ lại thì form hiện `batteryHealth` của điện thoại trên một tin xe máy cho tới lúc BE
   * lặng lẽ loại nó — người dùng tưởng đã nhập, mà tin đăng ra thì không có.
   */
  const pickCategory = (id: string) => {
    setCategoryId(id);
    if (id !== categoryId) setAttributes({});
  };

  /* @keyframes pinPress — nút lún xuống rồi bật nhẹ lên */
  const press = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value }] }));

  // Khoá nút khi còn ảnh đang bay: ảnh chưa xong thì tin sẽ thiếu URL của nó
  const blocked = busy || photos.uploadingCount > 0;

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
      photoCount: photos.photoUrls.length,
      hasFailedPhoto: photos.hasFailed,
      location,
      // Chỉ field ĐANG HIỆN mới bị đòi: field bị `showIf` ẩn không phải là thứ người dùng bỏ sót.
      attrFields: visibleAttrFields(attrFields, attributes),
      attributes,
    });
    if (error) return toast(error);

    onSubmit({ title, price, desc, categoryId, visibility, location, attributes });
  };

  return (
    <>
      <PhotoPicker
        photos={photos.photos}
        onAdd={photos.addPhotos}
        onRemove={photos.removePhoto}
        onRetry={photos.retryPhoto}
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
            onPress={() => pickCategory(c.id)}
          />
        ))}
      </View>

      {/* Ngay dưới chip danh mục: field động là hệ quả trực tiếp của lựa chọn vừa rồi. */}
      <AttrFields fields={attrFields} values={attributes} onChange={setAttributes} />

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
            {busy
              ? busyLabel
              : photos.uploadingCount > 0
                ? `Đang tải ảnh (${photos.photos.length - photos.uploadingCount}/${photos.photos.length})...`
                : submitLabel}
          </Text>
        </Pressable>
      </Animated.View>
    </>
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
