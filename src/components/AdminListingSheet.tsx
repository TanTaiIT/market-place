import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ModListing } from '@/api/admin';
import { ListingPhoto } from './ListingPhoto';
import { StatusBadge } from './AdminListingRow';
import { C, F } from '@/theme';

/**
 * Lý do gỡ hẳn một tin ĐÃ lên bảng — khác `REJECT_REASONS` của bàn duyệt (tin chưa lên). BE ghi
 * nguyên câu vào thông báo cho người bán và dòng nhật ký, nên mỗi câu phải đọc được từ phía họ.
 */
const REMOVE_REASONS = [
  'Nghi ngờ lừa đảo',
  'Hàng không được phép bán',
  'Giá hoặc mô tả sai sự thật',
  'Tin trùng lặp',
  'Người bán yêu cầu gỡ',
];

/**
 * Chi tiết một tin. Prototype web đẩy ngăn này ra từ mép phải; trên điện thoại nó trượt từ
 * dưới lên — cùng vai trò, nhưng ngón cái với tới được nút ở đáy.
 *
 * Nhận `item = null` để đóng thay vì có prop `open` riêng: chỉ có một nguồn sự thật, không thể
 * rơi vào trạng thái "mở nhưng không có tin nào".
 *
 * "Gỡ khỏi bảng" đi HAI nhịp: bấm nút rồi chọn lý do. Trước đây là một nhịp không xác nhận cho
 * một thao tác không rút lại được — và không có chỗ nào để nói lý do, nên người bán chỉ nhận
 * "không còn trên bảng tin". Vẫn có lối "không nêu lý do" cho ca vội.
 */
export function AdminListingSheet({
  item,
  onClose,
  onApprove,
  onToggleHide,
  onRemove,
}: {
  item: ModListing | null;
  onClose: () => void;
  onApprove: (item: ModListing) => void;
  onToggleHide: (item: ModListing) => void;
  onRemove: (item: ModListing, reason?: string) => void;
}) {
  /*
   * `useSafeAreaInsets()` chứ KHÔNG `<SafeAreaView>` — bên trong `<Modal>` thì component đó
   * không chừa được lề an toàn (xem ghi chú ở chỗ dùng bên dưới).
   */
  const insets = useSafeAreaInsets();

  const [asking, setAsking] = useState(false);
  // Mở tin khác (hoặc đóng) là quay về nhịp một — bước chọn lý do không được dính từ tin trước.
  useEffect(() => setAsking(false), [item?.id]);

  return (
    /*
      `fade` chứ KHÔNG `slide`: `animationType` trượt TOÀN BỘ nội dung Modal, mà nền mờ nằm bên
      trong nên nó trượt lên theo — thành một mảng xám chạy lên giữa màn hình, đúng thứ nhìn rất
      xấu. Để Modal lo phần hiện nền mờ, còn cú trượt do chính tấm sheet làm bằng `entering`.
    */
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      {!!item && (
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={[styles.sheet, { paddingBottom: insets.bottom }]}
        >
          <View style={styles.head}>
            <Text style={styles.headTitle}>Chi tiết tin đăng</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <ListingPhoto
              photo={item.photo}
              photoUrl={item.photoUrl}
              style={styles.photo}
              imageStyle={styles.photoRadius}
            />

            <View style={styles.tags}>
              <StatusBadge status={item.status} />
              <Text style={styles.id}>#{item.id}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{item.price}</Text>
            <Text style={styles.desc}>{item.desc}</Text>

            <View style={styles.dl}>
              <Row label="Người đăng" value={item.seller} />
              <Row label="Danh mục" value={item.cat} />
              <Row label="Đăng lúc" value={item.at} />
              <Row label="Lượt xem" value={String(item.views)} mono />
              {!!item.reason && <Row label="Lý do từ chối" value={item.reason} bad />}
            </View>
          </ScrollView>

          {asking ? (
            <Animated.View entering={FadeInDown.duration(160)} style={styles.reasons}>
              <Text style={styles.reasonsTitle}>Gỡ vì lý do gì? Người bán sẽ đọc đúng dòng này.</Text>
              <View style={styles.reasonRow}>
                {REMOVE_REASONS.map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => onRemove(item, reason)}
                    style={({ pressed }) => [styles.tag, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.tagText}>{reason}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => onRemove(item)}
                  style={({ pressed }) => [styles.tag, styles.tagMuted, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.tagText, { color: C.deskTxtDim }]}>Không nêu lý do</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setAsking(false)} hitSlop={8} style={styles.back}>
                <Text style={styles.backText}>← Quay lại</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.foot}>
              {item.status === 'pending' ? (
                <Pressable
                  onPress={() => onApprove(item)}
                  style={({ pressed }) => [styles.btn, styles.btnOk, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.btnOkText}>📌 Ghim lên bảng</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => onToggleHide(item)}
                  style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.btnText}>
                    {item.status === 'hidden' ? 'Hiện lại' : 'Ẩn tin'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setAsking(true)}
                style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.btnDangerText}>Gỡ khỏi bảng</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  mono,
  bad,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bad?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: F.mono }, bad && { color: C.badText }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: C.deskPanel,
    borderTopWidth: 1,
    borderTopColor: C.deskLineStrong,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  headTitle: { flex: 1, fontFamily: F.uiBold, fontSize: 14, color: C.paper },
  close: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.deskRaise,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 12, color: C.deskTxt },

  body: { padding: 18 },
  photo: { height: 150, borderRadius: 10 },
  photoRadius: { borderRadius: 10 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  id: { fontFamily: F.mono, fontSize: 10, color: C.deskTxtDim },
  title: { fontFamily: F.uiBlack, fontSize: 18, lineHeight: 24, color: C.paper, marginTop: 9 },
  price: { fontFamily: F.monoBold, fontSize: 17, color: C.tape, marginTop: 6 },
  desc: { fontFamily: F.ui, fontSize: 13, lineHeight: 21, color: C.deskTxtSoft, marginTop: 12 },

  dl: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.deskLine },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  rowLabel: {
    width: 104,
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: C.deskTxtDim,
    paddingTop: 2,
  },
  rowValue: { flex: 1, fontFamily: F.ui, fontSize: 12.5, lineHeight: 19, color: C.deskTxt },

  foot: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: C.deskLine,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  btnText: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxt },
  btnOk: { backgroundColor: C.mossBright, borderColor: C.mossBright },
  btnOkText: { fontFamily: F.uiBold, fontSize: 13, color: C.desk },
  btnDanger: { backgroundColor: C.pin, borderColor: C.pin },
  btnDangerText: { fontFamily: F.uiBold, fontSize: 13, color: C.paperWarm },

  reasons: {
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: C.deskLine,
    gap: 10,
  },
  reasonsTitle: { fontFamily: F.uiBold, fontSize: 12.5, color: C.paper },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  tagMuted: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  tagText: { fontFamily: F.ui, fontSize: 12, color: C.deskTxt },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: F.ui, fontSize: 12.5, color: C.deskTxtDim },
});
