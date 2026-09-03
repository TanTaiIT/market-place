import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reorderItems, type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { Surface } from '@/components/Surface';
import { TemplateCategoryBar } from '@/components/TemplateCategoryBar';
import { TemplateFieldList } from '@/components/TemplateFieldList';
import { TemplatePreview } from '@/components/TemplatePreview';
import { TemplateSaveBar } from '@/components/TemplateSaveBar';
import { EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useAdminCategories } from '@/queries/admin-content';
import {
  useCreateTemplateDraft,
  useFieldDefinitions,
  usePublishTemplate,
  useTemplateDraft,
  useTemplatePublished,
  useUpdateTemplateDraft,
} from '@/queries/templates';
import { deriveKey, nextUid, toDraft, validateDraft } from '@/api/templates';
import type { CategoryTemplate, DraftField, TemplateTarget } from '@/api/templates';

/** Thuộc tính mới: kiểu chữ, không bắt buộc, không cho lọc — mức an toàn nhất để bắt đầu. */
const blankField = (): DraftField => ({
  uid: nextUid(),
  key: '',
  label: '',
  type: 'text',
  required: false,
  filterable: false,
  options: [],
  isNew: true,
});

/**
 * Soạn template thuộc tính — cho một danh mục, hoặc cho MẪU MẶC ĐỊNH.
 *
 * Vòng đời BE ép: nháp → phát hành, và **bản đã phát hành là bất biến**. Tin đăng ghim
 * `templateRef.version` để form sửa tin dựng lại đúng bộ field lúc tin ra đời, nên sửa bản cũ
 * sẽ khiến tin cũ đột nhiên mang field chưa từng tồn tại với chúng. Muốn đổi thì tạo nháp mới.
 *
 * Một nút "Lưu template" như bản thiết kế, nhưng nó KHÔNG âm thầm phát hành: lưu nháp xong mới
 * hỏi, vì phát hành không lùi lại được và người soạn phải nghe điều đó đúng lúc quyết.
 *
 * Nền giấy sáng chứ không phải nền `desk` của `AdminScreen`: bản thiết kế vẽ nó như một route
 * thường, và đây là màn soạn nội dung dài. Đổi lại là mất thanh điều hướng quản trị — đường ra
 * là nút ← của `ScreenHeader`.
 *
 * Chỉ master — cùng cửa với màn Danh mục, vì template là từ điển toàn hệ thống.
 */
