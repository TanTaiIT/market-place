import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useSearch } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

const RECENT = ['xe đạp', 'sách toán', 'laptop'];

export default function Search() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  // Chờ 300ms rồi mới gọi query — tránh gọi API mỗi lần gõ phím
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const { data, isFetching } = useSearch(debounced);
  const showRecent = debounced.trim().length === 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Tìm kiếm" />

      <View style={styles.inputRow}>
        <Text style={{ fontSize: 15 }}>🔍</Text>
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder="Tìm xe đạp, sách, laptop..."
          placeholderTextColor={C.muted}
          style={styles.input}
          returnKeyType="search"
        />
      </View>

      {showRecent ? (
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={styles.recentLabel}>Tìm gần đây</Text>
          <View style={styles.recentRow}>
            {RECENT.map((r) => (
              <Pressable key={r} style={styles.recentChip} onPress={() => setText(r)}>
                <Text style={styles.recentText}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(320)}>
              <Pressable
                onPress={() => router.push(`/listing/${item.id}`)}
                style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]}
              >
                <LinearGradient
                  colors={item.photo}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.rowPhoto}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={styles.rowTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowPrice}>{item.price}</Text>
                  <Text style={styles.rowMeta}>{item.meta}</Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
          ListEmptyComponent={
            isFetching ? <Loading /> : <EmptyState icon="🔍" text="Không tìm thấy tin phù hợp" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.paperWarm,
    borderWidth: 2,
    borderColor: C.pin,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 18,
  },
  input: { flex: 1, fontFamily: F.ui, fontSize: 14, color: C.ink, paddingVertical: 9 },
  recentLabel: {
    fontFamily: F.uiBold,
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: C.inkSoft,
    marginBottom: 10,
  },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: C.sand,
    borderRadius: 16,
  },
  recentText: { fontFamily: F.uiSemi, fontSize: 12, color: C.inkSoft },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 10,
    ...shadow,
  },
  rowPhoto: { width: 64, height: 64, borderRadius: 6 },
  rowTitle: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 3 },
  rowPrice: { fontFamily: F.monoBold, fontSize: 12, color: C.moss, marginBottom: 3 },
  rowMeta: { fontFamily: F.ui, fontSize: 10.5, color: C.inkSoft },
});
