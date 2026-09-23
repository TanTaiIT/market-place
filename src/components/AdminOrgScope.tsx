import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isOrgGoneError } from '@/api/http';

/**
 * Nhóm đang mở của BÀN QUẢN TRỊ — và chỉ của bàn quản trị.
 *
 * Thay cho `activeOrgId` trong Zustand, và điểm khác nằm ở VÒNG ĐỜI chứ không ở chỗ cất: state
 * này sinh ra khi vào `/admin` và chết khi rời khỏi đó. Store làm được mọi thứ khác nhưng không
 * làm được đúng điều này — nó sống suốt phiên, ghi cả xuống đĩa, nên một lựa chọn để quản trị
 * nhóm X còn dính lại trên Home, trên tìm kiếm, trên mọi request của những ngày sau. Đó chính
 * là lỗi đã hạ bộ chọn của master.
 *
 * Nhận `?org=` để deep-link vào thẳng bàn của một nhóm còn chạy được.
 */
type Scope = { orgId: string | undefined; setOrgId: (id: string | null) => void };

const Ctx = createContext<Scope | null>(null);

export function AdminOrgScope({
  fallback,
  children,
}: {
  /**
   * Nhóm mặc định khi chưa ai bấm chọn — `useSoleOrgId()`, do `app/admin/_layout` mớm vào.
   *
   * Nhận qua props chứ không tự gọi query: file này nằm ở `components/` mà mọi `queries/*`
   * lại đọc `useAdminOrgId` từ đây, nên gọi ngược vào `queries/` là dựng một vòng import thật.
   */
  fallback: string | null;
  children: React.ReactNode;
}) {
  const { org } = useLocalSearchParams<{ org?: string }>();
  /*
   * `undefined` = CHƯA CHẠM, khác hẳn `null` = "đã chọn: không nhóm nào".
   *
   * Nhờ vậy mặc định suy ra ngay trong render thay vì `useEffect` đồng bộ — danh sách nhóm về
   * sau lúc mount, mà một effect gán state lúc đó vừa là `set-state-in-effect` oxlint chặn, vừa
   * có thể đè lên nhóm người dùng vừa bấm.
   */
  const [picked, setPicked] = useState<string | null | undefined>(org);
  const orgId = picked !== undefined ? picked : fallback;

  // Nhóm đang mở bị khoá giữa chừng: bỏ chọn, ĐỪNG đăng xuất — phiên vẫn tốt nguyên. Nghe qua
  // cache thay vì một callback toàn cục, vì lỗi nổi lên ở tầng query chứ không ở tầng fetch.
  const qc = useQueryClient();
  useEffect(
    () =>
      qc.getQueryCache().subscribe((e) => {
        if (isOrgGoneError(e.query.state.error)) setPicked(null);
      }),
    [qc],
  );

  // `useMemo`: object dựng tại chỗ là một tham chiếu mới mỗi lần render, và context value đổi
  // tham chiếu thì MỌI màn quản trị render lại — kể cả khi nhóm đang mở không nhúc nhích.
  const value = useMemo(() => ({ orgId: orgId ?? undefined, setOrgId: setPicked }), [orgId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * `undefined` = chưa chọn nhóm nào.
 *
 * Ngoài `/admin` thì cũng là `undefined` chứ không nổ: vài hook dùng chung cho cả hai phía
 * (`useMyGrants` chẳng hạn), và bắt chúng nhớ mình đang ở đâu là chuyển một mặc định an toàn
 * thành một cái bẫy.
 */
export function useAdminOrgId(): string | undefined {
  return useContext(Ctx)?.orgId;
}

export function useSetAdminOrgId(): (id: string | null) => void {
  const ctx = useContext(Ctx);
  return ctx?.setOrgId ?? noop;
}

const noop = () => {};
