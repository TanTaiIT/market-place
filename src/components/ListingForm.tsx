import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { BoxField, FormSection } from './FormSection';
import { CategoryField } from './CategoryField';
import { useToast } from './Toast';
import { useCategoryTemplate } from '@/queries/templates';
import { useProfile } from '@/queries/listings';
import { MAX_PHOTOS, type ListingPhotosController } from '@/queries/upload';
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
  toGroup,
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
  /**
   * Đăng thẳng vào MỘT nhóm — người dùng đi từ trang hồ sơ nhóm, không phải từ nút đăng chung.
   *
   * Có nó thì hiển thị bị KHOÁ ở `org_internal` và bộ chọn hiển thị biến mất. Đây không phải
   * để cho gọn: `public` sẽ đưa tin sang hàng đợi của người phụ trách DANH MỤC, và quản trị
   * nhóm không có lấy một lượt duyệt nào (`routeListing`). Người bấm "Đăng tin" trên trang
   * một nhóm đang nói "gửi cho nhóm này duyệt" — để hở lựa chọn kia là phản bội đúng câu đó.
   */
  toGroup?: { slug: string; name: string };
  onSubmit: (values: ListingFormValues) => void;
}) {
  const toast = useToast();
  const activeOrg = useOrgSlug();
  const { data: profile } = useProfile();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  // Giữ id chứ không giữ tên: BE nhận `categoryId` là ObjectId. Rỗng cho tới khi danh mục
  // tải xong hoặc người dùng chọn.
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  // Mặc định nội bộ: tin ở lại trong tổ chức cho tới khi người đăng chủ động đưa ra công khai.
  // Không thuộc tổ chức nào thì chỉ còn một lựa chọn, và nó đã đúng.
  const [visibility, setVisibility] = useState<PostVisibility>(
    toGroup ? 'org_internal' : (initial?.visibility ?? (activeOrg ? 'org_internal' : 'public')),
  );
  /**
   * Tên tỉnh/xã, không phải mã — BE lưu và lọc bằng chính chuỗi này.
   *
   * Tin MỚI điền sẵn khu vực từ hồ sơ (`initial` vắng mặt = đang đăng mới). Đây là công dụng duy
   * nhất của khu vực riêng tư trong hồ sơ — nó KHÔNG khoá gì cả: người dùng sửa lại thoải mái,
   * vì bán món đồ ở chỗ khác nơi mình ở là chuyện thường.
   *
   * Đọc một lần lúc mount, không `useEffect` đồng bộ về sau: hồ sơ đã được `useValidateSession`
   * nạp vào cache từ lúc mở app nên hầu như luôn có sẵn ở đây. Ca hiếm còn lại — mở app rồi vào
   * ngay màn đăng tin trước khi hồ sơ về — chỉ là không điền sẵn, đúng như trước khi có tính năng.
   */
  const [location, setLocation] = useState<ListingLocation>(
    initial?.location ??
      (profile
        ? { province: profile.province ?? null, ward: profile.ward ?? null, address: '' }
        : EMPTY_LOCATION),
  );

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
      {/* `flex: 1` BẮT BUỘC: trong cột flex của RN con mặc định không co, nên ScrollView
          không có nó sẽ lấy chiều cao theo NỘI DUNG. Form Xe cộ 17 field vượt màn hình là
          thanh nút dính đáy bị đẩy ra ngoài vùng nhìn thấy — nút gửi thành không bấm được. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Tờ giấy ghim lên bảng bần — cùng ẩn dụ với NoteCard. Không chỉ để đẹp: mọi màu
            chữ của form được chọn cho nền giấy, đặt thẳng lên bần (#B98851) thì nhãn chỉ còn
            tương phản 2.48:1, dưới xa ngưỡng 4.5:1. Trên giấy nó lên 7.3:1. */}
        <View style={styles.sheet}>
          <CategoryField value={categoryId} onChange={pickCategory} autoOpen={!initial} />

          {/*
            Điều kiện là chính categoryId, không phải một state "bước 1 / bước 2" riêng: form
            SỬA luôn có sẵn danh mục nên vào thẳng phần nhập, không qua một bước chọn thừa.
          */}
          {!!categoryId && (
            <>
              <FormSection
                step={1}
                title="Hình ảnh sản phẩm"
                hint={`Thêm tối đa ${MAX_PHOTOS} ảnh — ảnh đầu tiên là ảnh bìa`}
              />
              <PhotoPicker
                photos={photos.photos}
                onAdd={photos.addPhotos}
                onRemove={photos.removePhoto}
                onRetry={photos.retryPhoto}
              />

              <FormSection
                step={2}
                title="Chi tiết tin đăng"
                hint="Điền càng đúng, người mua càng dễ tìm thấy tin."
              />
              <BoxField
                label="Tiêu đề tin đăng"
                value={title}
                onChangeText={setTitle}
                placeholder="Ví dụ: Xe đạp thể thao Giant, còn mới"
              />
              <BoxField
                label="Mức giá"
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                keyboardType="number-pad"
                suffix="đ"
              />

              {/* Field động của đúng danh mục vừa chọn — vẫn trong nhóm "Chi tiết". */}
              <AttrFields fields={attrFields} values={attributes} onChange={setAttributes} />

              <FormSection step={3} title="Mô tả" />
              <BoxField
                label="Nói thêm về món đồ"
                value={desc}
                onChangeText={setDesc}
                placeholder="Tình trạng, lý do bán, ghi chú thêm..."
                multiline
                style={styles.descInput}
              />

              <FormSection step={4} title={toGroup ? 'Khu vực' : 'Khu vực & hiển thị'} />
              {toGroup ? (
                <View style={styles.toGroup}>
                  <Text style={styles.toGroupLabel}>ĐĂNG VÀO NHÓM</Text>
                  <Text style={styles.toGroupName}>{toGroup.name}</Text>
                  <Text style={styles.toGroupHint}>
                    Quản trị nhóm sẽ duyệt tin này. Tin chỉ hiện trong nhóm.
                  </Text>
                </View>
              ) : (
                <VisibilityPicker value={visibility} onChange={setVisibility} />
              )}
              <LocationFields value={location} onChange={setLocation} />
            </>
          )}
        </View>
      </ScrollView>

      {/*
        Nút chính DÍNH ĐÁY, không cuộn theo nội dung.

        Form dài tới 17 field ở danh mục Xe cộ. Nút nằm cuối trang nghĩa là muốn bấm phải cuộn
        hết mọi thứ, và suốt lúc điền người dùng không nhìn thấy hành động chính. Chỉ hiện khi
        đã chọn danh mục: chưa chọn thì chưa có gì để gửi.
      */}
      {!!categoryId && (
        <View style={styles.bar}>
          {/* Hiệu ứng lún áp lên riêng NÚT, không lên cả thanh: thanh trượt xuống sẽ hở ra nội
              dung đang cuộn phía dưới ở mép đáy. */}
          <Animated.View style={pressStyle}>
            <Pressable
              onPress={submit}
              disabled={blocked}
              style={[styles.submit, blocked && { opacity: 0.6 }]}
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
        </View>
      )}
    </>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 24 },
  sheet: {
    backgroundColor: C.paperWarm,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 22,
    ...shadow,
  },
  descInput: { minHeight: 84, textAlignVertical: 'top', lineHeight: 22, fontFamily: F.ui },
  toGroup: {
    backgroundColor: C.mossLight,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: C.moss,
    marginBottom: 14,
  },
  toGroupLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.moss },
  toGroupName: { fontFamily: F.uiBold, fontSize: 15, color: C.ink, marginTop: 5 },
  toGroupHint: { fontFamily: F.ui, fontSize: 12, lineHeight: 18, color: C.inkSoft, marginTop: 5 },
  // Nền đục + viền trên: nội dung cuộn qua bên dưới phải bị che hẳn, nếu không chữ sẽ chạy
  // lẫn vào nút và trông như lỗi render.
  bar: {
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  submit: {
    backgroundColor: C.pin,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow,
  },
  submitText: { color: '#fff', fontFamily: F.uiBlack, fontSize: 15.5 },
});
