import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { NoteCard } from '@/components/NoteCard';
import { Avatar, EmptyState, Loading, TapeChip } from '@/components/ui';
import { CATEGORIES } from '@/api/db';
import { useListings, useProfile } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState('Tất cả');
  const { data, error, isLoading, isRefetching, refetch } = useListings(cat);
  const { data: profile } = useProfile();

  return (
    <Corkboard>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 32,
          gap: 14,
        }}
        refreshControl={
          // Bọc `refetch` chứ không truyền thẳng: RefreshControl gọi handler không tham số nhưng
          // `refetch` nhận `RefetchOptions`, và nó trả Promise mà prop này không nhận.
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={C.paperWarm}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Bảng tin của bạn</Text>
              <Pressable onPress={() => router.push('/(tabs)/profile')}>
                <Avatar text={profile?.avatar ?? 'MV'} ring />
              </Pressable>
            </View>

            <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
              <Text style={styles.searchText}>🔍  Tìm xe đạp, sách, laptop...</Text>
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {CATEGORIES.map((c, i) => (
                <TapeChip key={c} label={c} index={i} active={cat === c} onPress={() => setCat(c)} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item, index }) => (
          <NoteCard item={item} index={index} onPress={() => router.push(`/listing/${item.id}`)} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading onDark />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message || 'Chưa tải được bảng tin'} onDark />
          ) : (
            <EmptyState
              icon="📌"
              text={cat === 'Tất cả' ? 'Chưa có tin nào để hiển thị' : `Chưa có tin nào trong mục ${cat}`}
              onDark
            />
          )
        }
      />
    </Corkboard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: F.hand, fontSize: 26, color: C.ink },
  searchBar: {
    backgroundColor: C.paperWarm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.corkDark,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 14,
    ...shadow,
  },
  searchText: { fontFamily: F.ui, fontSize: 13.5, color: C.inkSoft },
  chipRow: { paddingBottom: 6, paddingRight: 8 },
});
