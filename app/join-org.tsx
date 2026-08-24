import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Field, Loading, PinButton, ScreenHeader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import {
  useCancelJoinRequest,
  useMyJoinRequests,
  useOrgByCode,
  useRequestJoin,
} from '@/queries/org';
import type { MyJoinRequest } from '@/api/org';
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
  // Mã tham gia thay cho dropdown tra theo tên: BE đã bỏ `orgSlug` khỏi đơn, vì slug là địa chỉ
  // công khai nên ai đoán được cũng gửi đơn được. Mã do tổ chức phát và xoay lại được.
  const [code, setCode] = useState('');
  const [claimedName, setClaimedName] = useState('');
  const [claimedUnit, setClaimedUnit] = useState('');

  const preview = useOrgByCode(code);
  const org = preview.data ?? null;
  const mine = useMyJoinRequests();
  const requestJoin = useRequestJoin();
  const cancel = useCancelJoinRequest();

  const submit = () => {
    // Chốt trên THẺ ĐÃ TRA ĐƯỢC, không trên chuỗi đang gõ: gõ dở mà gửi thì đơn bay đi trước
    // khi người dùng kịp nhìn tên tổ chức, đúng cái mà bước xem trước sinh ra để tránh.
    if (!org) return toast('Nhập mã tham gia và đợi hiện tên tổ chức đã');
    if (!org.allowJoinRequests) return toast('Tổ chức này đang không nhận đơn');
    if (!claimedName.trim()) return toast('Điền họ tên để tổ chức nhận ra bạn');

    requestJoin.mutate(
      {
        code: code.trim(),
        claimedName: claimedName.trim(),
        claimedUnit: claimedUnit.trim() || undefined,
      },
      {
        onSuccess: () => {
          setCode('');
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
            Xin mã tham gia từ tổ chức rồi dán vào đây. Tên tổ chức sẽ hiện ra để bạn đối chiếu
            trước khi gửi đơn.
          </Text>

          <Field
            label="Mã tham gia"
            value={code}
            onChangeText={setCode}
            placeholder="VD: 7KQ2M9"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {preview.isFetching ? <Loading /> : null}
          {preview.isError ? (
            <Text style={styles.none}>Không có tổ chức nào dùng mã này</Text>
          ) : null}

          {org ? (
            <View style={styles.pickedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickedName}>{org.name}</Text>
                <Text style={styles.pickedWhere}>
                  {org.where || 'Không gắn địa bàn'} · {org.memberCount} thành viên
                </Text>
              </View>
            </View>
          ) : null}

          {org && !org.allowJoinRequests ? (
            <Text style={styles.none}>Tổ chức này đang tạm không nhận đơn</Text>
          ) : null}

          {org?.allowJoinRequests ? (
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
          <EmptyState icon="📮" text="Chưa gửi đơn nào — nhập mã tham gia ở trên để bắt đầu" />
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
  section: { fontFamily: F.hand, fontSize: 22, color: C.ink, marginTop: 8 },
  reqCard: { backgroundColor: C.paperWarm, borderRadius: 10, padding: 14, gap: 4, ...shadow },
  reqName: { fontFamily: F.uiBold, fontSize: 14, color: C.ink },
  reqMeta: { fontFamily: F.ui, fontSize: 12.5, color: C.inkSoft },
  reason: { fontFamily: F.ui, fontSize: 12.5, color: C.pin },
  cancel: { fontFamily: F.uiBold, fontSize: 12.5, color: C.pin, marginTop: 6 },
});
