import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initialsOf } from '@/api/client';
import { uploadImage } from '@/api/cloudinary';
import { AvatarPicker } from '@/components/AvatarPicker';
import { BoxField, FormSection } from '@/components/FormSection';
import { EmptyState, Loading, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { canAdminOrg } from '@/api/admin';
import { useMyGrants } from '@/queries/admin';
import { useMyOrgs } from '@/queries/org';
import { useOrgProfile, useUpdateOrg } from '@/queries/org-discover';
import { C, F } from '@/theme';

/**
 * Sửa hồ sơ nhóm — ảnh bìa, mô tả, nội quy.
 *
 * Nằm trong `app/org/[slug]/` chứ không phải bàn quản trị: slug đi theo đường dẫn nên màn này
 * sửa đúng nhóm mình vừa mở, không phụ thuộc "tổ chức đang thao tác" của cả app. Quản trị mở
 * hồ sơ nhóm B rồi bấm sửa thì sửa B, dù họ đang làm việc ở A.
 *
 * Cửa quyền thật là `requireOrgAdmin` bên BE. Phần chặn ở đây chỉ để người không có quyền
 * không phải điền hết form rồi mới ăn 403.
 */

/** Trùng `updateOrganizationSchema.rules` bên BE — vượt là 400, chặn sớm để đỡ một vòng mạng. */
const MAX_RULES = 10;
const MAX_RULE_LEN = 200;
const MAX_DESC = 500;

export default function OrgEditScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: org, isPending } = useOrgProfile(slug ?? '');
  const { data: grants, isPending: grantsPending } = useMyGrants();
  const { data: myOrgs } = useMyOrgs();
  const save = useUpdateOrg(slug ?? '');

  /*
   * Form dựng MỘT LẦN từ hồ sơ, không đồng bộ lại theo `org`.
   *
   * Lazy initializer chạy ở lần mount đầu, nên phải chờ `org` về rồi mới mount `<Form>` —
   * đó là lý do có `<Loading />` phía dưới thay vì render form với giá trị rỗng. Nếu để form
   * theo `org` bằng `useEffect` thì lượt refetch nào cũng ghi đè thứ người dùng đang gõ.
   */
  // Chờ CẢ grants: `canAdminOrg(undefined, …)` là `false`, nên vẽ sớm sẽ nháy qua màn "không
  // có quyền" rồi mới hiện form — người có quyền đọc được đúng một câu nói họ không có quyền.
  if (isPending || grantsPending) return <Shell><Loading /></Shell>;
  if (!org) {
    return (
      <Shell>
        <EmptyState icon="🔒" text="Không mở được nhóm này." />
      </Shell>
    );
  }

  if (!canAdminOrg(grants, myOrgs?.find((o) => o.slug === org.slug)?.id)) {
    return (
      <Shell>
        <EmptyState
          icon="🔒"
          text="Chỉ quản trị nhóm sửa được thông tin nhóm. Nhắn cho quản trị nếu bạn thấy cần đổi gì."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Form
        name={org.name}
        initial={{
          avatarUrl: org.avatarUrl,
          coverUrl: org.coverUrl,
          description: org.description,
          rules: org.rules,
        }}
        busy={save.isPending}
        onSave={(patch) =>
          save.mutate(patch, {
            onSuccess: () => {
              toast('✓ Đã lưu thông tin nhóm');
              router.back();
            },
            onError: (e: Error) => toast(`⚠️ ${e.message}`),
          })
        }
      />
    </Shell>
  );
}

type Draft = {
  avatarUrl: string | null;
  coverUrl: string | null;
  description: string;
  rules: string[];
};
/** Một dòng nội quy trong form. `id` chỉ sống ở client — xem `rules` trong `<Form>`. */
type Rule = { id: string; text: string };

