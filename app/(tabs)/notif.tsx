import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Loading, PagedFooter, TabHeader } from '@/components/ui';
import { GuestGate } from '@/components/GuestGate';
import { useIsAuthenticated } from '@/stores/auth';
import { useToast } from '@/components/Toast';
import { useMarkNotificationRead, useNotifications } from '@/queries/notifications';
import { useMyOrgs } from '@/queries/org';
import type { Notif } from '@/api/db';
import { C, F, shadow } from '@/theme';

/**
 * Hai phạm vi BE thật sự phân biệt. `chain`/`system` của bản cũ đã bỏ: chain không còn tồn
 * tại trong hệ thống, còn system thì chưa từng có endpoint nào gửi.
 */
const SCOPE = {
  org: { icon: '🏫', label: 'Toàn tổ chức', iconBg: C.mossLight, badgeBg: C.moss, badgeFg: '#fff' },
  unit: { icon: '👥', label: 'Nhóm của bạn', iconBg: C.sand, badgeBg: C.amber, badgeFg: C.amberInk },
} as const;

/**
 * Từ bao nhiêu dòng cùng nhóm cùng ngày thì gộp lại thành một.
 *
 * 3 chứ không 2: hai dòng lẻ vẫn đọc được và mỗi dòng dẫn tới ĐÚNG tin đó — gộp sớm là đánh
 * đổi thứ hữu ích nhất (bấm vào xem ngay món đồ) lấy một dòng tóm tắt không cần thiết.
 */
const CLUSTER_FROM = 3;

/** Một dòng trên màn: hoặc một thông báo, hoặc một cụm cùng nhóm cùng ngày. */
type Row =
  | { kind: 'one'; key: string; notif: Notif }
  | {
      kind: 'many';
      key: string;
      orgId?: string;
      /** Tên người đăng, đã loại trùng và giữ thứ tự mới-nhất-trước. */
      actors: string[];
      count: number;
      unread: boolean;
      time: string;
    };

/** Khoá ngày theo giờ máy — chỉ để gom, không hiển thị nên không cần lo múi giờ hiển thị. */
const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Gộp các thông báo "ai vừa đăng gì" cùng nhóm cùng ngày.
 *
 * CHỈ gộp dòng có `actorName` — tức dòng sinh tự động, thứ duy nhất có thể dồn hàng chục cái
 * một ngày. Thông báo đích danh ("tin của bạn bị từ chối") và thông báo quản trị tự soạn luôn
 * đứng riêng: mỗi cái nói một việc khác nhau, gộp lại là mất nội dung.
 *
 * Giữ nguyên thứ tự BE trả về (mới nhất trước): cụm xuất hiện ở đúng vị trí của phần tử đầu
 * tiên thuộc nó, nên dòng không nhảy chỗ so với danh sách chưa gộp.
 */
function clusterNotifs(items: Notif[]): Row[] {
  /*
   * ĐẾM TRƯỚC, dựng sau — hai lượt, không một lượt.
   *
   * Gộp dần trong một lượt thì lúc gặp phần tử thứ hai của một khoá đã phải quyết định có gộp
   * hay không, mà ngưỡng lại cần biết TỔNG. Gộp trước rồi tách lại là không thể: dòng thứ hai
   * đã bị hấp thụ vào cụm và không còn nguyên bản để trả về.
   */
  const total = new Map<string, number>();
  for (const n of items) {
    if (!n.actorName) continue;
    const key = clusterKey(n);
    total.set(key, (total.get(key) ?? 0) + 1);
  }

  const rows: Row[] = [];
  const done = new Set<string>();

  for (const n of items) {
    const key = n.actorName ? clusterKey(n) : null;

    // Không phải dòng tự động, hoặc cụm chưa đủ ngưỡng → đứng riêng, bấm vào mở đúng tin.
    if (!key || (total.get(key) ?? 0) < CLUSTER_FROM) {
      rows.push({ kind: 'one', key: n.id, notif: n });
      continue;
    }

    if (done.has(key)) continue;
    done.add(key);

    // `n` là phần tử ĐẦU của cụm trong danh sách đã sắp mới-nhất-trước, nên nó quyết định vị
    // trí của cụm và cho cụm mốc thời gian mới nhất.
    const members = items.filter((m) => m.actorName && clusterKey(m) === key);
    rows.push({
      kind: 'many',
      key,
      orgId: n.orgId,
      actors: [...new Set(members.map((m) => m.actorName!))],
      count: members.length,
      unread: members.some((m) => m.unread),
      time: n.time,
    });
  }

  return rows;
}

const clusterKey = (n: Notif) => `${n.orgId ?? '-'}|${dayOf(n.at)}`;

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
  const { data, error, isLoading, refetch, loadMore, isFetchingNextPage } = useNotifications();
  const { data: myOrgs } = useMyOrgs();
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
      <TabHeader title="Thông báo" />
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
              <Row
                icon="📌"
                iconBg={C.mossLight}
                badge={orgById.get(item.orgId ?? '')?.name}
                title={summarize(item.actors, item.count)}
                body="Mở bảng tin nhóm để xem tất cả"
                time={item.time}
                unread={item.unread}
                onPress={() => {
                  const slug = orgById.get(item.orgId ?? '')?.id;
                  if (slug) router.push(`/org/${slug}`);
                }}
              />
            ) : (
              <Row
                icon={item.notif.actorName ? '📌' : SCOPE[item.notif.scope].icon}
                iconBg={
                  item.notif.actorName ? C.mossLight : SCOPE[item.notif.scope].iconBg
                }
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

/** "Tài", "Tài và Hải", "Tài và 3 người khác" — dừng ở hai tên, quá đó là đếm. */
function summarize(actors: string[], count: number): string {
  const who =
    actors.length === 1
      ? actors[0]
      : actors.length === 2
        ? `${actors[0]} và ${actors[1]}`
        : `${actors[0]} và ${actors.length - 1} người khác`;
  return `${who} vừa đăng ${count} tin`;
}

/** Một dòng thông báo. Tách ra vì hai nhánh (cụm / đơn) chỉ khác dữ liệu, không khác hình. */
function Row({
  icon,
  iconBg,
  badge,
  badgeBg,
  badgeFg,
  title,
  body,
  time,
  unread,
  onPress,
}: {
  icon: string;
  iconBg: string;
  badge?: string;
  badgeBg?: string;
  badgeFg?: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      // Chạm là ĐI (mở tin / mở nhóm), không còn là "đánh dấu đã đọc" — vào tab đã là đã xem
      // hết (xem `useSeenOnFocus`). Chấm bên phải = "mới kể từ lần xem trước", giữ tới khi rời tab.
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {!!badge && (
          <View style={[styles.badge, { backgroundColor: badgeBg ?? C.chipIdle }]}>
            <Text numberOfLines={1} style={[styles.badgeText, { color: badgeFg ?? C.inkSoft }]}>
              {badge}
            </Text>
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      {unread && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  item: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: C.paperWarm,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    ...shadow,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  badgeText: { fontFamily: F.uiBold, fontSize: 9.5 },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.ink, marginBottom: 2 },
  body: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, lineHeight: 18, marginBottom: 5 },
  time: { fontFamily: F.mono, fontSize: 10, color: C.muted },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.pin,
    position: 'absolute',
    top: 14,
    right: 12,
  },
});
