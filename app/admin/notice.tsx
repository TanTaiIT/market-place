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
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { Field, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useSendNotice, useSentNotices } from '@/queries/admin-content';
import { useOrgUnits } from '@/queries/org';
import { C, F, shadow } from '@/theme';

/**
 * Soạn và gửi thông báo cho tổ chức đang hoạt động.
 *
 * Bản trước có ba "danh nghĩa gửi" (trường / hệ thống / Ghim) và ba nhóm người nhận kèm số
 * lượng — tất cả đều là fixture, BE không có khái niệm nào trong đó: `chain` đã bị xoá khỏi
 * hệ thống ở v2, và `POST /notifications` chỉ nhận `{ title, body, unitId }`.
 *
 * Thứ còn lại là thứ có thật: gửi cho cả tổ chức, hoặc gửi cho một nhóm con. Người chỉ phụ
 * trách một nhóm sẽ bị BE chặn nếu chọn "cả tổ chức" — nên ô đó vẫn hiện, để họ nhận được lời
 * từ chối rõ ràng thay vì không hiểu vì sao mình thiếu một lựa chọn.
 */
export default function AdminNotice() {
  const toast = useToast();
  const send = useSendNotice();
  const { data: sent } = useSentNotices();
  const { data: units } = useOrgUnits();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  /** `null` = cả tổ chức. */
  const [unitId, setUnitId] = useState<string | null>(null);

  const unitName = (id: string | null) => units?.find((u) => u.id === id)?.name ?? null;

  const submit = () =>
    send.mutate(
      { title, body, unitId },
      {
        onSuccess: () => {
          toast(unitId ? `Đã gửi cho nhóm ${unitName(unitId)}` : 'Đã gửi cho cả tổ chức');
          setTitle('');
          setBody('');
        },
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <AdminScreen title="Gửi thông báo" note="cả tổ chức, hoặc một nhóm">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <AdminPanel title="Soạn thông báo">
            <View>
              <Field onDark label="Tiêu đề" value={title} onChangeText={setTitle} />
            </View>

            <Text style={styles.label}>NỘI DUNG</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              placeholder="Viết nội dung thông báo..."
              placeholderTextColor={C.deskTxtDim}
              style={styles.textarea}
            />
            <Text style={styles.hint}>
              Viết ngắn, một ý. Học sinh đọc thông báo này trên điện thoại giữa giờ ra chơi.
            </Text>

            <Text style={styles.label}>GỬI CHO</Text>
            <View style={styles.pills}>
              <Pressable
                onPress={() => setUnitId(null)}
                style={({ pressed }) => [
                  styles.pill,
                  unitId === null && styles.pillOn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.pillText, unitId === null && { color: C.paper }]}>
                  🏫 Cả tổ chức
                </Text>
              </Pressable>
              {(units ?? []).map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setUnitId(u.id)}
                  style={({ pressed }) => [
                    styles.pill,
                    unitId === u.id && styles.pillOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.pillText, unitId === u.id && { color: C.paper }]}>
                    👥 {u.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              Không có &quot;số người nhận&quot;: thông báo là bản ghi của tổ chức, ai thuộc phạm
              vi thì đọc được. Con số duy nhất đo được là bao nhiêu người đã mở nó.
            </Text>

            <View style={{ marginTop: 18 }}>
              <PinButton label="Gửi ngay" loading={send.isPending} onPress={submit} />
            </View>
          </AdminPanel>

          <View style={{ marginTop: 16 }}>
            <AdminPanel title="Xem trước" note="trên máy học sinh">
              <View style={styles.frame}>
                <View style={styles.frameBar}>
                  <Text style={styles.frameBarText}>9:41</Text>
                  <Text style={styles.frameBarText}>Thông báo</Text>
                </View>
                <View style={styles.preview}>
                  <View style={[styles.previewIcon, { backgroundColor: C.mossDeep }]}>
                    <Text style={{ fontSize: 15 }}>{unitId ? '👥' : '🏫'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.previewTag}>
                      <Text style={styles.previewTagText}>
                        {unitId ? `Nhóm ${unitName(unitId) ?? ''}` : 'Toàn tổ chức'}
                      </Text>
                    </View>
                    <Text style={styles.previewTitle}>{title || 'Chưa có tiêu đề'}</Text>
                    <Text style={styles.previewBody}>
                      {body || 'Nội dung thông báo sẽ hiện ở đây.'}
                    </Text>
                    <Text style={styles.previewTime}>vừa xong</Text>
                  </View>
                </View>
              </View>
            </AdminPanel>
          </View>

          <View style={{ marginTop: 16 }}>
            <AdminPanel title="Đã gửi gần đây">
              {(sent ?? []).map((notice, i) => (
                <View key={notice.id} style={[styles.sentRow, i > 0 && styles.sentDivider]}>
                  <View style={styles.sentDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sentTitle}>
                      {notice.title}{' '}
                      <Text style={styles.sentAudience}>
                        · {unitName(notice.unitId) ?? 'cả tổ chức'}
                      </Text>
                    </Text>
                    <Text style={styles.sentMeta}>
                      {notice.at} · {notice.readCount} người đã đọc
                    </Text>
                  </View>
                </View>
              ))}
            </AdminPanel>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 40 },
  label: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: C.deskTxtDim,
    marginTop: 16,
    marginBottom: 8,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.desk,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
  },
  pillOn: { backgroundColor: C.deskHi, borderColor: C.cork },
  pillText: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxtSoft },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: 6,
    padding: 12,
    fontFamily: F.ui,
    fontSize: 13.5,
    lineHeight: 21,
    color: C.deskTxt,
    backgroundColor: C.desk,
  },
  hint: { fontFamily: F.ui, fontSize: 11.5, lineHeight: 17, color: C.deskTxtDim, marginTop: 7 },

  frame: { backgroundColor: C.paper, borderRadius: 10, padding: 13, ...shadow },
  frameBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  frameBarText: { fontFamily: F.monoBold, fontSize: 10, color: C.inkSoft, opacity: 0.6 },
  preview: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 13,
    ...shadow,
  },
  previewIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: C.mossLight,
    marginBottom: 5,
  },
  previewTagText: { fontFamily: F.uiBold, fontSize: 9.5, color: C.moss },
  previewTitle: { fontFamily: F.uiBold, fontSize: 13.5, lineHeight: 18, color: C.ink },
  previewBody: { fontFamily: F.ui, fontSize: 12, lineHeight: 18, color: C.inkSoft, marginTop: 4 },
  previewTime: { fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 6 },

  sentRow: { flexDirection: 'row', gap: 11, paddingVertical: 11 },
  sentDivider: { borderTopWidth: 1, borderTopColor: C.deskLine },
  sentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.mossBright, marginTop: 5 },
  sentTitle: { fontFamily: F.uiBold, fontSize: 12.5, lineHeight: 18, color: C.deskTxt },
  sentAudience: { fontFamily: F.ui, color: C.deskTxtSoft },
  sentMeta: { fontFamily: F.mono, fontSize: 10, color: C.deskTxtDim, marginTop: 4 },
});
