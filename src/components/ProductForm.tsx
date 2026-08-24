import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminSwitch } from './AdminScreen';
import { AdminChip, adminFormStyles } from './AdminPicker';
import { Field, PinButton } from './ui';
import { EFFECT_LABEL } from '@/api/admin-system';
import type { AdminProduct, ProductDraft, ProductEffect } from '@/api/admin-system';
import { C, F } from '@/theme';

/**
 * Form gói tin — tách khỏi route vì route đã chạm trần LOC, và vì nó là form duy nhất trong app
 * có ba ô số cùng mang nghĩa "để trống = không có" (thời hạn / giờ chờ / giá).
 *
 * KHÔNG kiểm luật xuyên field ở đây ("đẩy tin thì không có thời hạn", "mở bán phải có giá"):
 * `productRuleErrors` bên BE là SoT, và nó trả về câu đọc được. Bản sao ở FE sẽ lệch vào đúng
 * ngày ai đó sửa một chỗ, mà lệch theo hướng tệ nhất — chặn một thao tác BE vẫn cho phép.
 */

const EFFECTS = Object.keys(EFFECT_LABEL) as ProductEffect[];

const EMPTY: ProductDraft = {
  code: '',
  name: '',
  description: '',
  effect: 'featured',
  durationDays: '',
  cooldownHours: '',
  price: '',
  enabled: false,
  order: '',
};

/**
 * Bản ghi BE → nháp form. Export vì màn danh sách cũng cần nó: bật/tắt bán là một lượt `PATCH`
 * mang TOÀN BỘ gói, và dựng lại phép đổi đó ở call-site là hai bản sao sẽ lệch nhau.
 */
export const toProductDraft = (product: AdminProduct): ProductDraft => ({
  code: product.code,
  name: product.name,
  description: product.description,
  effect: product.effect,
  durationDays: product.durationDays === null ? '' : String(product.durationDays),
  cooldownHours: product.cooldownHours === null ? '' : String(product.cooldownHours),
  price: product.price ? String(product.price.amount) : '',
  enabled: product.enabled,
  order: String(product.order),
});

export function ProductForm({
  editing,
  pending,
  onSubmit,
  onCancel,
}: {
  /** `null` = đang tạo mới. */
  editing: AdminProduct | null;
  pending: boolean;
  onSubmit: (draft: ProductDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(EMPTY);

  // Bấm "Sửa" ở một gói khác phải nạp lại form. `key` trên component thì cả panel nhấp nháy,
  // còn đây chỉ là một lần gán state — và nó cũng là chỗ duy nhất biết `editing` vừa đổi.
  useEffect(() => {
    setDraft(editing ? toProductDraft(editing) : EMPTY);
  }, [editing]);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <AdminPanel
      title={editing ? `Sửa gói "${editing.code}"` : 'Thêm gói tin'}
      note={editing ? 'mã gói giữ nguyên — sổ cái trỏ vào nó' : 'mã gói không sửa được về sau'}
    >
      {/* Mã gói chỉ nhập được một lần: sổ cái Xu tham chiếu gói bằng `code`, đổi nó là viết lại
          lịch sử giao dịch. BE cũng không nhận field này ở `PATCH`. */}
      {editing ? (
        <View style={styles.codeLocked}>
          <Text style={styles.codeLabel}>MÃ GÓI</Text>
          <Text style={styles.codeValue}>{editing.code}</Text>
        </View>
      ) : (
        <Field
          onDark
          label="Mã gói"
          value={draft.code}
          onChangeText={(v) => set('code', v)}
          placeholder="featured_7d"
          autoCapitalize="none"
        />
      )}

      <Field
        onDark
        label="Tên hiển thị"
        value={draft.name}
        onChangeText={(v) => set('name', v)}
        placeholder="Tin nổi bật 7 ngày"
      />
      <Field
        onDark
        label="Lời chào hàng"
        value={draft.description}
        onChangeText={(v) => set('description', v)}
        placeholder="Hiện lên đầu danh mục suốt một tuần"
        multiline
      />

      <Text style={adminFormStyles.label}>HIỆU ỨNG</Text>
      <View style={adminFormStyles.chips}>
        {EFFECTS.map((effect) => (
          <AdminChip
            key={effect}
            label={EFFECT_LABEL[effect]}
            on={draft.effect === effect}
            onPress={() => set('effect', effect)}
          />
        ))}
      </View>
      <Text style={adminFormStyles.hint}>
        Đẩy lên đầu là hiệu ứng tức thời — để trống thời hạn, dùng giờ chờ để chặn người mua liên
        tục chiếm đỉnh bảng. Hai hiệu ứng còn lại thì ngược lại: phải có thời hạn.
      </Text>

      {/* Ô cạnh nhau thì phải bọc View: prop `style` của `Field` đi thẳng vào `TextInput`, không
          phải khối bao — truyền `flex` vào đó thì hai ô vẫn xếp chồng như cũ. */}
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            onDark
            label="Thời hạn (ngày)"
            value={draft.durationDays}
            onChangeText={(v) => set('durationDays', v)}
            placeholder="7"
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.half}>
          <Field
            onDark
            label="Giờ chờ giữa 2 lượt"
            value={draft.cooldownHours}
            onChangeText={(v) => set('cooldownHours', v)}
            placeholder="24"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.pair}>
        <View style={styles.half}>
          <Field
            onDark
            label="Giá (Xu)"
            value={draft.price}
            onChangeText={(v) => set('price', v)}
            placeholder="Trống = chưa chốt"
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.half}>
          <Field
            onDark
            label="Thứ tự"
            value={draft.order}
            onChangeText={(v) => set('order', v)}
            placeholder="Nhỏ đứng trước"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.sell}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sellTitle}>Mở bán</Text>
          <Text style={styles.sellDesc}>
            Bật là gói hiện ngay trên catalog của người đăng tin. Chưa có giá thì BE từ chối bật.
          </Text>
        </View>
        <AdminSwitch value={draft.enabled} onChange={() => set('enabled', !draft.enabled)} />
      </View>

      <View style={adminFormStyles.formActs}>
        <PinButton
          label={editing ? 'Lưu thay đổi' : 'Thêm gói tin'}
          loading={pending}
          style={{ flex: 1 }}
          onPress={() => onSubmit(draft)}
        />
        {!!editing && (
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [adminFormStyles.cancel, pressed && { opacity: 0.7 }]}
          >
            <Text style={adminFormStyles.smallText}>Huỷ</Text>
          </Pressable>
        )}
      </View>
    </AdminPanel>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minWidth: 0 },
  codeLocked: { marginBottom: 14 },
  codeLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.3, color: C.deskTxtDim },
  codeValue: { fontFamily: F.monoBold, fontSize: 14, color: C.paper, marginTop: 6 },
  sell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  sellTitle: { fontFamily: F.uiBold, fontSize: 13, color: C.paper },
  sellDesc: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.deskTxtSoft, marginTop: 3 },
});
