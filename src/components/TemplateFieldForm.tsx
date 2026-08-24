import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdminChip, AdminPickerField, adminFormStyles } from '@/components/AdminPicker';
import { AdminSwitch } from '@/components/AdminScreen';
import { Field, PinButton } from '@/components/ui';
import { KEY_PATTERN } from '@/api/templates';
import type { DraftField, FieldDefinition, FieldType } from '@/api/templates';
import { C, F } from '@/theme';

/**
 * Thêm một field vào bản nháp template. Hai lối vào, cùng một form:
 *
 * 1. **Chọn từ từ điển** — field đã có định nghĩa, chỉ cần đặt bắt buộc/mở lọc.
 * 2. **Tạo mới** — gõ khoá, nhãn, kiểu. BE nhận định nghĩa kèm ngay trong payload template
 *    (`define`), nên không phải gọi thêm một vòng tạo field rồi mới gắn vào.
 *
 * Tách khỏi route vì route đã gánh danh sách field + phát hành, mà trần LOC của route là 250.
 */

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Chữ' },
  { value: 'textarea', label: 'Đoạn văn' },
  { value: 'number', label: 'Số' },
  { value: 'select', label: 'Chọn một' },
  { value: 'multiselect', label: 'Chọn nhiều' },
  { value: 'boolean', label: 'Có / không' },
  { value: 'year', label: 'Năm' },
];

export function TemplateFieldForm({
  dictionary,
  used,
  loading,
  onAdd,
}: {
  dictionary: FieldDefinition[];
  /** Khoá đã nằm trong bản nháp — lọc khỏi bộ chọn để không thêm trùng. */
  used: string[];
  loading?: boolean;
  onAdd: (field: DraftField) => void;
}) {
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [required, setRequired] = useState(false);
  const [filterable, setFilterable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = dictionary
    .filter((d) => !used.includes(d.key))
    .map((d) => ({ key: d.key, label: d.label, note: d.key }));

  const reset = () => {
    setPickedKey(null);
    setKey('');
    setLabel('');
    setType('text');
    setRequired(false);
    setFilterable(false);
    setError(null);
  };

  const submit = () => {
    if (mode === 'pick') {
      const def = dictionary.find((d) => d.key === pickedKey);
      if (!def) return setError('Chọn một field trong từ điển trước đã');
      // Nhãn lấy nguyên từ từ điển: sửa nhãn ở đây sẽ thành `override`, và đó là việc của dòng
      // trong danh sách chứ không phải của ô thêm mới.
      onAdd({
        key: def.key,
        label: def.label,
        type: def.type,
        required,
        filterable,
        isNew: false,
      });
      return reset();
    }

    const trimmed = key.trim();
    if (!KEY_PATTERN.test(trimmed)) {
      return setError('Khoá bắt đầu bằng chữ thường, chỉ gồm chữ và số, không dấu');
    }
    if (used.includes(trimmed)) return setError(`Khoá "${trimmed}" đã có trong template`);
    if (!label.trim()) return setError('Nhập nhãn hiển thị');

    onAdd({ key: trimmed, label: label.trim(), type, required, filterable, isNew: true });
    reset();
  };

  return (
    <View>
      <Text style={adminFormStyles.label}>THÊM FIELD</Text>
      <View style={[adminFormStyles.chips, styles.modes]}>
        <AdminChip
          label="Từ từ điển"
          on={mode === 'pick'}
          onPress={() => {
            setMode('pick');
            setError(null);
          }}
        />
        <AdminChip
          label="Tạo mới"
          on={mode === 'new'}
          onPress={() => {
            setMode('new');
            setError(null);
          }}
        />
      </View>

      {mode === 'pick' ? (
        <AdminPickerField
          label="FIELD CÓ SẴN"
          title="Chọn field"
          placeholder={available.length ? 'Chạm để chọn' : 'Từ điển đã dùng hết'}
          items={available}
          loading={loading}
          value={pickedKey}
          onChange={setPickedKey}
        />
      ) : (
        <>
          <Field
            onDark
            label="Khoá"
            value={key}
            onChangeText={setKey}
            placeholder="doChaiPin"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field onDark label="Nhãn hiển thị" value={label} onChangeText={setLabel} placeholder="Độ chai pin" />
          <Text style={adminFormStyles.label}>KIỂU DỮ LIỆU</Text>
          <View style={[adminFormStyles.chips, styles.modes]}>
            {TYPES.map((t) => (
              <AdminChip
                key={t.value}
                label={t.label}
                on={type === t.value}
                onPress={() => setType(t.value)}
              />
            ))}
          </View>
        </>
      )}

      <Pressable style={styles.toggle} onPress={() => setRequired(!required)}>
        <Text style={styles.toggleLabel}>Bắt buộc điền</Text>
        <AdminSwitch value={required} onChange={() => setRequired(!required)} />
      </Pressable>
      <Pressable style={styles.toggle} onPress={() => setFilterable(!filterable)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Cho lọc trên bảng tin</Text>
          <Text style={adminFormStyles.hint}>Mỗi field lọc là một nhánh index — BE cho tối đa 8.</Text>
        </View>
        <AdminSwitch value={filterable} onChange={() => setFilterable(!filterable)} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PinButton label="Thêm vào bản nháp" onPress={submit} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { marginBottom: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggleLabel: { fontFamily: F.uiBold, fontSize: 13, color: C.deskTxt },
  error: { fontFamily: F.ui, fontSize: 12, color: C.pin, marginTop: 8 },
});
