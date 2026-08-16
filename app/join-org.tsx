import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Field, Loading, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useCancelJoinRequest,
  useMyJoinRequests,
  useOrgLookup,
  useRequestJoin,
} from '@/queries/org';
import type { MyJoinRequest, OrgSuggestion } from '@/api/org';
import { C, F, shadow } from '@/theme';

const STATUS_LABEL: Record<MyJoinRequest['status'], string> = {
  pending: 'Đang chờ duyệt',
  approved: 'Đã được duyệt',
  rejected: 'Bị từ chối',
  expired: 'Hết hiệu lực',
  cancelled: 'Đã rút',
};

export default function JoinOrg() {
  const toast = useToast();
  const [term, setTerm] = useState('');
  // Tổ chức đã XÁC NHẬN, tách khỏi chuỗi đang gõ: chừng nào chưa bấm chọn một dòng cụ thể thì
  // chưa có tổ chức nào cả. Đây là chốt chống "gõ gần đúng rồi đơn chạy sang tổ chức khác".
  const [picked, setPicked] = useState<OrgSuggestion | null>(null);
  const [claimedName, setClaimedName] = useState('');
  const [claimedUnit, setClaimedUnit] = useState('');

  const lookup = useOrgLookup(picked ? '' : term);
  const mine = useMyJoinRequests();
  const requestJoin = useRequestJoin();
  const cancel = useCancelJoinRequest();

  const submit = () => {
    if (!picked) return toast('Chọn tổ chức từ danh sách gợi ý trước đã');
    if (!claimedName.trim()) return toast('Điền họ tên để chủ tổ chức nhận ra bạn');

    requestJoin.mutate(
      {
        orgSlug: picked.slug,
        claimedName: claimedName.trim(),
        claimedUnit: claimedUnit.trim() || undefined,
      },
      {
        onSuccess: () => {
          setPicked(null);
          setTerm('');
          setClaimedName('');
          setClaimedUnit('');
          toast('Đã gửi đơn, chờ tổ chức duyệt nhé');
        },
        onError: (e: Error) => toast(e.message),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.cork }}>
      <ScreenHeader title="Tham gia tổ chức" />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.hint}>
            Gõ tên hoặc mã tổ chức, rồi chọn đúng dòng trong danh sách. Nhiều tổ chức trùng tên
            nhau nên phần địa bàn là thứ để phân biệt.
          </Text>

          {picked ? (
            <Pressable style={styles.pickedRow} onPress={() => setPicked(null)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickedName}>{picked.name}</Text>
                <Text style={styles.pickedWhere}>{picked.where || 'Không gắn địa bàn'}</Text>
              </View>
              <Text style={styles.change}>Đổi</Text>
            </Pressable>
          ) : (
            <>
              <Field
                label="Tên hoặc mã tổ chức"
                value={term}
                onChangeText={setTerm}
                placeholder="Lý Thường Kiệt"
              />
              {lookup.isFetching ? <Loading /> : null}
              {lookup.data?.map((org) => (
                <Pressable
                  key={org.slug}
                  style={styles.suggestion}
                  onPress={() => {
                    if (!org.allowJoinRequests) return toast('Tổ chức này đang không nhận đơn');
                    setPicked(org);
                  }}
                >
                  <Text style={styles.suggestionName}>{org.name}</Text>
                  <Text style={styles.suggestionWhere}>
                    {org.where || 'Không gắn địa bàn'} · {org.slug}
                  </Text>
                </Pressable>
              ))}
              {lookup.data?.length === 0 ? (
                <Text style={styles.none}>Không có tổ chức nào khớp</Text>
              ) : null}
            </>
          )}

          {picked ? (
            <>
              <Field
                label="Họ tên của bạn"
                value={claimedName}
                onChangeText={setClaimedName}
                placeholder="Nguyễn Văn A"
              />
              <Field
                label="Lớp / phòng ban (nếu có)"
                value={claimedUnit}
                onChangeText={setClaimedUnit}
                placeholder="10A1"
              />
              <PinButton
                label="Gửi đơn"
                onPress={submit}
                loading={requestJoin.isPending}
                style={{ marginTop: 8 }}
              />
            </>
          ) : null}
        </View>

        <Text style={styles.section}>Đơn của tôi</Text>

        {mine.isLoading ? <Loading /> : null}
        {mine.data?.length === 0 ? (
          <EmptyState icon="📮" text="Chưa gửi đơn nào — tìm tổ chức ở trên để bắt đầu" />
        ) : null}

        {mine.data?.map((req) => (
          <View key={req.id} style={styles.reqCard}>
            <Text style={styles.reqName}>{req.claimedName}</Text>
            <Text style={styles.reqMeta}>
              {STATUS_LABEL[req.status]}
              {req.claimedUnit ? ` · ${req.claimedUnit}` : ''}
            </Text>
            {req.rejectReason ? <Text style={styles.reason}>Lý do: {req.rejectReason}</Text> : null}
            {req.status === 'pending' ? (
              <Pressable
                onPress={() =>
                  cancel.mutate(req.id, { onError: (e: Error) => toast(e.message) })
                }
              >
                <Text style={styles.cancel}>Rút đơn</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, paddingBottom: 40, gap: 14 },
  card: { backgroundColor: C.paperWarm, borderRadius: 10, padding: 18, gap: 4, ...shadow },
  hint: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft, marginBottom: 10, lineHeight: 18 },
  suggestion: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  suggestionName: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  suggestionWhere: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  none: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft, paddingVertical: 10 },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cork,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pickedName: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  pickedWhere: { fontFamily: F.ui, fontSize: 12, color: C.inkSoft, marginTop: 2 },
  change: { fontFamily: F.uiBold, fontSize: 12.5, color: C.pin },
  section: { fontFamily: F.hand, fontSize: 22, color: C.ink, marginTop: 8 },
  reqCard: { backgroundColor: C.paperWarm, borderRadius: 10, padding: 14, gap: 4, ...shadow },
  reqName: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  reqMeta: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft },
  reason: { fontFamily: F.ui, fontSize: 12.5, color: C.pin },
  cancel: { fontFamily: F.uiBold, fontSize: 12.5, color: C.pin, marginTop: 6 },
});
