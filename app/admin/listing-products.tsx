import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { ProductForm, toProductDraft } from '@/components/ProductForm';
import { EmptyState, Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAddProduct,
  useAdminProducts,
  useEditProduct,
  useRemoveProduct,
} from '@/queries/admin-system';
import { EFFECT_LABEL } from '@/api/admin-system';
import type { AdminProduct, ProductDraft } from '@/api/admin-system';
import { C, F } from '@/theme';

/**
 * Catalog gói tin — thứ master bán bằng Xu.
 *
 * Trước đây catalog nằm cứng trong `listing.pricing.ts` và đổi giá là một lần deploy; mảng đó
 * giờ chỉ còn là seed. Vòng đời của một gói là cờ `enabled` (nháp → mở bán → ngừng bán), KHÔNG
 * phải xoá: mỗi lượt mua chụp lại điều khoản gói vào sổ cái theo `code`, nên code phải còn chỗ
 * cho sổ cái trỏ về. Xoá cứng chỉ để dọn gói tạo nhầm, nên nó hỏi lại trước khi chạy.
 */
export default function AdminListingProducts() {
  const toast = useToast();
  const { data, error, isPending } = useAdminProducts();
  const add = useAddProduct();
  const edit = useEditProduct();
  const remove = useRemoveProduct();

  const [editing, setEditing] = useState<AdminProduct | null>(null);

  const rows = data ?? [];
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const submit = (draft: ProductDraft) => {
    const done = (verb: string) => ({
      onSuccess: (product: AdminProduct) => {
        setEditing(null);
        toast(`✓ Đã ${verb} gói "${product.name}"`);
      },
      onError: fail,
    });

    if (editing) return edit.mutate({ id: editing._id, draft }, done('cập nhật'));
    add.mutate(draft, done('thêm'));
  };

  /** Bật/tắt bán đi qua chính mutation sửa: nó là một field của gói, không phải thao tác riêng. */
  const toggleEnabled = (product: AdminProduct) =>
    edit.mutate(
      { id: product._id, draft: { ...toProductDraft(product), enabled: !product.enabled } },
      {
        // Nói lại đúng thứ BE vừa trả về: bật một gói chưa có giá bị BE từ chối, và lúc đó câu
        // "đã mở bán" sẽ là lời nói dối duy nhất người dùng nhìn thấy.
        onSuccess: (p) =>
          toast(p.enabled ? `✓ Đã mở bán "${p.name}"` : `✓ Đã ngừng bán "${p.name}"`),
        onError: fail,
      },
    );

  const confirmRemove = (product: AdminProduct) =>
    Alert.alert(
      'Xoá hẳn gói này?',
      `Chỉ xoá gói tạo nhầm. Gói đã từng bán thì "Ngừng bán" mới đúng — sổ cái Xu vẫn trỏ vào mã "${product.code}".`,
      [
        { text: 'Thôi', style: 'cancel' },
        {
          text: 'Xoá hẳn',
          style: 'destructive',
          onPress: () =>
            remove.mutate(product._id, {
              onSuccess: (gone) => {
                if (editing?._id === gone._id) setEditing(null);
                toast(`✓ Đã xoá gói "${gone.name}"`);
              },
              onError: fail,
            }),
        },
      ],
    );

  return (
    <AdminScreen title="Gói tin" note="master bán gì bằng Xu">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isPending ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState icon="🎟" onDark text="Catalog chưa có gói nào" />
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((product) => (
              <View key={product._id} style={[styles.card, !product.enabled && { opacity: 0.6 }]}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.name}>
                      {product.name}
                    </Text>
                    <Text style={styles.code}>{product.code.toUpperCase()}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: product.enabled ? C.okTint : C.mutedTint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: product.enabled ? C.okText : C.deskTxtDim },
                      ]}
                    >
                      {product.enabled ? 'ĐANG BÁN' : 'NHÁP'}
                    </Text>
                  </View>
                </View>

                {!!product.description && (
                  <Text numberOfLines={2} style={styles.desc}>
                    {product.description}
                  </Text>
                )}

                <Text style={styles.meta}>
                  {EFFECT_LABEL[product.effect].toUpperCase()}
                  {product.durationDays !== null && ` · ${product.durationDays} NGÀY`}
                  {product.cooldownHours !== null && ` · CHỜ ${product.cooldownHours}H`}
                  {' · '}
                  {/* Giá `null` không phải 0 Xu — nó là "chưa chốt giá", và là lý do BE chặn mở
                      bán. Hiện "0" ở đây là biến một câu hỏi còn ngỏ thành một cái giá. */}
                  <Text style={{ color: product.price ? C.paper : C.tape }}>
                    {product.price ? `${product.price.amount} XU` : 'CHƯA CÓ GIÁ'}
                  </Text>
                </Text>

                <View style={styles.acts}>
                  <AdminSmallBtn label="Sửa" onPress={() => setEditing(product)} />
                  <AdminSmallBtn
                    label={product.enabled ? 'Ngừng bán' : 'Mở bán'}
                    onPress={() => toggleEnabled(product)}
                  />
                  <AdminSmallBtn label="Xoá" onPress={() => confirmRemove(product)} />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={adminFormStyles.limit}>
          Sửa hay xoá một gói KHÔNG viết lại lịch sử: mỗi lượt mua đã chụp lại điều khoản tại
          thời điểm mua. Đổi lại, người đang giữ gói cũ vẫn chạy theo điều khoản cũ — bảng giá
          mới không có hiệu lực ngược.
        </Text>

        <View style={{ marginTop: 18 }}>
          <ProductForm
            editing={editing}
            pending={add.isPending || edit.isPending}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
          />
        </View>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  card: {
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    padding: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  code: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.deskTxtDim, marginTop: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.6 },
  desc: { fontFamily: F.ui, fontSize: 12, lineHeight: 18, color: C.deskTxtSoft, marginTop: 9 },
  meta: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim, marginTop: 9 },
  acts: { flexDirection: 'row', gap: 7, marginTop: 12 },
});
