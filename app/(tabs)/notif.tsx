import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, PagedFooter, TabHeader } from '@/components/ui';
import { ClearAllButton } from '@/components/ClearAllButton';
import { NotifRow, SCOPE, clusterNotifs, summarize } from '@/components/NotifRow';
import { GuestGate } from '@/components/GuestGate';
import { useIsAuthenticated } from '@/stores/auth';
import { useToast } from '@/components/Toast';
import {
  useClearNotifications,
  useMarkNotificationRead,
  useNotifications,
} from '@/queries/notifications';
import { useMyOrgs } from '@/queries/org';
import type { Notif } from '@/api/db';
import { C } from '@/theme';

/**
 * Những dòng cần MỘT lượt PATCH để cả tập `unread` thành đã đọc.
 *
 * Dòng đích danh: mỗi dòng một PATCH — chúng chỉ vài cái mỗi tháng. Dòng tự động: MỘT PATCH cho
 * mỗi nhóm, vào dòng mới nhất của nhóm đó (danh sách đã mới-nhất-trước) — BE đẩy mốc "đã xem"
 * của cả nhóm lên tới thời điểm ấy (xem `markRead` ở BE), nên các dòng cũ hơn theo luôn.
 */
function markTargets(unread: Notif[]): string[] {
  const orgs = new Set<string>();
  return unread
    .filter((n) => {
      if (!n.actorName) return true;
      const org = n.orgId ?? '-';
      if (orgs.has(org)) return false;
      orgs.add(org);
      return true;
    })
    .map((n) => n.id);
}

/**
 * Vào tab là ĐÃ XEM HẾT — không phải chạm từng dòng.
 *
 * Đây là hộp thư "lướt qua": người dùng mở tab, đọc lướt tiêu đề, xong. Bắt họ chạm từng dòng
 * để tắt chấm là mô hình email, không phải mô hình thông báo — kết quả thật là chấm đỏ trên
 * thanh tab không bao giờ tắt, và người dùng thôi để ý tới nó.
 *
 * Hai việc, cố ý tách nhau:
 *
 * 1. GHI với BE ngay khi tab có focus, và lại mỗi khi có dòng chưa đọc MỚI tới trong lúc đang
 *    mở. Huy hiệu trên thanh tab tắt ngay nhờ bản lạc quan của `useMarkNotificationRead`.
 * 2. CHẤM trên dòng giữ tới khi RỜI tab. Tắt hết ngay lúc mở là xoá luôn câu trả lời cho "cái
 *    nào mới?" — thứ duy nhất người ta vào đây để biết. `fresh` là ảnh chụp những dòng chưa đọc
 *    lúc mở (cộng dòng mới tới trong lúc mở); rời tab thì xoá, lần sau vào là sạch.
 *
 * `fresh` cũng là cái chặn vòng lặp: mutation hỏng → rollback → dòng lại "chưa đọc" → effect
 * chạy lại, nhưng dòng đã nằm trong `fresh` thì không thử lại. Mỗi dòng một lần cho mỗi lần
 * focus, và lỗi báo MỘT toast — không phải một toast cho mỗi PATCH song song.
 */
function useSeenOnFocus(data: Notif[] | undefined): Set<string> {
  const { mutate } = useMarkNotificationRead();
  const toast = useToast();
  const [focused, setFocused] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  // Ref, không state: chỉ để chặn toast thứ hai, không có gì cần vẽ lại.
  const warned = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setFresh(new Set());
        warned.current = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!focused || !data) return;
    const unread = data.filter((n) => n.unread && !fresh.has(n.id));
    if (unread.length === 0) return;

    setFresh((prev) => new Set([...prev, ...unread.map((n) => n.id)]));
    for (const id of markTargets(unread)) {
      mutate(id, {
        onError: (e: Error) => {
          if (warned.current) return;
          warned.current = true;
          toast(`⚠️ ${e.message}`);
        },
      });
    }
  }, [focused, data, fresh, mutate, toast]);

  return fresh;
}

