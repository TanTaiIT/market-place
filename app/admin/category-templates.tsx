import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPanel, AdminScreen, AdminSwitch } from '@/components/AdminScreen';
import { AdminPickerField, AdminSmallBtn, adminFormStyles } from '@/components/AdminPicker';
import { TemplateFieldForm } from '@/components/TemplateFieldForm';
import { EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminCategories } from '@/queries/admin-content';
import {
  useCategoryTemplate,
  useCreateTemplateDraft,
  useFieldDefinitions,
  usePublishTemplate,
  useTemplateDraft,
  useUpdateTemplateDraft,
} from '@/queries/templates';
import { MAX_FILTERABLE, toDraft, validateDraft } from '@/api/templates';
import type { DraftField } from '@/api/templates';
import { C, F } from '@/theme';

/**
 * Soạn template thuộc tính cho một danh mục — bộ field động của form đăng tin.
 *
 * Vòng đời BE ép: nháp → phát hành, và **bản đã phát hành là bất biến**. Tin đăng ghim
 * `templateRef.version` để form sửa tin dựng lại đúng bộ field lúc tin ra đời, nên sửa bản cũ
 * sẽ khiến tin cũ đột nhiên mang field chưa từng tồn tại với chúng. Muốn đổi thì tạo nháp mới.
 *
 * Chỉ master — cùng cửa với màn Danh mục, vì template là từ điển toàn hệ thống.
 */