function Form({
  name,
  initial,
  busy,
  onSave,
}: {
  /** Tên nhóm — chỉ để dựng chữ viết tắt khi chưa có avatar. */
  name: string;
  initial: Draft;
  busy: boolean;
  onSave: (patch: Draft) => void;
}) {
  const toast = useToast();
  const [avatar, setAvatar] = useState(initial.avatarUrl);
  const [cover, setCover] = useState(initial.coverUrl);
  const [desc, setDesc] = useState(initial.description);
  /*
   * Mỗi dòng nội quy mang một `id` riêng, dù dữ liệu gửi đi chỉ là mảng chuỗi.
   *
   * Không dùng chỉ số làm `key`: xoá một dòng ở giữa sẽ dồn chỉ số của mọi dòng sau nó, và
   * React đem state của ô nhập (con trỏ, vùng chọn, bàn phím đang mở) gán sang dòng khác.
   * Cũng không dùng chính nội dung: nó đổi theo từng chữ người dùng gõ, mỗi ký tự là một lần
   * ô nhập bị dựng lại và mất focus.
   */
  const [rules, setRules] = useState<Rule[]>(() =>
    initial.rules.map((text, i) => ({ id: `r${i}`, text })),
  );
  const nextId = useRef(initial.rules.length);
  const [uploading, setUploading] = useState(false);

  /** Upload NGAY khi chọn, đúng cách `AvatarPicker` làm: thấy ảnh mới là biết nó đã lên thật. */
  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('⚠️ Cần quyền truy cập thư viện ảnh');

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      // Ép đúng khổ ảnh bìa ngay lúc chọn: ảnh dọc sẽ bị cắt mất phần trên dưới mà người dùng
      // không kiểm soát được cắt chỗ nào.
      allowsEditing: true,
      aspect: [16, 9],
      // 1, không phải 0.75: bản cắt là một lần encode bắt buộc, nhưng `prepare` (cloudinary.ts)
      // còn encode lần cuối — để lần này gần không mất gì thì ảnh chỉ xuống chất lượng đúng một lần.
      quality: 1,
    });
    if (res.canceled) return;

    setUploading(true);
    try {
      setCover(await uploadImage(res.assets[0].uri));
    } catch (e) {
      toast(`⚠️ ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const setRule = (id: string, text: string) =>
    setRules((list) => list.map((r) => (r.id === id ? { ...r, text } : r)));

  const submit = () => {
    // Bỏ dòng trống TRƯỚC khi gửi: BE từ chối dòng rỗng, mà một dòng người dùng vừa thêm rồi
    // bỏ trống không phải lỗi của họ — đó là ý "tôi đổi ý", nên lặng lẽ bỏ đúng hơn là báo lỗi.
    onSave({
      avatarUrl: avatar,
      coverUrl: cover,
      description: desc.trim(),
      rules: rules.map((r) => r.text.trim()).filter(Boolean),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <FormSection
        title="Ảnh đại diện"
        hint="Hình vuông, hiện ở mọi danh sách nhóm và trên đầu hồ sơ"
      />

      {/*
        Dùng lại `AvatarPicker` của hồ sơ người dùng: nó đã ép cắt vuông ngay lúc chọn và tải
        lên Cloudinary ngay, nên avatar nhóm không phải một bản sao thứ hai của cùng luồng đó.
      */}
      <AvatarPicker
        initials={initialsOf(name)}
        url={avatar ?? undefined}
        onChange={(url) => setAvatar(url)}
      />
      {!!avatar && (
        <Pressable onPress={() => setAvatar(null)} style={styles.avatarRemove}>
          {/* `null` là lệnh GỠ với BE, khác hẳn không gửi field — xem `orgApi.update`. */}
          <Text style={[styles.link, { color: C.pin }]}>Gỡ ảnh đại diện</Text>
        </Pressable>
      )}

      <FormSection title="Ảnh bìa" hint="Khổ ngang, hiện trên đầu hồ sơ nhóm" />

      <Pressable onPress={pickCover} disabled={uploading} style={styles.coverBox}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.coverImg} resizeMode="cover" />
        ) : (
          <View style={[styles.coverImg, styles.coverEmpty]}>
            <Text style={styles.coverEmptyText}>Chưa có ảnh bìa</Text>
          </View>
        )}
        {uploading && (
          <View style={styles.coverBusy}>
            <ActivityIndicator color={C.paper} />
          </View>
        )}
      </Pressable>

      <View style={styles.coverActs}>
        <Pressable onPress={pickCover} disabled={uploading}>
          <Text style={styles.link}>{cover ? 'Đổi ảnh' : 'Chọn ảnh'}</Text>
        </Pressable>
        {/* `null` là lệnh GỠ ảnh với BE, khác hẳn với không gửi field — xem `orgApi.update`. */}
        {!!cover && (
          <Pressable onPress={() => setCover(null)} disabled={uploading}>
            <Text style={[styles.link, { color: C.pin }]}>Gỡ ảnh</Text>
          </Pressable>
        )}
      </View>

      <FormSection title="Giới thiệu nhóm" hint="Người ngoài đọc đoạn này trước khi xin vào" />
      <BoxField
        label="MÔ TẢ"
        value={desc}
        onChangeText={setDesc}
        placeholder="Nhóm mua bán nội bộ của…"
        multiline
        maxLength={MAX_DESC}
        style={styles.multiline}
      />

      <FormSection
        title="Nội quy nhóm"
        hint={`Mỗi dòng một điều, tối đa ${MAX_RULES} dòng. Để trống dòng nào thì dòng đó bị bỏ.`}
      />

      {rules.map((rule, i) => (
        <View key={rule.id} style={styles.ruleRow}>
          <View style={{ flex: 1 }}>
            <BoxField
              label={`ĐIỀU ${i + 1}`}
              value={rule.text}
              onChangeText={(t) => setRule(rule.id, t)}
              placeholder="Không bán hàng giả"
              maxLength={MAX_RULE_LEN}
            />
          </View>
          <Pressable onPress={() => setRules((list) => list.filter((r) => r.id !== rule.id))}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}

      {rules.length < MAX_RULES && (
        <Pressable
          onPress={() => {
            nextId.current += 1;
            setRules((list) => [...list, { id: `r${nextId.current}`, text: '' }]);
          }}
          style={styles.addRule}
        >
          <Text style={styles.addRuleText}>+ Thêm một điều</Text>
        </Pressable>
      )}

      <PinButton
        label="Lưu thông tin nhóm"
        loading={busy}
        // Chặn lúc đang upload: bấm Lưu giữa lúc ảnh chưa lên xong sẽ ghi `coverUrl` cũ, và
        // người dùng thấy ảnh mới trên màn hình nên tin là đã lưu.
        disabled={uploading}
        onPress={submit}
        style={{ marginTop: 22 }}
      />
    </ScrollView>
  );
}

/** `SafeAreaView` chứ không `View`: `ScreenHeader` không tự chừa lề trên — xem docblock của nó. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cork }} edges={['top']}>
      <ScreenHeader title="Sửa thông tin nhóm" />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40 },
  avatarRemove: { alignSelf: 'center', marginTop: -14, marginBottom: 20 },
  coverBox: { borderRadius: 10, overflow: 'hidden' },
  coverImg: { width: '100%', aspectRatio: 16 / 9 },
  coverEmpty: {
    backgroundColor: C.paperWarm,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.corkDark,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmptyText: { fontFamily: F.ui, fontSize: 13, color: C.inkSoft },
  coverBusy: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverActs: { flexDirection: 'row', gap: 20, marginTop: 10, marginBottom: 4 },
  link: { fontFamily: F.uiBold, fontSize: 13, color: C.moss },

  multiline: { minHeight: 88, textAlignVertical: 'top' },

  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remove: { fontFamily: F.uiBold, fontSize: 15, color: C.inkSoft, paddingHorizontal: 4 },
  addRule: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.moss,
    marginTop: 4,
  },
  addRuleText: { fontFamily: F.uiBold, fontSize: 12.5, color: C.moss },
});
