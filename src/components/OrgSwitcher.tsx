import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyOrgs } from '@/queries/org';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
import { useOrgSlug, useSetActiveOrg } from '@/stores/auth';
import { C, F, shadow } from '@/theme';

/**
 * Chọn tổ chức đang thao tác.
 *
 * Từ v2, org KHÔNG nằm trong token: mỗi request tự khai bằng header `X-Org-Slug`. Nghĩa là
 * lựa chọn ở đây quyết định toàn bộ dữ liệu người dùng nhìn thấy ở màn sau — nên nó phải là
 * một thứ hiện rõ trên hồ sơ, không phải một tuỳ chọn giấu trong cài đặt.
 *
 * Không tự chọn giúp khi có nhiều tổ chức: đoán sai là người dùng đăng tin vào nhầm trường mà
 * không hề biết. Chỉ tự chọn khi có đúng một lựa chọn — lúc đó không còn gì để đoán.
 */
export function OrgSwitcher() {
  const router = useRouter();
  const orgs = useMyOrgs();
  const active = useOrgSlug();
  const setActiveOrg = useSetActiveOrg();
  const master = isMaster(useMyGrants().data);

  if (orgs.isLoading) return null;

  const rows = orgs.data ?? [];

  if (rows.length === 0) {
    // Master không là thành viên ở đâu cả — đẩy họ tới bàn quản trị chứ không mời đi xin vào
    // một tổ chức, thứ họ không cần và cũng không nên làm.
    if (master) {
      return (
        <Pressable style={styles.card} onPress={() => router.push('/admin/organizations')}>
          <Text style={styles.title}>{active ? 'Đang thao tác trong' : 'Chưa chọn tổ chức'}</Text>
          <Text style={styles.hint}>
            {active
              ? `/${active}`
              : 'Quyền master là quyền toàn hệ thống, không đi kèm thành viên ở tổ chức nào. Chọn một tổ chức để các màn nội bộ có chỗ mà đọc.'}
          </Text>
          <Text style={styles.action}>Bàn quản trị tổ chức →</Text>
        </Pressable>
      );
    }

    return (
      <Pressable style={styles.card} onPress={() => router.push('/join-org')}>
        <Text style={styles.title}>Chưa thuộc tổ chức nào</Text>
        <Text style={styles.hint}>
          Bạn vẫn xem và đăng được tin công khai. Muốn đăng tin nội bộ thì gửi đơn tham gia.
        </Text>
        <Text style={styles.action}>Tìm tổ chức →</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Đang thao tác trong</Text>

      {rows.map((org) => {
        const selected = org.slug === active;
        return (
          <Pressable
            key={org.id}
            style={[styles.row, selected && styles.rowOn]}
            onPress={() => setActiveOrg(selected ? null : org.slug)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{org.name}</Text>
              <Text style={styles.meta}>
                {org.role === 'owner' ? 'Chủ tổ chức' : 'Thành viên'} · {org.slug}
              </Text>
            </View>
            {selected ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}

      {/* Master chọn được org mình KHÔNG thuộc về, nên nó không có dòng nào ở trên để đánh dấu ✓. */}
      {master && active && !rows.some((o) => o.slug === active) ? (
        <Text style={styles.meta}>Đang thao tác trong /{active}</Text>
      ) : null}

      <Pressable onPress={() => router.push(master ? '/admin/organizations' : '/join-org')}>
        <Text style={styles.action}>
          {master ? 'Chọn tổ chức khác →' : 'Tham gia tổ chức khác →'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.paperWarm, borderRadius: 10, padding: 16, gap: 8, ...shadow },
  title: { fontFamily: F.uiBold, fontSize: 13, color: C.inkSoft },
  hint: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.cork,
  },
  rowOn: { borderWidth: 1.5, borderColor: C.pin },
  name: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  meta: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  check: { fontFamily: F.uiBold, fontSize: 16, color: C.pin },
  action: { fontFamily: F.uiBold, fontSize: 12.5, color: C.pin, marginTop: 4 },
});
