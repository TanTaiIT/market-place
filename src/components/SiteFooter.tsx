import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from './Toast';
import { CONSUMER, LEGAL_GROUPS, SITE } from '@/api/legal';
import { C, F, S, T } from '@/theme';

/**
 * Chân trang pháp lý — phần BÀY của cụm tạm thời; công thức gỡ nằm ở `@/api/legal`.
 *
 * File này cố tình không giữ một chữ nào của nội dung: mọi tên công ty, số giấy phép, nhãn
 * cột và tiêu đề bài đều đọc từ `@/api/legal`. Nhờ vậy lúc gỡ không ai phải đi soi xem còn
 * sót câu nào ở đây không — xoá file là xong.
 *
 * Đây KHÔNG phải một khối tiếp thị như `BannerBoard`/`PerkStrip`: thông tin doanh nghiệp và
 * đầu mối bảo vệ quyền lợi người tiêu dùng là thứ sàn thương mại điện tử buộc phải công bố.
 * Vì vậy nó LUÔN hiện, không gác sau cờ `isGuest` hay cờ nào khác, và không cuộn ngang —
 * người đi tìm nó là người đang cần đọc cho hết, không phải người đang lướt.
 */
export function SiteFooter() {
  const router = useRouter();
  const toast = useToast();

  /*
   * Bỏ `canOpenURL`: máy không gọi/gửi thư được sẽ ném ngay ở `openURL`, và một câu báo thật
   * vẫn hơn một dòng im lặng không phản ứng. Cùng lối với nút gọi ở trang chi tiết tin.
   */
  const open = (url: string) =>
    void Linking.openURL(url).catch(() => toast('⚠️ Máy này không mở được liên kết đó'));

  // `tel:` không nhận khoảng trắng hay dấu chấm — số hiển thị có nhóm cho dễ đọc, số quay thì liền.
  const dial = (phone: string) => open(`tel:${phone.replace(/[\s.]/g, '')}`);

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>{SITE.brand}</Text>

      <Contact icon="📞" label="Hotline" value={SITE.hotline} onPress={() => dial(SITE.hotline)} />
      <Contact
        icon="✉️"
        label="Hỗ trợ khách hàng"
        value={SITE.support}
        onPress={() => open(`mailto:${SITE.support}`)}
      />
      <Contact
        icon="🎧"
        label="Chăm sóc khách hàng"
        value={SITE.care}
        onPress={() => open(`mailto:${SITE.care}`)}
      />

      <View style={styles.rule} />

      <Text style={styles.company}>{SITE.company}</Text>
      <View style={styles.line}>
        <Text style={styles.lineIcon}>📍</Text>
        <Text style={styles.lineText}>{SITE.address}</Text>
      </View>
      <Pressable style={styles.line} hitSlop={4} onPress={() => dial(SITE.phone)}>
        <Text style={styles.lineIcon}>📞</Text>
        <Text style={[styles.lineText, styles.tap]}>{SITE.phone}</Text>
      </Pressable>
      <Text style={styles.license}>{SITE.license}</Text>

      <View style={styles.rule} />

      <Text style={styles.colTitle}>LIÊN HỆ BẢO VỆ QUYỀN LỢI NGƯỜI TIÊU DÙNG</Text>
      {CONSUMER.map(([label, value]) => (
        <Text key={label} style={styles.kv}>
          <Text style={styles.kvKey}>{label}: </Text>
          {value}
        </Text>
      ))}

      {LEGAL_GROUPS.map((group) => (
        <View key={group.title} style={styles.col}>
          <Text style={styles.colTitle}>{group.title.toUpperCase()}</Text>
          {group.articles.map(({ slug, title, body, route }) =>
            // Không `body` lẫn `route` = chưa có đích đến → chữ thường, không bấm được.
            body || route ? (
              <Pressable
                key={slug}
                hitSlop={4}
                onPress={() => router.push(route ?? `/legal/${slug}`)}
              >
                <Text style={[styles.colItem, styles.tap]}>{title}</Text>
              </Pressable>
            ) : (
              <Text key={slug} style={styles.colItem}>
                {title}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Contact({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.contact} hitSlop={4} onPress={onPress}>
      <Text style={styles.contactIcon}>{icon}</Text>
      <View style={styles.contactBody}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.contactValue}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * Lề âm `S.lg` để dải trắng tràn hết bề ngang: vùng cuộn của bảng tin đệm 16 hai bên cho mọi
   * khối, mà chân trang phải là một MẢNG nền khác chứ không phải thêm một thẻ nữa. Con số này
   * khớp `paddingHorizontal` của `feed.tsx` — đổi bên đó thì đổi cả bên này.
   *
   * Trắng trên nền `cork` xám là chiều ngược của bản web (xám trên nền trắng); giữ nguyên mức
   * tương phản, chỉ đảo vai vì nền màn của app vốn đã xám.
   */
  wrap: {
    marginTop: S.xxl,
    marginHorizontal: -S.lg,
    paddingHorizontal: S.lg,
    paddingTop: S.xl,
    paddingBottom: S.xxl,
    backgroundColor: C.paperWarm,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },

  brand: { fontFamily: F.uiBlack, ...T.xl, color: C.brandTx, marginBottom: S.lg },

  contact: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm },
  contactIcon: { fontSize: 20 },
  contactBody: { flex: 1, minWidth: 0 },
  contactLabel: { fontFamily: F.ui, ...T.xs, color: C.inkSoft },
  contactValue: { fontFamily: F.uiBold, ...T.md, color: C.ink },

  rule: { height: 1, backgroundColor: C.line, marginVertical: S.lg },

  company: { fontFamily: F.uiBold, ...T.sm, color: C.ink, marginBottom: S.md },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, paddingVertical: S.xs },
  lineIcon: { fontSize: 13, lineHeight: 19 },
  lineText: { flex: 1, fontFamily: F.ui, ...T.sm, color: C.inkSoft },
  /** Dấu hiệu DUY NHẤT của một dòng bấm được ở đây — bản web cũng không gạch chân gì cả. */
  tap: { color: C.brandTx },
  license: { fontFamily: F.ui, ...T.xs, color: C.muted, marginTop: S.md },

  kv: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, paddingVertical: 1 },
  kvKey: { fontFamily: F.uiBold, color: C.ink },

  col: { marginTop: S.xl },
  /* Chữ hoa + giãn chữ: nhãn cột, KHÔNG phải tiêu đề mục — nên không dùng `SectionHead`. */
  colTitle: {
    fontFamily: F.uiBold,
    ...T.xs,
    letterSpacing: 0.6,
    color: C.ink,
    marginBottom: S.md,
  },
  colItem: { fontFamily: F.ui, ...T.sm, color: C.inkSoft, paddingVertical: S.xs },
});
