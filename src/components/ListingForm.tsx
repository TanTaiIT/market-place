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
import { listingDraftGaps, type ListingFormValues } from './listingDraft';
import {
  ListingReachField,
  defaultPick,
  usePostGroups,
  type PostGroup,
  type ReachPick,
} from './ListingReach';
import { BoxField, FormSection } from './FormSection';
import { ListingPriceFields } from './ListingPriceFields';
import { CategoryField } from './CategoryField';
import { useToast } from './Toast';
import { useCategoryTemplate } from '@/queries/templates';
import { useProfile } from '@/queries/listings';
import { MAX_PHOTOS, type ListingPhotosController } from '@/queries/upload';
import type { ListingAttributes } from '@/api/db';
import { C, F, S, shadow } from '@/theme';

/**
 * Form của một tin đăng, dùng chung cho ghim tin mới và sửa tin.
 *
 * Hai màn nhập ĐÚNG cùng một tập field vì chúng nói chuyện với cùng một schema của BE. Giữ hai
 * bản JSX song song thì lần thêm field sau chỉ sửa một bên, và bên còn lại lặng lẽ gửi thiếu.
 *
 * Form giữ state + luật hợp lệ, KHÔNG gọi mutation: submit đi ngược lên route qua `onSubmit`
 * (AGENTS §Kiến trúc — mutation chỉ khởi động từ `app/**`).
 */

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
  /** Đăng thẳng vào MỘT nhóm — đi từ hồ sơ nhóm. Khoá NHÓM, không khoá bậc (`usePostGroups`). */
  toGroup?: PostGroup;
  onSubmit: (values: ListingFormValues) => void;
}) {
  const toast = useToast();
  const { data: profile } = useProfile();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [desc, setDesc] = useState(initial?.desc ?? '');
  // Giữ id chứ không giữ tên: BE nhận `categoryId` là ObjectId. Rỗng cho tới khi danh mục
  // tải xong hoặc người dùng chọn.
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [canDeliver, setCanDeliver] = useState(initial?.canDeliver ?? false);
  /**
   * Bậc phủ sóng: SUY RA cho tới khi người dùng chạm vào, chứ không giữ trong state ngay.
   *
   * Mặc định phụ thuộc danh sách nhóm, mà danh sách đó về sau lúc mount. Giữ state rồi đồng bộ
   * bằng `useEffect` là đúng cái `set-state-in-effect` oxlint chặn — và tệ hơn, nó có thể ghi
   * đè lựa chọn người dùng vừa bấm. `null` nghĩa là "chưa chạm", nên giá trị hiện ra tự đúng
   * lên khi nhóm về. Bấm gửi trước lúc đó thì tin lên sàn — phía an toàn, không lộ nhóm nào.
   */
  const groups = usePostGroups(toGroup);
  const [picked, setPicked] = useState<ReachPick | null>(null);
  const pick: ReachPick = picked ?? defaultPick(groups);
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

  /*
   * Tính MỘT lần mỗi lượt render, dùng cho cả dòng "còn thiếu" ở chân form lẫn lượt kiểm khi
   * bấm gửi. Hàm thuần trên state đang có, không query gì — rẻ hơn hẳn việc giữ thêm một
   * state song song rồi phải nhớ đồng bộ nó ở mọi `onChange`.
   */
  const gaps = listingDraftGaps({
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
    needsGroup: pick.reach !== 'marketplace' && !pick.orgId,
    // `initial` = đang SỬA. Khu vực lúc đó đã khoá, nên nó không còn là chỗ người dùng "còn thiếu".
    areaLocked: Boolean(initial),
  });

  const submit = () => {
    press.value = withSequence(
      withTiming(6, { duration: 140 }),
      withSpring(-3, { damping: 6 }),
      withSpring(0),
    );

    /*
     * Vẫn CHO BẤM khi còn thiếu, và hiện câu giải thích của ô đầu tiên.
     *
     * Khoá nút lại thì dòng "còn thiếu" ở trên chỉ nêu TÊN ô, không nói được vì sao — mà lý do
     * mới là thứ người dùng cần với những ô không hiển nhiên ("mô tả cần ít nhất 10 ký tự").
     * Bấm để nghe giải thích là đường duy nhất còn lại để hỏi.
     */
    const error = gaps[0]?.message ?? null;
    if (error) return toast(error);

    // `...pick` rải đúng hai khoá `reach` + `orgId` — chúng đi liền nhau nên tách ra hai
    // dòng chỉ mở chỗ cho một bên được cập nhật mà bên kia quên.
    onSubmit({ title, price, desc, categoryId, canDeliver, ...pick, location, attributes });
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
        {/*
          MỖI MỤC MỘT THẺ, không phải một tờ giấy dài.

          Form này có tới 17 field ở danh mục Xe cộ. Gộp hết vào một thẻ thì ranh giới giữa
          "ảnh", "chi tiết", "mô tả", "khu vực" chỉ còn là mấy dòng tiêu đề trôi giữa một cột
          ô nhập giống hệt nhau — cuộn tới giữa form là không còn biết mình đang ở mục nào.

          Khe hở giữa các thẻ để lộ nền `C.paper`, và chính nó là đường phân chia — nên thẻ
          không cần viền. Cùng cách trang chi tiết đang chia khối.
        */}
        <CategoryField value={categoryId} onChange={pickCategory} autoOpen={!initial} />

        {/*
          Điều kiện là chính categoryId, không phải một state "bước 1 / bước 2" riêng: form
          SỬA luôn có sẵn danh mục nên vào thẳng phần nhập, không qua một bước chọn thừa.
        */}
        {!!categoryId && (
            <>
              <View style={styles.card}>
              <FormSection
                flush
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
              </View>

              <View style={styles.card}>
              <FormSection
                flush
                step={2}
                title="Chi tiết tin đăng"
                hint="Điền càng đúng, người mua càng dễ tìm thấy tin."
              />
              {/* Trần 150 khớp `createListingSchema` của BE (`title: max(150)`) — người gõ
                  chạm trần ở đây thay vì gõ xong cả form rồi ăn 400. */}
              <BoxField
                label="Tiêu đề tin đăng"
                value={title}
                onChangeText={setTitle}
                placeholder="Ví dụ: Xe đạp thể thao Giant, còn mới"
                maxLength={150}
                counter
              />
              <ListingPriceFields
                price={price}
                onPrice={setPrice}
                canDeliver={canDeliver}
                onCanDeliver={setCanDeliver}
              />

              {/* Field động của đúng danh mục vừa chọn — vẫn trong nhóm "Chi tiết". */}
              <AttrFields fields={attrFields} values={attributes} onChange={setAttributes} />
              </View>

              <View style={styles.card}>
              <FormSection flush step={3} title="Mô tả" />
              {/* Khớp `description: max(5000)` của BE, cùng lý do với tiêu đề. */}
              <BoxField
                label="Nói thêm về món đồ"
                value={desc}
                onChangeText={setDesc}
                placeholder="Tình trạng, lý do bán, ghi chú thêm..."
                multiline
                maxLength={5000}
                counter
                style={styles.descInput}
              />
              </View>

              <View style={styles.card}>
              <FormSection flush step={4} title="Khu vực & hiển thị" />
              {/* Form SỬA không bày thang: BE từ chối `reach` ở `PATCH` (nâng bậc = đổi bàn
                  duyệt), nên một ô chọn ở đây chỉ hứa suông rồi nuốt lựa chọn của người dùng. */}
              {initial ? null : (
                <ListingReachField
                  value={pick}
                  groups={groups}
                  locked={toGroup}
                  onChange={setPicked}
                />
              )}
              {/* Cùng lý do với thang `reach` ngay trên: BE từ chối tỉnh/phường ở `PATCH`, nên
                  bày ô chọn khi SỬA là nuốt lựa chọn của người dùng. Số nhà vẫn sửa được. */}
              <LocationFields value={location} lockArea={Boolean(initial)} onChange={setLocation} />
              </View>
            </>
          )}
      </ScrollView>

      {/*
        Nút chính DÍNH ĐÁY, không cuộn theo nội dung.

        Form dài tới 17 field ở danh mục Xe cộ. Nút nằm cuối trang nghĩa là muốn bấm phải cuộn
        hết mọi thứ, và suốt lúc điền người dùng không nhìn thấy hành động chính. Chỉ hiện khi
        đã chọn danh mục: chưa chọn thì chưa có gì để gửi.
      */}
      {!!categoryId && (
        <View style={styles.bar}>
          {/*
            Liệt kê những ô còn thiếu, NGAY TRÊN nút.

            Trước đây người đăng chỉ biết mình thiếu gì sau khi bấm gửi, và mỗi lượt bấm lộ ra
            đúng MỘT lỗi — form Xe cộ 17 field thì đó là bấm năm lần để biết năm việc. Dòng này
            đọc từ cùng một nguồn luật với lúc bấm (`listingDraftGaps`) nên hai bên không thể
            lệch nhau.

            Cắt ở ba mục: quá đó thì dòng tràn hai hàng và đẩy nút xuống, mà người còn thiếu bảy
            ô cũng không đọc hết bảy cái tên — họ cần biết "còn nhiều", không cần bản kiểm kê.
          */}
          {gaps.length > 0 && (
            <Text numberOfLines={2} style={styles.gaps}>
              Còn thiếu {gaps.slice(0, 3).map((g) => g.label).join(', ')}
              {gaps.length > 3 ? `, và ${gaps.length - 3} mục nữa` : ''}
            </Text>
          )}

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
  /** `gap` là khe hở giữa các thẻ — chính nó để lộ nền và làm đường phân chia giữa các mục. */
  /*
   * `gap` là khe hở giữa các thẻ — chính nó để lộ nền và làm đường phân chia giữa các mục.
   * Bám thang `S` như `FormSection`: hai file cùng vẽ một form, lệch thang là lệch nhịp.
   */
  scroll: {
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
    paddingBottom: S.xl,
    gap: S.md,
  },
  card: {
    backgroundColor: C.paperWarm,
    borderRadius: 12,
    paddingHorizontal: S.lg,
    paddingVertical: S.lg,
    ...shadow,
  },
  descInput: { minHeight: 96, textAlignVertical: 'top', lineHeight: 22, fontFamily: F.ui },
  // Nền đục + viền trên: nội dung cuộn qua bên dưới phải bị che hẳn, nếu không chữ sẽ chạy
  // lẫn vào nút và trông như lỗi render.
  /** Nhắc việc còn thiếu — canh giữa, ngay trên nút, cùng nhịp với `missing` của bản dựng. */
  gaps: {
    fontFamily: F.ui,
    fontSize: 12,
    color: C.inkSoft,
    textAlign: 'center',
    marginBottom: S.md,
  },
  bar: {
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: S.lg,
    paddingTop: S.md,
    paddingBottom: S.lg,
  },
  submit: {
    backgroundColor: C.pin,
    borderRadius: 12,
    paddingVertical: S.lg,
    alignItems: 'center',
    ...shadow,
  },
  submitText: { color: '#fff', fontFamily: F.uiBlack, fontSize: 15.5 },
});
