import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { PickerSheet, type PickerItem } from './PickerSheet';
import { useAllOrgs } from '@/queries/org-admin';
import { useMyOrgs } from '@/queries/org';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
import { STATUS_LABEL, type Organization } from '@/api/org-admin';
import { normalizeVi } from '@/api/location';
import { useOrgId, useSetActiveOrg } from '@/stores/auth';
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
 * master sẽ không còn đường nào đặt `X-Org-Id` — tức là không quản trị được nhóm nào.
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

  /*
   * Hai nguồn khác hình: gom về đúng ba field bộ chọn cần, và gom ở CẢ HAI nhánh.
   *
   * Nhánh master trước đây trả thẳng `Organization[]`, nên `data` mang kiểu hợp của hai hình
   * khác nhau và mọi chỗ đọc nó phải chiều cả hai. Map luôn cho khớp `OrgRow` thì phần còn lại
   * của component chỉ làm việc với một hình.
   */
  const data: OrgRow[] | undefined = master
    ? all.data?.map((o) => ({ id: o.id, name: o.name, status: o.status }))
    : // Nhóm mình thuộc về thì luôn đang hoạt động — `/organizations/mine` không trả nhóm
      // đã khoá, nên `status` ở đây là hằng chứ không phải phỏng đoán.
      mine.data?.map((o) => ({ id: o.id, name: o.name, status: 'active' as const }));
  const isPending = master ? all.isPending : mine.isPending;
  const activeOrgId = useOrgId();
  const setActiveOrg = useSetActiveOrg();

  const orgs = data ?? [];
  const current = orgs.find((o) => o.id === activeOrgId);

  /*
   * Lọc ngay trên máy chứ không gọi lại BE mỗi lần gõ: `useAllOrgs` đã nạp sẵn cả trang (trần
   * 100 tổ chức), nên danh sách hiện tức thì, không debounce, không một request cho mỗi chữ cái.
   * Bỏ dấu bằng `normalizeVi` để gõ "hung vuong" ra "Trường Hùng Vương" — cùng cách BE tìm.
   */
  const search = useCallback(
    (keyword: string): PickerItem<string>[] => {
      const rows = data ?? [];
      const term = normalizeVi(keyword);
      // Tìm theo TÊN thôi: id là chuỗi hex, không ai gõ nó vào ô tìm kiếm.
      const shown = term ? rows.filter((o) => normalizeVi(o.name).includes(term)) : rows;
      return shown.map(toItem);
    },
    [data],
  );

  return (
    <>
      <Pressable onPress={onOpen} hitSlop={6} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <Text numberOfLines={1} style={styles.chip}>
          {/*
            Chọn rồi mà chưa tra ra tên thì hiện "Đang tải…", KHÔNG hiện id: một chuỗi hex 24 ký
            tự trên thanh tiêu đề không nói được gì, mà ca này chỉ kéo dài đúng một nhịp mạng.
          */}
          {current ? current.name : activeOrgId ? 'Đang tải…' : 'Chọn tổ chức'} ▾
        </Text>
      </Pressable>

      <PickerSheet
        visible={open}
        title="Tổ chức đang thao tác"
        placeholder="Tìm theo tên…"
        search={search}
        loading={isPending}
        value={activeOrgId ?? null}
        // Bỏ chọn là trạng thái hợp lệ của master: họ quay về các màn cấp hệ thống, nơi
        // `X-Org-Id` không có nghĩa gì.
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
type OrgRow = { id: string; name: string; status: Organization['status'] };

/**
 * `note` mang trạng thái vì bảng này có cả org đang khoá — chọn nhầm vào đó thì mọi màn sau đều
 * rỗng. KHÔNG in `id` ra nữa: từ khi slug bị gỡ, định danh là một chuỗi hex 24 ký tự — nó không
 * giúp người đọc nhận ra nhóm nào, chỉ chiếm chỗ của thứ có ích là trạng thái.
 */
function toItem(org: OrgRow): PickerItem<string> {
  return { key: org.id, label: org.name, note: STATUS_LABEL[org.status] };
}

const styles = StyleSheet.create({
  chip: { fontFamily: F.uiBold, fontSize: 11.5, letterSpacing: 0.3, color: C.pin },
});