export default function AdminCategoryTemplates() {
  const toast = useToast();
  const [target, setTarget] = useState<TemplateTarget | null>(null);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);

  const categories = useAdminCategories();
  const dictionary = useFieldDefinitions();
  const published = useTemplatePublished(target);
  const draft = useTemplateDraft(published.data, target);

  const create = useCreateTemplateDraft();
  const update = useUpdateTemplateDraft();
  const publish = usePublishTemplate();

  // Giữ nguyên `undefined` thay vì `?? []` ngay tại đây: mảng rỗng là một tham chiếu MỚI mỗi
  // render, mà nó nằm trong deps của effect bên dưới — effect sẽ `setFields` mỗi vòng và kéo
  // theo một vòng render nữa, không dừng. `dictionary.data` thì TanStack giữ ổn định.
  const defs = dictionary.data;
  const current = draft.data ?? published.data ?? null;
  const draftVersion = draft.data?.version ?? null;
  const liveVersion = published.data?.version ?? 0;
  const busy = create.isPending || update.isPending || publish.isPending;
  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  /*
   * Nạp lại danh sách sửa được mỗi khi đổi mục tiêu hoặc BE trả bản mới.
   *
   * `dirty` chặn ghi đè: không có nó thì mỗi lần `invalidateQueries` sau một lượt lưu, hoặc mỗi
   * lần refetch nền, các thay đổi chưa lưu của người soạn biến mất giữa chừng.
   *
   * Danh mục chưa có template riêng thì `current` là MẪU MẶC ĐỊNH (`isFallback`) — nạp field
   * của nó làm điểm bắt đầu, đúng ý "chưa có template thì phải có sẵn một mẫu để áp".
   */
  useEffect(() => {
    if (dirty || !current || !defs) return;
    setFields(toDraft(current.fields, defs));
  }, [current, defs, dirty]);

  const patch = (i: number, next: Partial<DraftField>) => {
    setDirty(true);
    setFields((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f;
        const merged = { ...f, ...next };
        if (next.label === undefined || !f.isNew) return merged;

        // Khoá sinh lại theo nhãn, và CHỈ khi field còn mới: khoá đã có trong từ điển là khoá
        // của mọi danh mục đang dùng nó, đổi ở đây là đổi cho người khác.
        const key = deriveKey(
          merged.label,
          prev.filter((_, k) => k !== i).map((x) => x.key),
        );
        const known = defs?.find((d) => d.key === key);
        // Khoá vừa sinh đã có trong từ điển → nhận luôn field đó thay vì khai một định nghĩa
        // thứ hai: BE từ chối "một khoá không được mang hai kiểu", mà đây cũng là điều đúng —
        // cùng tên thì nên là cùng field, dùng lại cả kiểu và lựa chọn của nó.
        return known
          ? { ...merged, key, isNew: false, type: known.type, options: known.options }
          : { ...merged, key, isNew: true };
      }),
    );
  };

  const reorder = ({ from, to }: ReorderableListReorderEvent) => {
    setDirty(true);
    // `reorderItems` của thư viện chứ không tự cắt mảng: nó DỊCH cả đoạn giữa hai vị trí, khác
    // hẳn phép đổi chỗ hai phần tử — đổi chỗ thì kéo thẻ đầu xuống cuối sẽ ném thẻ cuối lên đầu.
    setFields((prev) => reorderItems(prev, from, to));
  };

  /** Phát hành là bước không lùi được, nên nó là một câu hỏi chứ không phải một hệ quả. */
  const askPublish = (version: number) =>
    Alert.alert(
      `Đã lưu nháp v${version}`,
      target?.kind === 'default'
        ? `Phát hành ngay? MỌI danh mục chưa có template riêng sẽ dùng bản này ngay lập tức, và sau khi phát hành thì nó KHÔNG sửa được nữa.`
        : 'Phát hành ngay? Sau khi phát hành, bản này KHÔNG sửa được nữa — tin đăng ghim số version để dựng lại đúng form lúc chúng ra đời.',
      [
        { text: 'Để nháp', style: 'cancel' },
        {
          text: 'Phát hành',
          onPress: () =>
            target &&
            publish.mutate(
              { target, version },
              { onSuccess: () => toast(`✓ Đã phát hành v${version}`), onError: fail },
            ),
        },
      ],
    );

  const save = () => {
    if (!target) return;
    const problem = validateDraft(fields);
    if (problem) return toast(`⚠️ ${problem}`);

    const done = {
      onSuccess: (tpl: CategoryTemplate) => {
        setDirty(false);
        askPublish(tpl.version);
      },
      onError: fail,
    };
    const input = { target, fields, dictionary: defs ?? [] };
    if (draftVersion != null) update.mutate({ ...input, version: draftVersion }, done);
    else create.mutate(input, done);
  };

  const status = !target
    ? undefined
    : draftVersion != null
      ? `Đang sửa nháp v${draftVersion} · bản đang chạy v${liveVersion}`
      : target.kind === 'default'
        ? liveVersion === 0
          ? 'Chưa có mẫu mặc định nào — lưu là tạo v1, và mọi danh mục chưa có template riêng sẽ dùng nó.'
          : `Mẫu mặc định đang chạy v${liveVersion} — sửa nó là sửa form của MỌI danh mục chưa có template riêng.`
        : published.data?.isFallback
          ? 'Danh mục này đang dùng MẪU MẶC ĐỊNH — field dưới đây nạp từ mẫu đó, lưu là tạo bản riêng v1.'
          : `Bản đang chạy v${liveVersion} đã phát hành nên bất biến — lưu sẽ tạo nháp mới.`;

  return (
    <Surface>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ScreenHeader title="Tạo template danh mục" />

        <TemplateCategoryBar
          categories={categories.data ?? []}
          value={target}
          status={status}
          onChange={(next) => {
            setTarget(next);
            setDirty(false);
            setFields([]);
          }}
        />

        {!target ? (
          <EmptyState icon="🗂" text="Chọn một danh mục để xem và sửa bộ thuộc tính của nó" />
        ) : published.isLoading || draft.isLoading ? (
          <Loading />
        ) : (
          <TemplateFieldList
            fields={fields}
            onPatch={patch}
            onReorder={reorder}
            onRemove={(i) => {
              setDirty(true);
              setFields((prev) => prev.filter((_, idx) => idx !== i));
            }}
            onAdd={() => {
              setDirty(true);
              setFields((prev) => [...prev, blankField()]);
            }}
          />
        )}

        {!!target && (
          <TemplateSaveBar busy={busy} onPreview={() => setPreview(true)} onSave={save} />
        )}

        <TemplatePreview
          visible={preview}
          fields={fields}
          dictionary={defs ?? []}
          onClose={() => setPreview(false)}
        />
      </SafeAreaView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
