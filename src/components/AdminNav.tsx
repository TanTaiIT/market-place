import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminListings, useAdminReports, useMyGrants } from '@/queries/admin';
import { canModerateOrg, canModeratePublicAxis, isMaster, topRole } from '@/api/admin';
import { useJoinRequestQueue, useMyOrgs } from '@/queries/org';
import { useOrgSlug } from '@/stores/auth';
import { useProfile } from '@/queries/listings';
import { Avatar } from './ui';
import { C, F, shadow } from '@/theme';

/**
 * Rail điều hướng của prototype, dựng lại thành ngăn kéo. Bản web có 236px cố định bên trái;
 * trên điện thoại đó là gần một nửa màn, nên nó chỉ hiện khi bấm ☰.
 *
 * Nhóm KHÔNG còn y hệt bản web: xem `GROUPS` về lý do phải chia lại theo trục quyền.
 *
 * Con số bên phải đọc từ chính query mà màn tương ứng dùng, nên số luôn khớp với thứ người
 * dùng sắp thấy. `useMyOrgs` là lượt gọi duy nhất ngăn kéo tự thêm — cần nó để gọi tên tổ
 * chức đang thao tác, và nó cache 5 phút dùng chung với bộ chuyển tổ chức trên hồ sơ.
 */

type NavItem = {
  href: string;
  icon: string;
  label: string;
  badge?: 'queue' | 'reports' | 'joins';
  /** Quyền BE đòi ở màn đó. Hiện mục mà người dùng chỉ có thể ăn 403 là hứa suông. */
  gate?: 'master' | 'publicAxis' | 'anyAxis';
};

/**
 * Nhóm = TRỤC QUYỀN của BE, không phải loại công việc.
 *
 * Bản trước nhóm theo "việc hằng ngày của tôi" (Hằng ngày / Nội dung / Cộng đồng / Hệ thống) —
 * tư duy của người trông đúng một tổ chức. Cách đó cắt ngang các trục: "Nội dung" gộp Tin đăng
 * (org) với Danh mục (hệ thống), "Cộng đồng" gộp Nhóm con (org) với Người dùng (hệ thống). Hệ
 * quả là không nhìn ra được mục nào đổi theo tổ chức đang chọn, mục nào thì không — mà với
 * master, đó đúng là thứ quyết định họ đang thao tác lên dữ liệu của ai.
 *
 * `org: true` = màn đọc `X-Org-Slug`, tức nội dung đổi theo tổ chức đang chọn.
 *
 * Nhóm 'Quyền' là ngoại lệ có chủ ý — nó cắt ngang cả hai trục, xem gate `anyAxis`.
 */
