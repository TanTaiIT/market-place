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
import { NOTICE_AUDIENCES } from '@/api/admin-content';
import type { NoticeSender } from '@/api/admin-content';
import { C, F, shadow } from '@/theme';

/** Ba danh nghĩa gửi — icon và màu nền của huy hiệu phải khớp với màn Thông báo của học sinh. */
const SENDERS: { id: NoticeSender; icon: string; label: string; tag: string; bg: string }[] = [
  { id: 'org', icon: '🏫', label: 'Từ trường', tag: 'Từ trường', bg: C.mossDeep },
  { id: 'chain', icon: '🔗', label: 'Từ hệ thống', tag: 'Từ hệ thống', bg: C.inkSoft },
  { id: 'system', icon: '📌', label: 'Từ Ghim', tag: 'Từ Ghim', bg: C.pinDark },
];

/** Hermes không có Intl đầy đủ nên `toLocaleString` không tin được — chấm nghìn bằng tay. */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Soạn và gửi thông báo đẩy. Ô xem trước dựng lại đúng thẻ thông báo của app người dùng — gửi
 * đi là không rút lại được, nên người soạn phải thấy trước thứ 1.284 học sinh sắp nhận.
 */
export default function AdminNotice() {
  const toast = useToast();
  const send = useSendNotice();
  const { data: sent } = useSentNotices();

  const [sender, setSender] = useState<NoticeSender>('org');
  const [title, setTitle] = useState('Trường Hùng Vương');
  const [body, setBody] = useState('Hội chợ đồ cũ cuối kỳ diễn ra thứ 7 tuần này tại sân trường.');
  const [audienceId, setAudienceId] = useState(NOTICE_AUDIENCES[0].id);

  const meta = SENDERS.find((s) => s.id === sender) ?? SENDERS[0];

  const submit = () =>
    send.mutate(
      { sender, title, body, audienceId },
      {
        onSuccess: (notice) => toast(`Đã gửi thông báo tới ${group(notice.reach)} người`),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );

  return (
    <AdminScreen title="Gửi thông báo" note="nói với cả trường">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <AdminPanel title="Soạn thông báo">
            <Text style={styles.label}>GỬI VỚI DANH NGHĨA</Text>
            <View style={styles.pills}>
              {SENDERS.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSender(s.id)}
                  style={({ pressed }) => [
                    styles.pill,
                    s.id === sender && styles.pillOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.pillText, s.id === sender && { color: C.paper }]}>
                    {s.icon} {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ marginTop: 18 }}>
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

            <Text style={styles.label}>NGƯỜI NHẬN</Text>
            <View style={styles.pills}>
              {NOTICE_AUDIENCES.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setAudienceId(a.id)}
                  style={({ pressed }) => [
                    styles.pill,
                    a.id === audienceId && styles.pillOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.pillText, a.id === audienceId && { color: C.paper }]}>
                    {a.label} · {group(a.reach)}
                  </Text>
                </Pressable>
              ))}
            </View>

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
                  <View style={[styles.previewIcon, { backgroundColor: meta.bg }]}>
                    <Text style={{ fontSize: 15 }}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.previewTag}>
                      <Text style={styles.previewTagText}>{meta.tag}</Text>
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
                      {notice.title} <Text style={styles.sentAudience}>· {notice.audience}</Text>
                    </Text>
                    <Text style={styles.sentMeta}>
                      {notice.at} · {group(notice.reach)} người nhận
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
