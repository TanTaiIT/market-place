import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Corkboard } from '@/components/Corkboard';
import { NoteCard } from '@/components/NoteCard';
import { Avatar, EmptyState, Loading, TapeChip } from '@/components/ui';
import { useCategories, useListings, useProfile } from '@/queries/listings';
import { C, F, shadow } from '@/theme';

export default function Feed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Chuỗi rỗng = "Tất cả". Giữ id chứ không giữ tên: BE lọc theo ObjectId của danh mục.
  const [categoryId, setCategoryId] = useState('');
  const { data: categories } = useCategories();
  const { data, error, isLoading, isRefetching, refetch } = useListings(categoryId);
  const { data: profile } = useProfile();

  const activeCategory = categories?.find((c) => c.id === categoryId);

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
                <Avatar text={profile?.avatar ?? '·'} ring />
              </Pressable>
            </View>

            <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
              <Text style={styles.searchText}>🔍  Tìm xe đạp, sách, laptop...</Text>
            </Pressable>

            {/* Chỉ hiện khi BE trả về danh mục — hỏng hoặc rỗng thì giấu hẳn hàng chip thay
                vì để một hàng trơ ra không bấm được gì. */}
            {!!categories?.length && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <TapeChip
                  label="Tất cả"
                  index={0}
                  active={categoryId === ''}
                  onPress={() => setCategoryId('')}
                />
                {categories.map((c, i) => (
                  <TapeChip
                    key={c.id}
                    label={c.icon ? `${c.icon} ${c.name}` : c.name}
                    index={i + 1}
                    active={categoryId === c.id}
                    onPress={() => setCategoryId(c.id)}
                  />
                ))}
              </ScrollView>
            )}
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
              text={
                activeCategory
                  ? `Chưa có tin nào trong mục ${activeCategory.name}`
                  : 'Chưa có tin nào để hiển thị'
              }
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