type NavGroup = {
  label: string;
  /** Màn trong nhóm đọc `X-Org-Slug` — nội dung đổi theo tổ chức đang chọn. */
  org?: boolean;
  /** Quyền tối thiểu để cả nhóm hiện ra. Hẹp hơn thì gác từng mục bằng `NavItem.gate`. */
  gate?: NavItem['gate'];
  /**
   * Nhóm này KHÔNG phải việc của master — dù họ CÓ quyền.
   *
   * Đây là chỗ duy nhất trong app phân biệt 'được phép' với 'là việc của mình', nên nói rõ:
   * `policy.ts` bên BE cho master short-circuit ở cả bảy hàm phân quyền, và ẩn mục menu không
   * thu hồi một quyền nào. Master vẫn duyệt được mọi tin của mọi nhóm bằng một lệnh `curl`.
   * Cờ này là quyết định về VAI TRÒ — master lo trục hệ thống, không làm bàn duyệt hằng ngày
   * — chứ không phải một chốt bảo mật. Đừng đọc menu như đọc mô hình quyền.
   */
  notMaster?: boolean;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    /*
     * `/admin` là cùng một route với mục 'Tổng quan' của nhóm org bên dưới — nó rẽ theo vai
     * ở trong màn. Hai nhóm không bao giờ cùng hiện (`notMaster` loại nhóm org khỏi master),
     * nên không có ca nào ngăn kéo hiện hai lối vào cùng một trang.
     */
    label: 'Tổng quan',
    gate: 'master',
    items: [{ href: '/admin', icon: '▦', label: 'Toàn hệ thống' }],
  },
  {
    label: 'Tổ chức',
    org: true,
    notMaster: true,
    items: [
      { href: '/admin', icon: '▦', label: 'Tổng quan' },
      { href: '/admin/moderation', icon: '📌', label: 'Duyệt tin', badge: 'queue' },
      { href: '/admin/reports', icon: '⚑', label: 'Báo cáo', badge: 'reports' },
      { href: '/admin/listings', icon: '▤', label: 'Tin đăng' },
      { href: '/admin/notice', icon: '◈', label: 'Gửi thông báo' },
      { href: '/admin/join-requests', icon: '✋', label: 'Đơn xin gia nhập', badge: 'joins' },
      { href: '/admin/members', icon: '👥', label: 'Thành viên' },
      { href: '/admin/org-display', icon: '▦', label: 'Cách bày bảng tin' },
    ],
  },
  {
    // Trục danh mục: hàng đợi riêng, không gộp vào 'Duyệt tin' — hai trục không giao nhau, và
    // tin ở đây không thuộc tổ chức nào nên nó KHÔNG nằm trong nhóm trên.
    label: 'Trục công khai',
    gate: 'publicAxis',
    notMaster: true,
    /*
     * Master bị loại khỏi nhóm này, nhưng HAI MÀN VẪN SỐNG và route vẫn vào được — có chủ ý.
     *
     * Ô (danh mục × tỉnh) chưa có ai phụ trách thì tin rơi về master (`routeListing`), nên nếu
     * xoá luôn màn thì tồn đọng đó thành vô hình. Đường vào bây giờ là panel 'Cần chú ý' ở bàn
     * tổng quan hệ thống: nó chỉ hiện khi CÓ tồn đọng, và trỏ thẳng vào đây. Master ghé khi cần
     * dọn, không phải mỗi ngày — còn manager danh mục thì vẫn thấy nhóm này như cũ.
     */
    items: [
      { href: '/admin/public-overview', icon: '▦', label: 'Tổng quan trục' },
      { href: '/admin/public-queue', icon: '🌐', label: 'Hàng đợi công khai' },
    ],
  },
  {
    // Phân quyền cắt ngang cả hai trục: `canGrant` cho manager cấp staff TRONG scope của chính
    // mình, kể cả scope (danh mục × tỉnh), còn `/role-grants/mine` thì ai có grant cũng đọc được.
    // Treo nó trong nhóm org như trước là khoá manager danh mục ra khỏi màn duy nhất họ chia
    // tải được — họ không thuộc tổ chức nào nên cả nhóm đó bị cắt.
    label: 'Quyền',
    items: [{ href: '/admin/role-grants', icon: '🔑', label: 'Phân quyền', gate: 'anyAxis' }],
  },
  {
    // Không mục nào ở đây đọc `X-Org-Slug`: đổi tổ chức đang chọn không đổi một dòng nào.
    label: 'Hệ thống',
    items: [
      { href: '/admin/organizations', icon: '🏫', label: 'Tổ chức', gate: 'master' },
      // `GET /users` đòi `requireMaster` (user.routes.ts) — thiếu gate là admin org bấm vào ăn 403.
      { href: '/admin/users', icon: '◍', label: 'Người dùng', gate: 'master' },
      { href: '/admin/categories', icon: '▩', label: 'Danh mục', gate: 'master' },
      { href: '/admin/category-templates', icon: '⛭', label: 'Mẫu thuộc tính', gate: 'master' },
      { href: '/admin/coverage', icon: '◰', label: 'Phủ sóng', gate: 'master' },
      // Cụm cấm đứng ngay dưới nhóm nội dung vì nó cũng là một từ điển dùng chung — nhưng là
      // từ điển CHẶN, áp trước cả phép tính uy tín.
      { href: '/admin/banned-phrases', icon: '🚫', label: 'Cụm từ cấm', gate: 'master' },
      { href: '/admin/listing-products', icon: '🎟', label: 'Gói tin', gate: 'master' },
      { href: '/admin/posting-stats', icon: '📈', label: 'Số liệu đăng tin', gate: 'master' },
    ],
  },
];

