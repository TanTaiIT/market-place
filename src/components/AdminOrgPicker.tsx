import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { PickerSheet, type PickerItem } from './PickerSheet';
import { useAllOrgs } from '@/queries/org-admin';
import { useAdminOrgs } from '@/queries/org';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
import { STATUS_LABEL, type Organization } from '@/api/org-admin';
import { normalizeVi } from '@/api/location';
import { C, F } from '@/theme';

/**
 * Chọn nhóm cho một PHẠM VI do người gọi giữ — không còn chế độ "đổi org của cả app".
 *
 * Chế độ toàn cục cũ ghi thẳng vào store, nên một lựa chọn để quản trị nhóm X còn dính trên
 * Home, trên tìm kiếm, trên mọi request của những ngày sau. Giờ mọi người gọi đều truyền
 * `value`/`onChange` của chính mình: `AdminScreen` nối vào `AdminOrgScope` (sống trong
 * `/admin`), còn Thống kê giữ state riêng trong màn vì master chỉ đang LỌC một bảng số.
 *
 * HAI nguồn, theo quyền của người đang xem:
 *
 * - master → `GET /organizations` (toàn hệ thống). Họ không thuộc nhóm nào, nên đây là
 *   nguồn duy nhất có ý nghĩa.
 * - quản trị nhóm → `useAdminOrgs`: nhóm mình QUẢN TRỊ, không phải nhóm mình tham gia. Route
 *   trên là master-only, gọi vào chắc chắn 403.
 *
 * Trước đây bộ chọn này CHỈ dựng cho master, và bộ chuyển ở trang cá nhân gánh phần còn
 * lại. Từ khi bộ chuyển đó thành master-only, người quản trị hai nhóm trở lên mà không phải
 * master sẽ không còn đường nào đặt `X-Org-Id` — tức là không quản trị được nhóm nào.
 */
export function AdminOrgPicker({
  open,
  onOpen,
  onClose,
  value,
  onChange,
  title = 'Nhóm đang mở',
  emptyLabel = 'Không nhóm nào',
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** `null` = không lọc theo nhóm nào. Nghĩa của nó do người gọi đặt — xem `emptyLabel`. */
  value: string | null;
  onChange: (orgId: string | null) => void;
  title?: string;
  emptyLabel?: string;
}) {
  const grants = useMyGrants();
  const master = isMaster(grants.data);
  const all = useAllOrgs({}, master);
  const mine = useAdminOrgs();

  // Hai nguồn khác hình: gom về đúng ba field bộ chọn cần.
  const data = master
    ? all.data
    // `useAdminOrgs` đã loại nhóm khoá, nên `status` ở đây là hằng chứ không phải phỏng đoán.
    : mine.rows.map((o): OrgRow => ({ id: o.id, name: o.name, status: 'active' }));
  const isPending = master ? all.isPending : mine.isPending;

  const orgs = data ?? [];
  const current = orgs.find((o) => o.id === value);

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
        ? rows.filter((o) => normalizeVi(o.name).includes(term))
        : rows;
      return shown.map(toItem);
    },
    [data],
  );

  return (
    <>
      <Pressable onPress={onOpen} hitSlop={6} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text numberOfLines={1} style={styles.chip}>
          {current ? current.name : emptyLabel} ▾
        </Text>
      </Pressable>

      <PickerSheet
        visible={open}
        title={title}
        placeholder="Tìm theo tên…"
        search={search}
        loading={isPending}
        value={value}
        // Bỏ chọn luôn là một trạng thái hợp lệ — người gọi đặt tên cho nó.
        emptyAll={emptyLabel}
        onSelect={onChange}
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
type OrgRow = { id: string; name: string; status: Organization['status'] };

/** `note` mang trạng thái vì bảng này có cả org đang khoá — chọn nhầm vào đó thì mọi màn sau đều rỗng. */
function toItem(org: OrgRow): PickerItem<string> {
  return { key: org.id, label: org.name, note: STATUS_LABEL[org.status] };
}

const styles = StyleSheet.create({
  chip: { fontFamily: F.uiBold, fontSize: 11.5, letterSpacing: 0.3, color: C.pin },
});
