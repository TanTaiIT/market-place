import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { PickerSheet, type PickerItem } from './PickerSheet';
import { useAllOrgs } from '@/queries/org-admin';
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
 * Chỉ dựng cho master. Người khác lấy tổ chức từ tư cách thành viên và không có gì để đổi —
 * dựng cho họ là mỗi màn quản trị thêm một lượt `GET /organizations` chắc chắn ăn 403.
 */
export function AdminOrgPicker({ open, onOpen, onClose }: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { data, isPending } = useAllOrgs({});
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
      const all = data ?? [];
      const term = normalizeVi(keyword);
      const shown = term
        ? all.filter((o) => normalizeVi(`${o.name} ${o.slug}`).includes(term))
        : all;
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

/** `note` mang trạng thái vì bảng này có cả org đang khoá — chọn nhầm vào đó thì mọi màn sau đều rỗng. */
function toItem(org: Organization): PickerItem<string> {
  return { key: org.slug, label: org.name, note: `/${org.slug} · ${STATUS_LABEL[org.status]}` };
}

const styles = StyleSheet.create({
  chip: { fontFamily: F.uiBold, fontSize: 11.5, letterSpacing: 0.3, color: C.pin },
});
