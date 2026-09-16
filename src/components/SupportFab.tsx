import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsAuthenticated } from '@/stores/auth';
import { useMarkSupportRead, useSendSupport, useSupportThread } from '@/queries/support';
import { useToast } from './Toast';
import { PinButton } from './ui';
import { C, F, R, shadowLift } from '@/theme';

/** Khớp trần của BE (`SUPPORT_BODY_MAX`); chặn ở đây để không phải đi một vòng mạng mới biết. */
const BODY_MAX = 2000;
const BODY_MIN = 5;

/**
 * Nút nổi "nhắn cho đội ngũ Ghim" — góc dưới bên phải, kèm chấm đỏ khi master đã trả lời.
 *
 * Đặt ở `(tabs)/_layout` nên nó theo người dùng qua cả bốn tab. Không đặt trong từng màn: bốn
 * bản sao là bốn chỗ có thể lệch nhau, và nút sẽ nhấp nháy mỗi lần đổi tab.
 *
 * `bottom` cộng chiều cao thanh tab vì thanh đó NẰM TRONG dòng chảy layout (xem docblock của
 * `TabBar`) — lấy `insets.bottom` không thôi là nút chồng lên thanh.
 *
 * Ẩn hẳn với khách: kênh này cần biết người gửi là ai để master trả lời đúng chỗ, mà hỏi đăng
 * nhập ngay sau khi người ta gõ xong một đoạn dài là cách chắc chắn nhất để mất đoạn đó.
 */
export function SupportFab() {
  const isAuthenticated = useIsAuthenticated();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: thread } = useSupportThread();
  const send = useSendSupport();
  const markRead = useMarkSupportRead();

  const unread = thread?.unread ?? false;
  const messages = thread?.messages ?? [];

  /*
   * Mở popup là đã đọc. Chạy trong `useEffect` chứ không trong `onPress`: người dùng cũng mở
   * được popup bằng đường khác trong tương lai (deep link, thông báo), và mốc "đã đọc" phải
   * gắn với việc luồng HIỆN RA chứ không với một cú bấm cụ thể.
   */
  useEffect(() => {
    if (open && unread) markRead.mutate();
    // `markRead` là đối tượng mutation, đổi mỗi lần render — đưa vào deps là gọi vô hạn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread]);

  if (!isAuthenticated) return null;

  const body = draft.trim();
  const canSend = body.length >= BODY_MIN && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    send.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: (e: Error) => toast(`⚠️ ${e.message}`),
    });
  };

  return (
    <>
      <Animated.View
        entering={FadeIn.delay(400)}
        style={[styles.fabWrap, { bottom: insets.bottom + 84 }]}
      >
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={
            unread ? 'Hỗ trợ — có câu trả lời mới từ đội ngũ Ghim' : 'Nhắn cho đội ngũ Ghim'
          }
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Text style={{ fontSize: 22 }}>💬</Text>
          {/*
            Chấm đỏ là TOÀN BỘ điểm của tính năng: người dùng phải biết master đã trả lời mà
            không cần mở ra kiểm tra. Viền cùng màu nền để nó tách khỏi nút xanh phía dưới.
          */}
          {unread && <View style={styles.dot} />}
        </Pressable>
      </Animated.View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
      {/*
        `fade` chứ KHÔNG `slide`: `animationType` trượt TOÀN BỘ nội dung Modal, mà nền mờ
        nằm bên trong nên nó trượt lên theo — thành một mảng tối chạy lên giữa màn hình, đúng
        thứ nhìn rất xấu. Để Modal lo phần hiện nền mờ (fade), còn cú trượt do chính tấm sheet
        làm bằng `entering`.
      */}
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <Animated.View
            entering={SlideInDown.duration(260)}
            style={[styles.sheet, { paddingBottom: insets.bottom || 12 }]}
          >
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headTitle}>Nhắn cho đội ngũ Ghim</Text>
                <Text style={styles.headNote}>
                  Trả lời trong giờ hành chính. Bạn sẽ thấy chấm đỏ trên nút này khi có hồi âm.
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.close}>
                <Text style={{ fontSize: 15 }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.log}
              contentContainerStyle={styles.logBody}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 ? (
                <Text style={styles.empty}>
                  Gặp lỗi, có góp ý, hay muốn mở nhóm cho trường mình? Viết vào đây — đội ngũ Ghim
                  đọc tất cả.
                </Text>
              ) : (
                messages.map((m, i) => (
                  <Animated.View
                    /*
                     * `at` là khoá dữ liệu thật: luồng chỉ NỐI THÊM, không sắp lại và không
                     * xoá, mà mỗi tin là một request riêng nên hai tin không thể cùng một
                     * mili-giây. Index thì đổi nghĩa ngay khi có tin mới chèn vào đầu.
                     */
                    key={m.at}
                    entering={FadeInDown.delay(Math.min(i, 4) * 40).duration(240)}
                    style={[styles.bubble, m.from === 'user' ? styles.mine : styles.theirs]}
                  >
                    {/* Nhãn phía master: người dùng cần biết đây là câu trả lời chính thức. */}
                    {m.from === 'master' && <Text style={styles.who}>Đội ngũ Ghim</Text>}
                    <Text style={m.from === 'user' ? styles.mineText : styles.theirsText}>
                      {m.body}
                    </Text>
                  </Animated.View>
                ))
              )}
            </ScrollView>

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Bạn cần trao đổi điều gì?"
              placeholderTextColor={C.muted}
              multiline
              maxLength={BODY_MAX}
              style={styles.input}
            />
            <PinButton
              label={send.isPending ? 'Đang gửi...' : 'Gửi cho đội ngũ Ghim'}
              tone="ok"
              disabled={!canSend}
              loading={send.isPending}
              onPress={submit}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 16, zIndex: 30 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLift,
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: C.pin,
    borderWidth: 2,
    borderColor: C.paperWarm,
  },

  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: C.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headTitle: { fontFamily: F.uiBold, fontSize: 16, color: C.ink },
  headNote: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 2, lineHeight: 16 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  log: { maxHeight: 280 },
  logBody: { gap: 8, paddingVertical: 4 },
  empty: {
    fontFamily: F.ui,
    fontSize: 13,
    color: C.inkSoft,
    lineHeight: 19,
    paddingVertical: 12,
  },
  bubble: { maxWidth: '86%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.brand },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.paperWarm, borderWidth: 1, borderColor: C.line },
  mineText: { fontFamily: F.ui, fontSize: 13.5, color: '#fff', lineHeight: 19 },
  theirsText: { fontFamily: F.ui, fontSize: 13.5, color: C.ink, lineHeight: 19 },
  who: { fontFamily: F.uiBold, fontSize: 10, color: C.brandTx, marginBottom: 3 },

  input: {
    minHeight: 76,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: C.lineInput,
    borderRadius: R.sm,
    backgroundColor: C.paperWarm,
    padding: 12,
    fontFamily: F.ui,
    fontSize: 14,
    color: C.ink,
    textAlignVertical: 'top',
  },
});
