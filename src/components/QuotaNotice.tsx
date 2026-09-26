import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { PostingQuota } from '@/api/db';
import { C, F } from '@/theme';

/**
 * Câu báo TRƯỚC khi soạn tin — người dùng phải biết tin sẽ chờ duyệt hay bị chặn ngay từ đầu,
 * không phải sau khi gõ xong và ăn một toast 409. Trả `null` khi không có gì đáng nói.
 *
 * Ngưỡng nhắc sớm 80% trần: để họ dọn tin cũ trước khi đụng trần, thay vì đụng rồi mới biết.
 */
function noticeOf(q: PostingQuota | undefined): string | null {
  if (!q) return null;
  if (q.probation) {
    return `⚖️ Tài khoản đang bị quản chế — tin sẽ chờ người duyệt. Lý do: ${q.probation.reason}`;
  }
  if (q.reason === 'live_full') {
    return `Bạn đang có ${q.live.count}/${q.live.limit} tin đang hiện hoặc chờ duyệt — đánh dấu đã bán hoặc xoá bớt trước khi đăng.`;
  }
  if (q.reason === 'blocked_by_rejections') {
    return 'Quyền đăng đang tạm khoá vì có tin bị từ chối gần đây — liên hệ quản trị để mở lại.';
  }
  if (q.live.count >= q.live.limit * 0.8) {
    return `Đang có ${q.live.count}/${q.live.limit} tin đang hiện hoặc chờ duyệt.`;
  }
  return null;
}

export function QuotaNotice({ quota }: { quota: PostingQuota | undefined }) {
  const notice = noticeOf(quota);
  if (!notice) return null;
  return <Text style={styles.notice}>{notice}</Text>;
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: C.warnTint,
    fontFamily: F.ui,
    fontSize: 12.5,
    lineHeight: 18,
    color: C.tape,
  },
});
