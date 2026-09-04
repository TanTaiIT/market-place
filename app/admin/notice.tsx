import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { C, F, shadow } from '@/theme';

/**
 * Soạn và gửi thông báo cho tổ chức đang hoạt động.
 *
 * Bản trước có ba "danh nghĩa gửi" (trường / hệ thống / Ghim) và ba nhóm người nhận kèm số
 * lượng — tất cả đều là fixture, BE không có khái niệm nào trong đó: `chain` đã bị xoá khỏi
 * hệ thống ở v2, và `POST /notifications` chỉ nhận `{ title, body, unitId }`.
 *
 * Giờ chỉ còn một người nhận: CẢ tổ chức. Bề mặt nhóm con đã gỡ nên không có đường nào chọn ra
 * một nhóm để gửi riêng — `unitId` vì thế luôn gửi `null`. BE vẫn nhận field đó, nên mở lại
 * lựa chọn chỉ là dựng lại ô chọn ở đây.
 */
export default function AdminNotice() {
  const toast = useToast();
  const send = useSendNotice();
  const { data: sent } = useSentNotices();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const submit = () =>
    send.mutate(
      { title, body, unitId: null },
      {
        onSuccess: () => {
          toast('Đã gửi cho cả tổ chức');
          setTitle('');
          setBody('');
        },
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <AdminScreen title="Gửi thông báo" note="cho cả tổ chức" org>
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
                    <Text style={{ fontSize: 15 }}>🏫</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.previewTag}>
                      <Text style={styles.previewTagText}>
                        Toàn tổ chức
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
                      {/* Chỉ nói CÓ thuộc nhóm con hay không, không nói tên: bề mặt nhóm con đã
                          gỡ nên không còn đường tra tên, mà thông báo cũ thì vẫn giữ `unitId`
                          thật — bịa "cả tổ chức" cho chúng là nói sai phạm vi đã gửi. */}
                      <Text style={styles.sentAudience}>
                        · {notice.unitId ? 'một nhóm con' : 'cả tổ chức'}
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
