import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Notif } from '@/api/db';
import { C, F, shadow } from '@/theme';

/**
 * Một dòng của màn Thông báo: định nghĩa dòng là gì, cách gộp nhiều thông báo thành một dòng,
 * và cách vẽ nó.
 *
 * Tách khỏi `app/(tabs)/notif.tsx` vì route đó đã vượt trần 250 dòng (HARD#11). Ba thứ này đi
 * cùng nhau chứ không chia nhỏ tiếp: `clusterNotifs` sinh ra đúng cái mà `NotifRow` vẽ, và đổi
 * hình dạng dòng mà không đổi cùng lúc luật gộp là cách chắc chắn nhất để hai bên lệch nhau.
 *
 * Route giữ lại phần phụ thuộc vào vòng đời màn hình (`useSeenOnFocus`, điều hướng).
 */

/**
 * Hai phạm vi BE thật sự phân biệt. `chain`/`system` của bản cũ đã bỏ: chain không còn tồn
 * tại trong hệ thống, còn system thì chưa từng có endpoint nào gửi.
 */
export const SCOPE = {
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
export type NotifRowData =
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

const clusterKey = (n: Notif) => `${n.orgId ?? '-'}|${dayOf(n.at)}`;

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
export function clusterNotifs(items: Notif[]): NotifRowData[] {
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

  const rows: NotifRowData[] = [];
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

/** "Tài", "Tài và Hải", "Tài và 3 người khác" — dừng ở hai tên, quá đó là đếm. */
export function summarize(actors: string[], count: number): string {
  const who =
    actors.length === 1
      ? actors[0]
      : actors.length === 2
        ? `${actors[0]} và ${actors[1]}`
        : `${actors[0]} và ${actors.length - 1} người khác`;
  return `${who} vừa đăng ${count} tin`;
}

/** Một dòng thông báo. Hai nhánh (cụm / đơn) chỉ khác dữ liệu, không khác hình. */
export function NotifRow({
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
