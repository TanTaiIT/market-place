import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CategoryBars, TrendChart } from '@/components/AdminChart';
import { AdminKpis } from '@/components/AdminKpis';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading } from '@/components/ui';
import { usePublicOverview } from '@/queries/admin';
import { C, F } from '@/theme';

/**
 * Tổng quan của TRỤC DANH MỤC — bản đối xứng của `app/admin/index.tsx` cho ô (danh mục × phường).
 *
 * KHÔNG khai cờ `org`: phạm vi tới từ `role_grants` của chính người gọi, không từ `X-Org-Slug`.
 * Người phụ trách một phường thường chẳng thuộc tổ chức nào, nên bắt họ chọn tổ chức là dựng
 * tường trước màn của chính họ.
 *
 * Không có thẻ "Người dùng"/"Báo cáo mở" như bàn org: cả hai là số của MỘT tổ chức
 * (`memberships` và `reports` đều có tenant), trục này không có khái niệm thành viên. Chỗ đó
 * thay bằng hai trạng thái người phụ trách ô thật sự phải theo — tin đang ẩn và tin đã từ chối.
 */
export default function AdminPublicOverview() {
  const { data, error, isLoading } = usePublicOverview();

  return (
    <AdminScreen title="Tổng quan trục" note="ô (danh mục × phường) bạn phụ trách">
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Loading onDark />
        ) : error || !data ? (
          <EmptyState
            icon="📡"
            onDark
            text={(error as Error | null)?.message ?? 'Không tải được số liệu'}
          />
        ) : (
          <View style={styles.stack}>
            <AdminKpis data={data.kpis} />

            <AdminPanel title="Tin đăng mỗi ngày" note="liền: đã duyệt · đứt: chờ duyệt">
              <TrendChart data={data.trend} />
            </AdminPanel>

            <AdminPanel title="Danh mục sôi động" note="trong phạm vi của bạn">
              {data.cats.length === 0 ? (
                <Text style={styles.empty}>Chưa có tin nào trong ô bạn phụ trách.</Text>
              ) : (
                <CategoryBars data={data.cats} />
              )}
            </AdminPanel>
          </View>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 32 },
  stack: { gap: 18, paddingHorizontal: 18 },
  empty: { fontFamily: F.ui, fontSize: 12.5, color: C.deskTxtDim },
});