export default function AdminCategoryTemplates() {
  const toast = useToast();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [dirty, setDirty] = useState(false);

  const categories = useAdminCategories();
  const dictionary = useFieldDefinitions();
  const published = useCategoryTemplate(categoryId ?? '');
  const draft = useTemplateDraft(published.data, categoryId ?? '');

  const create = useCreateTemplateDraft();
  const update = useUpdateTemplateDraft();
  const publish = usePublishTemplate();

  // Giữ nguyên `undefined` thay vì `?? []` ngay tại đây: mảng rỗng là một tham chiếu MỚI mỗi
  // render, mà nó nằm trong deps của effect bên dưới — effect sẽ `setFields` mỗi vòng và kéo
  // theo một vòng render nữa, không dừng. `dictionary.data` thì TanStack giữ ổn định.
  const defs = dictionary.data;
  const current = draft.data ?? published.data ?? null;
  const draftVersion = draft.data?.version ?? null;
  const busy = create.isPending || update.isPending || publish.isPending;
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  /*
   * Nạp lại danh sách sửa được mỗi khi đổi danh mục hoặc BE trả bản mới.
   *
   * `dirty` chặn ghi đè: không có nó thì mỗi lần `invalidateQueries` sau một lượt lưu, hoặc mỗi
   * lần refetch nền, các thay đổi chưa lưu của người soạn biến mất giữa chừng.
   */
  useEffect(() => {
    if (dirty || !current || !defs) return;
    setFields(toDraft(current.fields, defs));
  }, [current, defs, dirty]);

  const patch = (i: number, next: Partial<DraftField>) => {
    setDirty(true);
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...next } : f)));
  };

  const move = (i: number, by: -1 | 1) => {
    const to = i + by;
    if (to < 0 || to >= fields.length) return;
    setDirty(true);
    setFields((prev) => {
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });
  };

  const save = () => {
    if (!categoryId) return;
    const problem = validateDraft(fields);
    if (problem) return toast(`⚠️ ${problem}`);

    const done = { onSuccess: () => { setDirty(false); toast('Đã lưu bản nháp'); }, onError: fail };
    if (draftVersion != null) {
      update.mutate({ categoryId, version: draftVersion, fields, dictionary: defs ?? [] }, done);
    } else {
      create.mutate({ categoryId, fields, dictionary: defs ?? [] }, done);
    }
  };

  const filterable = fields.filter((f) => f.filterable).length;

  return (
    <AdminScreen title="Mẫu thuộc tính" note="bộ field của form đăng tin, theo từng danh mục">
      <ScrollView contentContainerStyle={styles.body}>
        <AdminPanel title="Danh mục">
          <AdminPickerField
            label="ĐANG SOẠN CHO"
            title="Chọn danh mục"
            placeholder="Chạm để chọn"
            items={(categories.data ?? []).map((c) => ({ key: c.id, label: c.name }))}
            loading={categories.isLoading}
            value={categoryId}
            onChange={(id) => {
              setCategoryId(id);
              setDirty(false);
              setFields([]);
            }}
          />
          {current ? (
            <Text style={adminFormStyles.hint}>
              {draftVersion != null
                ? `Đang sửa bản nháp v${draftVersion}. Bản đang chạy: v${published.data?.version}.`
                : published.data?.isFallback
                  ? 'Danh mục này đang dùng bản CHUNG. Lưu lần đầu sẽ tạo bản riêng v1.'
                  : `Bản đang chạy v${published.data?.version} đã phát hành nên không sửa được — lưu sẽ tạo nháp mới.`}
            </Text>
          ) : null}
        </AdminPanel>

        {!categoryId ? (
          <EmptyState icon="🗂" text="Chọn một danh mục để xem và sửa bộ field của nó" />
        ) : published.isLoading || draft.isLoading ? (
          <Loading onDark />
        ) : (
          <>
            <AdminPanel title="Field trong mẫu" note={`${fields.length} field · ${filterable}/${MAX_FILTERABLE} mở lọc`}>
              {fields.length === 0 ? (
                <Text style={adminFormStyles.hint}>Chưa có field nào — thêm ở panel dưới.</Text>
              ) : (
                fields.map((f, i) => (
                  <View key={f.key} style={styles.row}>
                    <View style={styles.rowHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowLabel}>
                          {f.label}
                          {f.isNew ? <Text style={styles.badge}>  MỚI</Text> : null}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {f.key} · {f.type}
                          {f.showIf ? ` · hiện khi ${f.showIf.key}` : ''}
                        </Text>
                      </View>
                      <AdminSmallBtn label="↑" onPress={() => move(i, -1)} />
                      <AdminSmallBtn label="↓" onPress={() => move(i, 1)} />
                      <AdminSmallBtn
                        label="Gỡ"
                        onPress={() => {
                          setDirty(true);
                          setFields((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                      />
                    </View>
                    <Pressable style={styles.toggle} onPress={() => patch(i, { required: !f.required })}>
                      <Text style={styles.toggleLabel}>Bắt buộc</Text>
                      <AdminSwitch value={f.required} onChange={() => patch(i, { required: !f.required })} />
                    </Pressable>
                    <Pressable style={styles.toggle} onPress={() => patch(i, { filterable: !f.filterable })}>
                      <Text style={styles.toggleLabel}>Cho lọc</Text>
                      <AdminSwitch value={f.filterable} onChange={() => patch(i, { filterable: !f.filterable })} />
                    </Pressable>
                  </View>
                ))
              )}

              <PinButton
                label={draftVersion != null ? 'Lưu bản nháp' : 'Tạo bản nháp'}
                onPress={save}
                loading={busy}
                style={{ marginTop: 12 }}
              />
              {draftVersion != null ? (
                <>
                  <AdminSmallBtn
                    label={dirty ? 'Lưu trước khi phát hành' : `Phát hành v${draftVersion}`}
                    onPress={() =>
                      dirty
                        ? toast('⚠️ Còn thay đổi chưa lưu')
                        : publish.mutate(
                            { categoryId, version: draftVersion },
                            { onSuccess: () => toast(`Đã phát hành v${draftVersion}`), onError: fail },
                          )
                    }
                  />
                  <Text style={adminFormStyles.limit}>
                    Phát hành xong bản này KHÔNG sửa được nữa: tin đăng ghim số version để dựng lại
                    đúng form lúc chúng ra đời.
                  </Text>
                </>
              ) : null}
            </AdminPanel>

            <AdminPanel title="Thêm field">
              <TemplateFieldForm
                dictionary={defs ?? []}
                used={fields.map((f) => f.key)}
                loading={dictionary.isLoading}
                onAdd={(f) => {
                  setDirty(true);
                  setFields((prev) => [...prev, f]);
                }}
              />
            </AdminPanel>
          </>
        )}
      </ScrollView>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 48, gap: 14 },
  row: {
    borderTopWidth: 1,
    borderTopColor: C.deskLine,
    paddingTop: 12,
    marginTop: 12,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontFamily: F.uiBold, fontSize: 13.5, color: C.deskTxt },
  badge: { fontFamily: F.mono, fontSize: 9.5, color: C.amber, letterSpacing: 1 },
  rowMeta: { fontFamily: F.mono, fontSize: 10.5, color: C.deskTxtDim, marginTop: 3 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  toggleLabel: { flex: 1, fontFamily: F.ui, fontSize: 12.5, color: C.deskTxtDim },
});
