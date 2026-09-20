import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initialsOf } from '@/api/client';
import { Avatar, EmptyState, Loading, PagedFooter } from './ui';
import { useOrgMemberList } from '@/queries/org-admin';
import type { Member } from '@/api/org';
import { C, F, R, S, T } from '@/theme';

/**
 * Danh bạ nhóm, trượt từ dưới lên. Chạm một người là mở hồ sơ công khai của họ.
 *
 * Hàng avatar trên hồ sơ nhóm trước đây là hình TRANG TRÍ: nó hiện vài khuôn mặt rồi dòng chữ
 * "Bạn và N người khác", mà "N người khác" không có đường nào đi tới. Đây là đường đó.
 *
 * Dùng lại `useOrgMemberList` của `queries/org-admin` chứ không dựng hook mới: nó đã gắn
 * `X-Org-Id` cho riêng lượt gọi (xem người của nhóm khác không phải đổi org đang thao tác),
 * đã phân trang, và dùng CHUNG key `orgMembers(orgId)` — dựng hook thứ hai cho cùng endpoint là
 * hai bản cache nói cùng một chuyện. Tên module nghe như của quản trị, nhưng route BE gác
 * `requireMembershipOrOrgModerator`: thành viên thường đọc được danh bạ nhóm mình.
 *
 * Không gọi mutation ở đây và cũng không tự điều hướng — `onOpenMember` trả id về cho màn hình
 * (`app/**` sở hữu điều hướng, HARD#2).
 */

/**
 * Huy hiệu vai, và `member` cố ý KHÔNG có.
 *
 * Huy hiệu chỉ đánh dấu thứ KHÁC mặc định. Nhóm 500 người thì 498 dòng đeo chữ "Thành viên" là
 * 498 lần nhắc lại tiêu đề của chính cái ngăn này — và giữa đám đó thì hai dòng "Quản trị nhóm"
 * không còn nổi lên nữa, tức mất đúng thứ huy hiệu sinh ra để làm.
 */
const BADGE: Partial<Record<Member['role'], { text: string; tone: 'admin' | 'past' }>> = {
  admin: { text: 'Quản trị nhóm', tone: 'admin' },
  alumni: { text: 'Cựu thành viên', tone: 'past' },
};

export function OrgMemberSheet({
  orgId,
  total,
  onOpenMember,
  onClose,
}: {
  /** `null` = đóng. Truyền orgId là mở, và cũng là thứ bật query — không có cờ `visible` thứ hai. */
  orgId: string | null;
  /** Tổng số thành viên từ hồ sơ nhóm, để tiêu đề nói được con số trước khi trang đầu về. */
  total: number;
  onOpenMember: (userId: string) => void;
  onClose: () => void;
}) {
  /*
   * `useSafeAreaInsets()` chứ KHÔNG `<SafeAreaView>`: bên trong `<Modal>` component đó đo lề
   * của CỬA SỔ nó nằm trong và trả về 0 trên iOS — hàng cuối danh sách chui xuống dưới thanh
   * home. Cùng lý do đã ghi ở `CategoryPicker` và `PickerSheet`.
   */
  const insets = useSafeAreaInsets();
  const { data, error, isLoading, loadMore, isFetchingNextPage } = useOrgMemberList(orgId ?? '');

  return (
    <Modal
      visible={orgId !== null}
      transparent
      /*
       * `fade` chứ KHÔNG `slide` — cùng luật đã ghi ở `AdminListingSheet` và `SupportFab`.
       *
       * `animationType` trượt TOÀN BỘ nội dung Modal, mà scrim phủ kín màn cũng nằm trong đó:
       * đặt `slide` thì tấm tối trượt lên như một lớp riêng bám theo ngăn, thay vì đứng yên
       * làm nền. Hai chỗ còn dùng `slide` trong app đều là Modal ĐỤC toàn màn (`CategoryPicker`,
       * `TemplatePreview`) — ở đó không có scrim nào để lộ ra.
       *
       * Phần trượt chuyển xuống chính cái ngăn, bằng `SlideInDown` ngay dưới.
       */
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Scrim là ANH EM của ngăn chứ không bọc nó — bọc thì mỗi cú chạm vào một hàng đều lọt
          xuống scrim và ngăn tự đóng. Cùng cách `PickerSheet` dựng. */}
      <Pressable style={styles.scrim} onPress={onClose} />

      <Animated.View
        entering={SlideInDown.duration(260)}
        style={[styles.sheet, { paddingBottom: insets.bottom }]}
      >
        <View style={styles.head}>
          <Text style={styles.headTitle}>
            Thành viên ({total.toLocaleString('vi-VN')})
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>

        <FlatList
          data={data ?? []}
          keyExtractor={(m) => m.userId}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={<PagedFooter loading={isFetchingNextPage} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onOpenMember(item.userId)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              {/*
                `Member.avatar` của BE là URL Cloudinary, KHÔNG phải chữ viết tắt — nó lấy thẳng
                `User.avatar`. Chữ viết tắt dựng từ `name`, đúng cách mọi DTO khác làm.
              */}
              <Avatar text={initialsOf(item.name)} url={item.avatar || undefined} size={40} />
              <View style={styles.who}>
                {/* `flexShrink` để tên dài co lại nhường huy hiệu, chứ không đẩy nó ra khỏi mép:
                    huy hiệu là thứ người ta quét mắt tìm, mất nó thì cả hàng vô nghĩa. */}
                <Text numberOfLines={1} style={styles.name}>
                  {item.name}
                </Text>
                {renderBadge(item.role)}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            isLoading ? (
              <Loading />
            ) : error ? (
              <EmptyState icon="📡" text={(error as Error).message} />
            ) : (
              <EmptyState icon="👥" text="Chưa đọc được danh bạ nhóm" />
            )
          }
        />
      </Animated.View>
    </Modal>
  );
}

function renderBadge(role: Member['role']) {
  const badge = BADGE[role];
  if (!badge) return null;
  return (
    <View style={[styles.badge, badge.tone === 'past' && styles.badgePast]}>
      <Text style={[styles.badgeText, badge.tone === 'past' && styles.badgeTextPast]}>
        {badge.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  /*
   * Cao ĐÚNG 72% màn, không phải tự co theo nội dung: danh bạ phân trang nên chiều cao sẽ nhảy
   * mỗi lần tải thêm một trang, và một cái ngăn tự cao dần lên trong lúc người ta đang cuộn là
   * thứ làm trượt tay.
   */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
    backgroundColor: C.paper,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingTop: S.lg,
    paddingBottom: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headTitle: { flex: 1, fontFamily: F.uiBold, ...T.md, color: C.ink },
  close: {
    width: 28,
    height: 28,
    borderRadius: R.sm,
    backgroundColor: C.chipIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 12, color: C.inkSoft },

  list: { paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: S.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: S.sm },
  name: { flexShrink: 1, fontFamily: F.uiBold, ...T.sm, color: C.ink },
  badge: {
    backgroundColor: C.brandLt,
    borderRadius: R.pill,
    paddingHorizontal: S.sm,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: F.uiBold, ...T.xs, color: C.brandTx },
  /** Cựu thành viên là trạng thái đã QUA — sắc trung tính, không tranh chỗ với huy hiệu quản trị. */
  badgePast: { backgroundColor: C.chipIdle },
  badgeTextPast: { color: C.inkSoft },
  chevron: { fontFamily: F.uiBold, fontSize: 20, color: C.muted },
});
