import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ModListing } from '@/api/admin';
import { ListingPhoto } from './ListingPhoto';
import { StatusBadge } from './AdminListingRow';
import { C, F } from '@/theme';

/**
 * Chi tiết một tin. Prototype web đẩy ngăn này ra từ mép phải; trên điện thoại nó trượt từ
 * dưới lên — cùng vai trò, nhưng ngón cái với tới được nút ở đáy.
 *
 * Nhận `item = null` để đóng thay vì có prop `open` riêng: chỉ có một nguồn sự thật, không thể
 * rơi vào trạng thái "mở nhưng không có tin nào".
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
  onRemove: (item: ModListing) => void;
}) {
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      {!!item && (
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>Chi tiết tin đăng</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <ListingPhoto photo={item.photo} style={styles.photo} imageStyle={styles.photoRadius} />

            <View style={styles.tags}>
              <StatusBadge status={item.status} />
              <Text style={styles.id}>#{item.id}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{item.price}</Text>
            <Text style={styles.desc}>{item.desc}</Text>

            <View style={styles.dl}>
              <Row label="Người đăng" value={`${item.seller} · ${item.school}`} />
              <Row label="Danh mục" value={item.cat} />
              <Row label="Đăng lúc" value={`${item.at} trước`} />
              <Row label="Lượt xem" value={String(item.views)} mono />
              {!!item.reason && <Row label="Lý do từ chối" value={item.reason} bad />}
            </View>
          </ScrollView>

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
                <Text style={styles.btnText}>{item.status === 'hidden' ? 'Hiện lại' : 'Ẩn tin'}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => onRemove(item)}
              style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.btnDangerText}>Gỡ khỏi bảng</Text>
            </Pressable>
          </View>
        </SafeAreaView>
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
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: C.scrim },
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
});
