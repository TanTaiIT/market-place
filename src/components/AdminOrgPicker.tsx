import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { PickerSheet, type PickerItem } from './PickerSheet';
import { useAllOrgs } from '@/queries/org-admin';
import { useMyOrgs } from '@/queries/org';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
import { STATUS_LABEL, type Organization } from '@/api/org-admin';
import { normalizeVi } from '@/api/location';
import { useOrgSlug, useSetActiveOrg } from '@/stores/auth';
import { C, F } from '@/theme';

/**
 * Đổi tổ chức đang thao tác, ngay trên đầu mọi màn org-scoped.
 *
 * Master KHÔNG bị hỏi "được phép không" — quyền của họ là toàn hệ thống. Thứ họ phải chỉ ra là
 * XEM DỮ LIỆU CỦA AI: hàng đợi duyệt, đơn gia nhập, nhóm con đều là câu hỏi "của tổ chức nào".
 * Vì vậy đây là bộ CHỌN PHẠM VI đứng cạnh tiêu đề, không phải một cánh cửa chặn đường: đổi tổ
 * chức không phải rời màn hình rồi tìm đường quay lại.
 *
 * HAI nguồn, theo quyền của người đang xem:
 *
 * - master → `GET /organizations` (toàn hệ thống). Họ không thuộc nhóm nào, nên đây là
 *   nguồn duy nhất có ý nghĩa.
 * - quản trị nhóm → `/organizations/mine`. Route trên là master-only, gọi vào chắc chắn 403.
 *
 * Trước đây bộ chọn này CHỈ dựng cho master, và bộ chuyển ở trang cá nhân gánh phần còn
 * lại. Từ khi bộ chuyển đó thành master-only, người quản trị hai nhóm trở lên mà không phải
 * master sẽ không còn đường nào đặt `X-Org-Slug` — tức là không quản trị được nhóm nào.
 */
export function AdminOrgPicker({ open, onOpen, onClose }: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const grants = useMyGrants();
  const master = isMaster(grants.data);
  const all = useAllOrgs({}, master);
  const mine = useMyOrgs();

  // Hai nguồn khác hình: gom về đúng ba field bộ chọn cần.
  const data = master
    ? all.data
    // Nhóm mình thuộc về thì luôn đang hoạt động — `/organizations/mine` không trả nhóm
    // đã khoá, nên `status` ở đây là hằng chứ không phải phỏng đoán.
    : mine.data?.map((o): OrgRow => ({ name: o.name, slug: o.slug, status: 'active' }));
  const isPending = master ? all.isPending : mine.isPending;
  const activeSlug = useOrgSlug();
  const setActiveOrg = useSetActiveOrg();

  const orgs = data ?? [];
  const current = orgs.find((o) => o.slug === activeSlug);

  /*
   * Lọc ngay trên máy chứ không gọi lại BE mỗi lần gõ: `useAllOrgs` đã nạp sẵn cả trang (trần
   * 100 tổ chức), nên danh sách hiện tức thì, không debounce, không một request cho mỗi chữ cái.
   * Bỏ dấu bằng `normalizeVi` để gõ "hung vuong" ra "Trường Hùng Vương" — cùng cách BE tìm.
   */
  const search = useCallback(
    (keyword: string): PickerItem<string>[] => {
      const rows = data ?? [];
      const term = normalizeVi(keyword);
      const shown = term
        ? rows.filter((o) => normalizeVi(`${o.name} ${o.slug}`).includes(term))
        : rows;
      return shown.map(toItem);
    },
    [data],
  );

  return (
    <>
      <Pressable onPress={onOpen} hitSlop={6} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text numberOfLines={1} style={styles.chip}>
          {current ? current.name : activeSlug ? `/${activeSlug}` : 'Chọn tổ chức'} ▾
        </Text>
      </Pressable>

      <PickerSheet
        visible={open}
        title="Tổ chức đang thao tác"
        placeholder="Tìm theo tên hoặc slug…"
        search={search}
        loading={isPending}
        value={activeSlug ?? null}
        // Bỏ chọn là trạng thái hợp lệ của master: họ quay về các màn cấp hệ thống, nơi
        // `X-Org-Slug` không có nghĩa gì.
        emptyAll="Không thao tác trong tổ chức nào"
        onSelect={setActiveOrg}
        onClose={onClose}
      />
    </>
  );
}

/**
 * Ba field bộ chọn thật sự cần. Khai riêng thay vì mượn `Organization`: hai nguồn trả về hai
 * hình khác nhau, và `/organizations/mine` không mang `joinCode`, `orgType`… — ép sang kiểu
 * đầy đủ chỉ để hài lòng compiler là bịa ra dữ liệu không có thật.
 */
type OrgRow = { name: string; slug: string; status: Organization['status'] };

/** `note` mang trạng thái vì bảng này có cả org đang khoá — chọn nhầm vào đó thì mọi màn sau đều rỗng. */
function toItem(org: OrgRow): PickerItem<string> {
  return { key: org.slug, label: org.name, note: `/${org.slug} · ${STATUS_LABEL[org.status]}` };
}

const styles = StyleSheet.create({
  chip: { fontFamily: F.uiBold, fontSize: 11.5, letterSpacing: 0.3, color: C.pin },
});
