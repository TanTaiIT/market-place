import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteCard } from '@/components/NoteCard';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useSavedListings } from '@/queries/listings';
import { C } from '@/theme';

export default function Saved() {
  const router = useRouter();
  const { data, isLoading } = useSavedListings();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="Tin đã lưu" />
      <FlatList
        data={data ?? []}
        keyExtractor={(l) => String(l.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        renderItem={({ item, index }) => (
          <NoteCard item={item} index={index} onPress={() => router.push(`/listing/${item.id}`)} />
        )}
        ListEmptyComponent={
          isLoading ? <Loading /> : <EmptyState icon="🤍" text="Chưa lưu tin nào. Thả tim ở trang chi tiết nhé!" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
});
