import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { Loading } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useMyOrgs } from '@/queries/org';
import { useUpdateOrgDisplay } from '@/queries/org-admin';
import { useOrgSlug } from '@/stores/auth';
import { C, F, shadow } from '@/theme';

/**
 * Kiểu bày bảng tin của nhóm — quản trị nhóm đặt cho cả nhóm, không phải mỗi người một kiểu.
 *
 * Bảng tin là không gian chung của trường: hai người cùng nhìn một bảng mà thấy hai bố cục khác
 * nhau thì không ai chỉ đường cho nhau được ("tin ở hàng thứ ba" mất nghĩa). Người dựng nhóm
 * cũng là người biết nhóm mình đang ở dạng nào — ít tin đáng đọc kỹ, hay nhiều tin để lướt.
 */

const OPTIONS = [
  {
    value: 'feed' as const,
    title: 'Một tin một dòng',
    body: 'Ảnh lớn, có mô tả và hàng nút. Đọc được cả tin mà không phải mở ra.',
    hint: 'Hợp với nhóm ít tin',
  },
  {
    value: 'grid' as const,
    title: 'Hai tin một dòng',
    body: 'Chỉ ảnh, tên và giá. Nhìn được nhiều tin cùng lúc.',
    hint: 'Hợp với nhóm nhiều tin',
  },
];

export default function AdminOrgDisplay() {
  const toast = useToast();
  const activeSlug = useOrgSlug();
  const { data: myOrgs, isPending } = useMyOrgs();
  const save = useUpdateOrgDisplay();

  const org = (myOrgs ?? []).find((o) => o.slug === activeSlug);
  const current = org?.feedLayout ?? 'feed';

  const choose = (value: 'feed' | 'grid') => {
    if (!org || value === current) return;
    save.mutate(
      { slug: org.slug, feedLayout: value },
      {
        onSuccess: () => toast('✓ Đã đổi cách bày bảng tin'),
        onError: (e: Error) => toast(`⚠️ ${e.message}`),
      },
    );
  };

  return (
    <AdminScreen title="Cách bày bảng tin" note="áp dụng cho cả nhóm" org>
      <ScrollView contentContainerStyle={styles.body}>
        {isPending ? (
          <Loading onDark />
        ) : (
          <AdminPanel title={org?.name ?? 'Nhóm'} note="mọi thành viên đều thấy giống nhau">
            <View style={{ gap: 10 }}>
              {OPTIONS.map((opt) => {
                const on = opt.value === current;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => choose(opt.value)}
                    disabled={save.isPending}
                    style={({ pressed }) => [
                      styles.opt,
                      on && styles.optOn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.optTitle, on && { color: C.moss }]}>
                        {on ? '✓ ' : ''}
                        {opt.title}
                      </Text>
                      <Text style={styles.optBody}>{opt.body}</Text>
                      <Text style={styles.optHint}>{opt.hint}</Text>
                    </View>
                    {/* Bản xem trước dựng bằng khối màu — đủ để thấy khác biệt bố cục mà không
                        phải nạp tin thật chỉ để minh hoạ. */}
                    <View style={styles.preview}>
                      {opt.value === 'feed' ? (
                        <View style={styles.pvFeed} />
                      ) : (
                        <View style={styles.pvGridRow}>
                          <View style={styles.pvGrid} />
                          <View style={styles.pvGrid} />
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </AdminPanel>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 18, paddingBottom: 32, paddingTop: 12 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.paperWarm,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow,
  },
  optOn: { borderColor: C.moss },
  optTitle: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  optBody: { fontFamily: F.ui, fontSize: 12.5, lineHeight: 18, color: C.inkSoft, marginTop: 3 },
  optHint: { fontFamily: F.mono, fontSize: 10, color: C.moss, marginTop: 5 },

  preview: { width: 54, gap: 4 },
  pvFeed: { height: 42, borderRadius: 4, backgroundColor: C.sand },
  pvGridRow: { flexDirection: 'row', gap: 4 },
  pvGrid: { flex: 1, height: 42, borderRadius: 4, backgroundColor: C.sand },
});