export function AdminNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  /*
   * `useSafeAreaInsets()` chứ KHÔNG `<SafeAreaView>` — bên trong `<Modal>` thì component đó
   * không chừa được lề an toàn (xem ghi chú ở chỗ dùng bên dưới).
   */
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { data: queue } = useAdminListings('pending');
  const { data: reports } = useAdminReports();
  const { data: profile } = useProfile();
  const { data: grants } = useMyGrants();
  const { data: joins } = useJoinRequestQueue('pending');
  const { data: myOrgs } = useMyOrgs();
  const activeSlug = useOrgSlug();

  const counts = {
    queue: queue?.length ?? 0,
    reports: reports?.length ?? 0,
    joins: joins?.length ?? 0,
  };

  const orgModerator = canModerateOrg(grants);
  const publicAxis = canModeratePublicAxis(grants);

  const allowed = {
    master: isMaster(grants),
    publicAxis,
    orgModerator,
    // Cửa của mục Phân quyền — xem nhóm 'Quyền' ở GROUPS: nó không thuộc riêng trục nào.
    anyAxis: orgModerator || publicAxis,
  };

  /*
   * BE tự suy ra tổ chức khi người dùng có ĐÚNG MỘT membership (`tenant.middleware.ts`
   * `resolveOrganization`), nên "chưa bấm chọn" KHÔNG đồng nghĩa "chưa có tổ chức". Gate nhóm
   * này bằng riêng `activeSlug` sẽ giấu mất cả bàn quản trị của đúng nhóm phổ biến nhất:
   * thành viên của một trường duy nhất, người chưa từng mở bộ chuyển tổ chức lần nào.
   *
   * Master KHÔNG còn đi qua đây: nhóm org mang `notMaster` nên nó không hiện với họ, và bàn
   * của họ không đọc `X-Org-Slug` một dòng nào. Trước đây họ rơi vào nhánh cuối (`mine` rỗng
   * vì không là thành viên ở đâu, chỉ còn cái slug tự chọn để nhận diện) — nhánh đó vẫn đúng
   * cho người thuộc nhiều nhóm mà chưa bấm chọn.
   */
  const mine = myOrgs ?? [];
  const orgName =
    mine.find((o) => o.slug === activeSlug)?.name ??
    (mine.length === 1 ? mine[0].name : activeSlug);

  // Cắt cả nhóm khi nó rỗng, không để lại cái tiêu đề nhóm treo lơ lửng không có mục nào.
  const visibleGroups = GROUPS.filter(
    (g) => !(g.notMaster && allowed.master) && (!g.gate || allowed[g.gate]),
  )
    .map((g) => ({
      ...g,
      items:
        g.org && !allowed.orgModerator
          ? []
          : g.items.filter((i) => !i.gate || allowed[i.gate]),
    }))
    .filter((g) => g.items.length > 0);

  const go = (href: string) => {
    onClose();
    // `replace` chứ không `push`: ngăn kéo là điều hướng ngang hàng, `push` sẽ chồng lên nhau
    // và nút back phải bấm mười lần mới thoát nổi bàn quản trị.
    if (href !== pathname) router.replace(href);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />

      <View style={[styles.panel, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.brand}>
          <View style={styles.brandPin} />
          <View>
            <Text style={styles.brandName}>
              Gh<Text style={{ color: C.pin }}>i</Text>m
            </Text>
            <Text style={styles.brandSub}>BÀN QUẢN TRỊ</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visibleGroups.map((group) => (
            <View key={group.label}>
              <Text numberOfLines={1} style={styles.group}>
                {group.org && orgName ? `TỔ CHỨC · ${orgName}` : group.label.toUpperCase()}
              </Text>

              {/*
                Chưa xác định được tổ chức thì cả tám mục dưới đây chỉ trả 403. Thay vì để người
                dùng bấm từng cái để phát hiện ra điều đó, nói thẳng một dòng và đưa họ đi xin
                vào một nhóm.

                Chỉ còn MỘT lối: nhánh `master → /admin/organizations` đã bỏ vì nhóm này không
                hiện với master nữa, nên điều kiện đó không bao giờ đúng.
              */}
              {group.org && !orgName ? (
                <Pressable
                  onPress={() => go('/join-org')}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.itemIcon}>◇</Text>
                  <Text style={[styles.itemLabel, { color: C.pin }]}>Chọn tổ chức để mở →</Text>
                </Pressable>
              ) : (
                group.items.map((item) => {
                  const on = item.href === pathname;
                  const count = item.badge ? counts[item.badge] : 0;
                  return (
                    <Pressable
                      key={item.href}
                      onPress={() => go(item.href)}
                      style={({ pressed }) => [
                        styles.item,
                        on && styles.itemOn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {on && <View style={styles.itemPin} />}
                      <Text style={styles.itemIcon}>{item.icon}</Text>
                      <Text style={[styles.itemLabel, on && { color: C.paper }]}>{item.label}</Text>
                      {!!count && (
                        <View style={[styles.count, item.badge === 'queue' && styles.countHot]}>
                          <Text
                            style={[
                              styles.countText,
                              item.badge === 'queue' && { color: C.paperWarm },
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={() => {
            onClose();
            router.replace('/(tabs)/profile');
          }}
          style={({ pressed }) => [styles.foot, pressed && { opacity: 0.7 }]}
        >
          <Avatar text={profile?.avatar ?? '·'} url={profile?.avatarUrl} size={32} color={C.mossDeep} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.meName}>
              {profile?.name ?? 'Quản trị'}
            </Text>
            <Text style={styles.meRole}>{(topRole(grants) ?? '').toUpperCase()}</Text>
          </View>
          <Text style={styles.exit}>Thoát ›</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: C.scrim },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 268,
    backgroundColor: C.deskPanel,
    borderRightWidth: 1,
    borderRightColor: C.deskLineStrong,
    ...shadow,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.deskLine,
  },
  brandPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.pin,
    borderTopWidth: 5,
    borderTopColor: C.pinLight,
  },
  brandName: { fontFamily: F.hand, fontSize: 25, color: C.paper, lineHeight: 28 },
  brandSub: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.6, color: C.deskTxtDim },

  list: { paddingHorizontal: 10, paddingVertical: 10 },
  group: {
    fontFamily: F.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: C.deskTxtDim,
    paddingHorizontal: 11,
    paddingTop: 14,
    paddingBottom: 7,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 6,
  },
  itemOn: { backgroundColor: C.deskHi },
  itemPin: {
    position: 'absolute',
    left: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.pin,
  },
  itemIcon: { width: 18, textAlign: 'center', fontSize: 13, color: C.deskTxtSoft },
  itemLabel: { flex: 1, fontFamily: F.uiSemi, fontSize: 13.5, color: C.deskTxtSoft },
  count: {
    minWidth: 22,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: C.deskHi,
  },
  countHot: { backgroundColor: C.pin },
  countText: { fontFamily: F.monoBold, fontSize: 10.5, color: C.deskTxtSoft },

  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.deskLine,
  },
  meName: { fontFamily: F.uiBold, fontSize: 12.5, color: C.deskTxt },
  meRole: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.6, color: C.deskTxtDim, marginTop: 1 },
  exit: { fontFamily: F.uiSemi, fontSize: 11.5, color: C.cork },
});
