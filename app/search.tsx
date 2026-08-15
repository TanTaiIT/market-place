import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListingPhoto } from '@/components/ListingPhoto';
import type { ProvinceName } from '@/components/LocationPicker';
import { ProvinceField } from '@/components/LocationPicker';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useSearch } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Search() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  // null = toàn quốc. Không debounce vì đổi tỉnh là một thao tác dứt khoát, không phải gõ phím.
  const [province, setProvince] = useState<ProvinceName | null>(null);

  // Chờ 300ms rồi mới gọi query — tránh gọi API mỗi lần gõ phím
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const { data, error, isFetching } = useSearch(debounced, province);
  const idle = debounced.trim().length === 0 && !province;

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

      <View style={styles.filterRow}>
        <ProvinceField label="Khu vực" value={province} onChange={setProvince} allowAll />
      </View>

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
              <ListingPhoto
                photo={item.photo}
                photoUrl={item.photoUrls?.[0]}
                style={styles.rowPhoto}
                imageStyle={styles.rowPhotoRadius}
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
          isFetching ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} />
          ) : (
            <EmptyState
              icon="🔍"
              text={idle ? 'Nhập từ khoá hoặc chọn khu vực' : 'Không tìm thấy tin phù hợp'}
            />
          )
        }
      />
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
    marginBottom: 14,
  },
  filterRow: { paddingHorizontal: 18 },
  input: { flex: 1, fontFamily: F.ui, fontSize: 14, color: C.ink, paddingVertical: 9 },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    padding: 10,
    ...shadow,
  },
  rowPhoto: { width: 64, height: 64, borderRadius: 6 },
  rowPhotoRadius: { borderRadius: 6 },
  rowTitle: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 3 },
  rowPrice: { fontFamily: F.monoBold, fontSize: 12, color: C.moss, marginBottom: 3 },
  rowMeta: { fontFamily: F.ui, fontSize: 10.5, color: C.inkSoft },
});
