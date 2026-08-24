import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { EmptyState, Field, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useAddBannedPhrase,
  useBannedPhrases,
  useRemoveBannedPhrase,
} from '@/queries/admin-system';
import { C, F } from '@/theme';

/**
 * Cụm từ cấm — **lớp chặn đầu tiên** của cổng nội dung.
 *
 * Khác mọi màn quản trị khác ở một điểm quyết định cách trình bày: nó không có hàng đợi, không
 * có nút duyệt. Thêm một cụm là luật áp NGAY cho lượt đăng kế tiếp, và tin dính cụm không bị
 * trả lỗi 400 mà thành `rejected` thật — tức là nó cũng cộng vào bộ đếm từ chối 7 ngày và tự
 * khoá quyền đăng của người đó sau 3 lần. Vì thế mỗi dòng ở đây nặng hơn vẻ ngoài của nó.
 *
 * Không có sửa, chỉ thêm và gỡ: một cụm sửa được là một cụm có thể âm thầm rộng ra
 * ("cần" thay cho "cần sa") mà không để lại vết nào trong danh sách.
 */
export default function AdminBannedPhrases() {
  const toast = useToast();
  const { data, error, isPending } = useBannedPhrases();
  const add = useAddBannedPhrase();
  const remove = useRemoveBannedPhrase();

  const [phrase, setPhrase] = useState('');

  const rows = data ?? [];
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const submit = () =>
    add.mutate(phrase, {
      onSuccess: (row) => {
        setPhrase('');
        toast(`✓ Đã cấm "${row.phrase}"`);
      },
      onError: fail,
    });

  const confirmRemove = (id: string, text: string) =>
    Alert.alert('Gỡ cụm cấm?', `Tin chứa "${text}" sẽ lại qua được cổng nội dung.`, [
      { text: 'Thôi', style: 'cancel' },
      {
        text: 'Gỡ',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: (gone) => toast(`✓ Đã gỡ "${gone}"`),
            onError: fail,
          }),
      },
    ]);

  return (
    <AdminScreen title="Cụm từ cấm" note="cổng chặn trước mọi thứ khác">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isPending ? (
          <Loading onDark />
        ) : error ? (
          <EmptyState icon="📡" onDark text={(error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState icon="🚫" onDark text="Chưa có cụm nào bị cấm" />
        ) : (
          <View style={{ gap: 8 }}>
            {rows.map((row) => (
              <View key={row.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.phrase}>{row.phrase}</Text>
                  <Text style={styles.meta}>THÊM {row.at.toUpperCase()}</Text>
                </View>
                <AdminSmallBtn label="Gỡ" onPress={() => confirmRemove(row.id, row.phrase)} />
              </View>
            ))}
          </View>
        )}

        <Text style={adminFormStyles.limit}>
          Chỉ nhận CỤM ít nhập nhằng. Một từ đơn như “súng” sẽ chém oan cả “súng phun nước đồ
          chơi”, và người bị chém không thấy nút nào để kêu — tin của họ đã bị từ chối xong.
        </Text>

        <View style={{ marginTop: 18 }}>
          <AdminPanel title="Thêm cụm cấm" note="áp ngay cho lượt đăng kế tiếp">
            <Field
              onDark
              label="Cụm bị cấm"
              value={phrase}
              onChangeText={setPhrase}
              placeholder="Ví dụ: giấy tờ giả"
              autoCapitalize="none"
              maxLength={80}
              onSubmitEditing={submit}
            />
            <View style={adminFormStyles.formActs}>
              <PinButton
                label="Thêm vào danh sách cấm"
                loading={add.isPending}
                style={{ flex: 1 }}
                onPress={submit}
              />
            </View>
          </AdminPanel>
        </View>
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  phrase: { fontFamily: F.uiBold, fontSize: 13.5, color: C.paper },
  meta: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.5, color: C.deskTxtDim, marginTop: 4 },
});