export default function Notifications() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, refetch, loadMore, isFetchingNextPage } = useNotifications();
  const { data: myOrgs } = useMyOrgs();
  const clear = useClearNotifications();
  const fresh = useSeenOnFocus(data);

  const isAuthenticated = useIsAuthenticated();

  // Thông báo là việc xảy ra VỚI tin của bạn: được duyệt, có người quan tâm, có tin nhắn mới.
  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Thông báo"
        message="Tin của bạn được duyệt, có người quan tâm hay có tin nhắn mới — đăng nhập để nhận những thông báo đó."
      />
    );
  }

  // Chấm trên dòng = "mới kể từ lần xem trước" theo ảnh chụp `fresh`, không theo `unread` sống:
  // server đã được ghi "đã đọc" ngay lúc mở tab, mà chấm thì phải sống tới khi rời tab.
  const rows = clusterNotifs(
    (data ?? []).map((n) => ({ ...n, unread: n.unread || fresh.has(n.id) })),
  );
  const orgById = new Map((myOrgs ?? []).map((o) => [o.id, o]));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TabHeader
        title="Thông báo"
        right={
          rows.length > 0 && (
            <ClearAllButton
              title="Xoá tất cả thông báo?"
              // Nói thẳng hai giới hạn thật của cơ chế mốc thời gian ở BE, vì cả hai đều đi
              // ngược trực giác: không hoàn tác được, và thông báo MỚI vẫn tới bình thường.
              message="Hộp thư sẽ trống. Không khôi phục lại được, nhưng thông báo mới vẫn tiếp tục gửi tới bạn."
              busy={clear.isPending}
              onConfirm={() =>
                clear.mutate(undefined, {
                  onSuccess: () => toast('✓ Đã xoá tất cả thông báo'),
                  onError: (e: Error) => toast(`⚠️ ${e.message}`),
                })
              }
            />
          )
        }
      />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={<PagedFooter loading={isFetchingNextPage} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).duration(340)}>
            {item.kind === 'many' ? (
              <NotifRow
                icon="📌"
                iconBg={C.mossLight}
                badge={orgById.get(item.orgId ?? '')?.name}
                title={summarize(item.actors, item.count)}
                body="Mở bảng tin nhóm để xem tất cả"
                time={item.time}
                unread={item.unread}
                onPress={() => {
                  const slug = orgById.get(item.orgId ?? '')?.slug;
                  if (slug) router.push(`/org/${slug}`);
                }}
              />
            ) : (
              <NotifRow
                icon={item.notif.actorName ? '📌' : SCOPE[item.notif.scope].icon}
                iconBg={item.notif.actorName ? C.mossLight : SCOPE[item.notif.scope].iconBg}
                // Thông báo tự động lấy TÊN NHÓM làm nhãn; thông báo người soạn giữ nhãn phạm vi
                // ("Toàn tổ chức" / "Nhóm của bạn") vì ở đó phạm vi mới là thông tin.
                badge={
                  item.notif.actorName
                    ? orgById.get(item.notif.orgId ?? '')?.name
                    : SCOPE[item.notif.scope].label
                }
                badgeBg={item.notif.actorName ? undefined : SCOPE[item.notif.scope].badgeBg}
                badgeFg={item.notif.actorName ? undefined : SCOPE[item.notif.scope].badgeFg}
                title={item.notif.title}
                body={item.notif.body}
                time={item.notif.time}
                unread={item.notif.unread}
                onPress={() => {
                  const id = item.notif.listingId;
                  if (id) router.push(`/listing/${id}`);
                }}
              />
            )}
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : error ? (
            <EmptyState icon="📡" text={(error as Error).message} onRetry={() => void refetch()} />
          ) : (
            <EmptyState icon="🔔" text="Chưa có thông báo nào" />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
});
