import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui';
import { GUIDE_TOPICS } from '@/api/guide';
import { C, F, S, T } from '@/theme';

/**
 * HƯỚNG DẪN SỬ DỤNG.
 *
 * Thay cho mục "Trợ giúp & hỗ trợ" cũ — mục đó chỉ hiện một toast kèm địa chỉ email, tức là
 * một ngõ cụt: người bấm vào đang có một câu hỏi, và thứ họ nhận được là một việc phải làm
 * tiếp ở chỗ khác. Hỗ trợ NGƯỜI THẬT thì đã có sẵn ở nút tròn `SupportFab`, nên chỗ này để
 * trả lời trước những câu hỏi không cần tới người.
 *
 * Gập/mở tại chỗ thay vì mỗi mục một màn: người tìm câu trả lời đang quét tiêu đề, và mỗi lần
 * mở-rồi-back là một lần mất chỗ vừa quét tới. Tám tiêu đề vừa đủ một màn.
 */
const BULLET = '• ';

export default function Guide() {
  /** Mục đang mở. MỘT mục một lúc — mở hết thì danh sách tiêu đề (thứ để quét) biến mất. */
  const [openId, setOpenId] = useState<string | null>(GUIDE_TOPICS[0]?.id ?? null);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Hướng dẫn sử dụng" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Chạm vào một mục để mở. Không thấy câu trả lời ở đây thì nhắn cho đội ngũ Ghim bằng nút
          hỗ trợ tròn ở góc màn hình.
        </Text>

        {GUIDE_TOPICS.map((topic) => {
          const open = openId === topic.id;
          return (
            <View key={topic.id} style={styles.card}>
              <Pressable
                onPress={() => setOpenId(open ? null : topic.id)}
                style={({ pressed }) => [styles.head, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.icon}>{topic.icon}</Text>
                <Text style={styles.title}>{topic.title}</Text>
                {/* Mũi tên xoay theo trạng thái — dấu hiệu duy nhất cho biết mục này mở được. */}
                <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
              </Pressable>

              {open && (
                <View style={styles.content}>
                  {topic.body.map((para) =>
                    para.startsWith(BULLET) ? (
                      <View key={para} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{para.slice(BULLET.length)}</Text>
                      </View>
                    ) : (
                      <Text key={para} style={styles.p}>
                        {para}
                      </Text>
                    ),
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  body: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xxl, gap: S.sm },
  intro: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, marginBottom: S.sm, lineHeight: 19 },

  card: { backgroundColor: C.paperWarm, borderRadius: 12, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.lg },
  icon: { fontSize: 17 },
  title: { flex: 1, fontFamily: F.uiBold, ...T.md, color: C.ink },
  chevron: { fontFamily: F.uiBold, fontSize: 15, color: C.inkSoft },

  content: { paddingHorizontal: S.lg, paddingBottom: S.lg, gap: S.sm },
  p: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', gap: S.sm },
  bulletDot: { fontFamily: F.ui, ...T.sm, color: C.moss },
  bulletText: { flex: 1, fontFamily: F.ui, ...T.sm, color: C.inkSoft, lineHeight: 20 },
});
