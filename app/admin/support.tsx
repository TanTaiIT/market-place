import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useReplySupport,
  useSupportQueue,
  useSupportThreadDetail,
} from '@/queries/support';
import { relativeTime } from '@/api/client';
import { C, F, R } from '@/theme';

/**
 * Hàng đợi hỗ trợ — master đọc và trả lời tin của người dùng.
 *
 * Một màn hai tầng (danh sách → luồng) thay vì hai route: master xử lý theo lô, và mỗi lần
 * quay lại danh sách qua điều hướng là một lần mất vị trí cuộn cùng một lượt tải lại.
 *
 * Mở một luồng là thao tác GHI ở BE (đánh dấu đã xem) — nó rời hàng đợi ngay cả khi master
 * chưa trả lời. Đúng ý: "đã đọc" là một trạng thái thật, và một luồng đọc rồi mà vẫn nằm
 * trong danh sách việc-chưa-làm sẽ khiến master đọc lại nó mỗi lần mở màn.
 */
const FILTERS = [
  { value: 'waiting', label: 'Đang chờ' },
  { value: 'all', label: 'Tất cả' },
];

export default function AdminSupport() {
  const toast = useToast();
  const [filter, setFilter] = useState('waiting');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const queue = useSupportQueue(filter === 'waiting');
  const thread = useSupportThreadDetail(openId);
  const reply = useReplySupport();

  const body = draft.trim();

  const submit = () => {
    if (!openId || body.length < 5 || reply.isPending) return;
    reply.mutate(
      { id: openId, body },
      {
        onSuccess: () => {
          setDraft('');
          toast('✓ Đã gửi câu trả lời');
        },
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );
  };

  /* ── Tầng 2: một luồng ───────────────────────────────────────── */
  if (openId) {
    return (
      <AdminScreen title="Luồng hỗ trợ" note="trả lời người dùng">
        <Pressable onPress={() => setOpenId(null)} style={styles.back}>
          <Text style={styles.backText}>← Về hàng đợi</Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {thread.isPending ? (
            <Loading onDark />
          ) : thread.error ? (
            <EmptyState icon="📡" onDark text={(thread.error as Error).message} />
          ) : (
            <>
              <AdminPanel title={thread.data?.userName ?? 'Người dùng'}>
                <View style={{ gap: 8 }}>
                  {thread.data?.messages.map((m) => (
                    <View
                      // Khoá là `at` — xem ghi chú ở `SupportFab`.
                      key={m.at}
                      style={[styles.bubble, m.from === 'master' ? styles.mine : styles.theirs]}
                    >
                      <Text style={styles.who}>
                        {m.from === 'master' ? 'Đội ngũ Ghim' : thread.data?.userName}
                        {' · '}
                        {relativeTime(m.at)}
                      </Text>
                      <Text style={styles.msg}>{m.body}</Text>
                    </View>
                  ))}
                </View>
              </AdminPanel>

              <AdminPanel title="Trả lời">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Câu trả lời gửi tới người dùng này"
                  placeholderTextColor={C.deskTxtDim}
                  multiline
                  maxLength={2000}
                  style={styles.input}
                />
                <PinButton
                  label={reply.isPending ? 'Đang gửi...' : 'Gửi trả lời'}
                  tone="ok"
                  disabled={body.length < 5 || reply.isPending}
                  loading={reply.isPending}
                  onPress={submit}
                  style={{ marginTop: 10 }}
                />
                {/* Nói rõ hệ quả: master cần biết người kia sẽ thấy gì sau cú bấm này. */}
                <Text style={styles.hint}>
                  Gửi xong, người dùng thấy chấm đỏ trên nút hỗ trợ trong app.
                </Text>
              </AdminPanel>
            </>
          )}
        </ScrollView>
      </AdminScreen>
    );
  }

  /* ── Tầng 1: hàng đợi ────────────────────────────────────────── */
  return (
    <AdminScreen title="Hỗ trợ người dùng" note="hộp thư của đội ngũ nền tảng">
      <AdminFilter options={FILTERS} value={filter} onChange={setFilter} />

      <ScrollView contentContainerStyle={styles.body}>
        {queue.isPending ? (
          <Loading onDark />
        ) : queue.error ? (
          <EmptyState icon="📡" onDark text={(queue.error as Error).message} />
        ) : (queue.data ?? []).length === 0 ? (
          <EmptyState
            icon="📭"
            onDark
            text={
              filter === 'waiting'
                ? 'Không có ai đang chờ trả lời'
                : 'Chưa có cuộc trao đổi nào'
            }
          />
        ) : (
          (queue.data ?? []).map((t) => (
            <Pressable key={t.id} onPress={() => setOpenId(t.id)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{t.userName}</Text>
                <Text style={styles.meta}>
                  {t.lastUserAt ? `Nhắn ${relativeTime(t.lastUserAt)}` : 'Chưa nhắn gì'}
                  {t.lastMasterAt ? ` · đã trả lời ${relativeTime(t.lastMasterAt)}` : ''}
                </Text>
              </View>
              {t.waiting && <View style={styles.waitDot} />}
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  back: { paddingHorizontal: 16, paddingTop: 12 },
  backText: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxtSoft },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.deskPanel,
    borderWidth: 1,
    borderColor: C.deskLine,
    borderRadius: R.sm,
    padding: 14,
  },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.deskTxt },
  meta: { fontFamily: F.ui, fontSize: 11.5, color: C.deskTxtDim, marginTop: 2 },
  waitDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.pin },
  chev: { fontSize: 18, color: C.deskTxtDim },

  bubble: { maxWidth: '88%', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.deskHi },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.deskRaise },
  who: { fontFamily: F.mono, fontSize: 9.5, color: C.deskTxtDim, marginBottom: 3 },
  msg: { fontFamily: F.ui, fontSize: 13.5, color: C.deskTxt, lineHeight: 19 },

  input: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: C.deskLineStrong,
    borderRadius: R.sm,
    backgroundColor: C.desk,
    padding: 12,
    fontFamily: F.ui,
    fontSize: 14,
    color: C.deskTxt,
    textAlignVertical: 'top',
  },
  hint: { fontFamily: F.ui, fontSize: 11, color: C.deskTxtDim, marginTop: 8 },
});
