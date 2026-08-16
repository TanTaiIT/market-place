import { StyleSheet, Text, View } from 'react-native';
import { TapeChip } from '@/components/ui';
import { useOrgSlug } from '@/stores/auth';
import { C, F } from '@/theme';

export type PostVisibility = 'org_internal' | 'public';

/**
 * Chọn nơi tin sẽ hiển thị — và qua đó là chọn AI DUYỆT nó.
 *
 * Đây không phải một tuỳ chọn hiển thị thuần tuý: BE định tuyến hàng đợi theo chính giá trị
 * này (tin công khai về manager danh mục theo tỉnh, tin nội bộ về tổ chức). Vì vậy màn hình
 * phải nói rõ hệ quả ngay dưới nút chọn, không để người dùng đoán vì sao tin của mình lại do
 * người lạ duyệt.
 *
 * Tự đọc tổ chức đang chọn từ store thay vì nhận qua props: nếu chưa thuộc tổ chức nào thì
 * "trong tổ chức" không phải một lựa chọn hợp lệ, và đó là việc của chính component này biết.
 */
export function VisibilityPicker({
  value,
  onChange,
}: {
  value: PostVisibility;
  onChange: (next: PostVisibility) => void;
}) {
  const activeOrg = useOrgSlug();

  return (
    <>
      <Text style={styles.label}>Đăng ở đâu</Text>
      <View style={styles.row}>
        {activeOrg ? (
          <TapeChip
            label="Trong tổ chức"
            active={value === 'org_internal'}
            onPress={() => onChange('org_internal')}
          />
        ) : null}
        <TapeChip
          label="Bảng tin công khai"
          active={value === 'public'}
          index={1}
          onPress={() => onChange('public')}
        />
      </View>
      <Text style={styles.note}>
        {value === 'public'
          ? 'Tin công khai do người phụ trách danh mục tại tỉnh của bạn duyệt — nhớ chọn tỉnh bên dưới.'
          : 'Tin nội bộ chỉ hiển thị trong tổ chức, do chính tổ chức duyệt.'}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.inkSoft, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { fontFamily: F.ui, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 17 },
});
