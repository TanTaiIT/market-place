import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminFilter, AdminPanel, AdminScreen } from '@/components/AdminScreen';
import { EmptyState, Loading, PinButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApproveKyc, useKycDetail, useKycQueue, useRejectKyc } from '@/queries/kyc';
import { useMyGrants } from '@/queries/admin';
import { isMaster } from '@/api/admin';
import type { KycStatus } from '@/api/kyc';
import { C, F } from '@/theme';

/**
 * BÀN DUYỆT ĐỊNH DANH — màn TẠM THỜI cho vòng kiểm duyệt của Bộ Công Thương.
 *
 * Gỡ về sau: xoá file này, một mục trong `AdminNav.GROUPS`, và ba file của lớp phủ KYC.
 *
 * Không có nó thì bật `KYC_REQUIRED` là mọi tài khoản mới kẹt vĩnh viễn ở màn "chờ duyệt" —
 * BE có đủ bốn endpoint master từ đầu, nhưng không màn nào gọi tới.
 */
const TABS = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
];

export default function AdminKyc() {
  const toast = useToast();
  const master = isMaster(useMyGrants().data);
  const [status, setStatus] = useState<KycStatus>('pending');
  /** Hồ sơ đang mở. `null` = đóng, và chính nó là thứ bật query chi tiết — không có cờ thứ hai. */
  const [openId, setOpenId] = useState<string | null>(null);

  const queue = useKycQueue(status, master);
  const detail = useKycDetail(openId);
  const approve = useApproveKyc();
  const reject = useRejectKyc();

  const fail = (e: Error) => toast(`⚠️ ${e.message}`);

  const confirmReject = (id: string, name: string) =>
    /*
     * `Alert.prompt` chỉ có trên iOS, nên lý do từ chối dùng một bộ chọn cố định thay vì ô gõ
     * tự do: nó chạy ở cả hai nền, và ba lý do dưới đây phủ gần hết ca thật. Người duyệt cần
     * câu khác thì gõ trong chat hỗ trợ — bàn này không phải chỗ soạn văn bản.
     */
    Alert.alert(`Từ chối hồ sơ của ${name}?`, 'Chọn lý do — người nộp sẽ đọc được và nộp lại.', [
      { text: 'Thôi', style: 'cancel' },
      ...REASONS.map((reason) => ({
        text: reason,
        onPress: () =>
          reject.mutate(
            { id, reason },
            { onSuccess: () => { setOpenId(null); toast('✓ Đã từ chối'); }, onError: fail },
          ),
      })),
    ]);

  return (
    <AdminScreen title="Định danh" note="hồ sơ người bán chờ duyệt" org="optional">
      <AdminFilter options={TABS} value={status} onChange={(v) => setStatus(v as KycStatus)} />

      <ScrollView contentContainerStyle={styles.body}>
        {!master ? (
          <EmptyState icon="🔒" onDark text="Chỉ master duyệt được hồ sơ định danh" />
        ) : queue.isLoading ? (
          <Loading onDark />
        ) : queue.error ? (
          <EmptyState icon="📡" onDark text={(queue.error as Error).message} />
        ) : (queue.data ?? []).length === 0 ? (
          <EmptyState icon="✅" onDark text="Không có hồ sơ nào ở trạng thái này" />
        ) : (
          (queue.data ?? []).map((row) => (
            <AdminPanel
              key={row.id}
              title={row.fullName}
              note={row.subjectType === 'company' ? 'Tổ chức' : 'Cá nhân'}
            >
              {row.subjectType === 'company' && (
                <Text style={styles.line}>
                  {row.companyName} · MST {row.companyTaxCode}
                </Text>
              )}
              <Text style={styles.line}>Ngày sinh {row.birthDate}</Text>
              {!!row.rejectReason && <Text style={styles.bad}>Đã từ chối: {row.rejectReason}</Text>}

              {/*
                Số định danh KHÔNG nằm sẵn trong danh sách — phải bấm "Xem" mới tải về. Của N
                người nằm sẵn trong bộ nhớ app chỉ vì ai đó mở bàn duyệt là thừa và rủi ro.
              */}
              {openId === row.id ? (
                <View style={styles.detail}>
                  {detail.isLoading ? (
                    <Loading onDark />
                  ) : (
                    <>
                      <Text style={styles.id}>CCCD {detail.data?.idNumber ?? '—'}</Text>
                      <Text style={styles.line}>
                        {detail.data?.accountName} · {detail.data?.accountEmail}
                      </Text>
                      {row.subjectType === 'company' && (
                        <Text style={styles.line}>{row.companyAddress}</Text>
                      )}
                    </>
                  )}
                </View>
              ) : null}

              <View style={styles.actions}>
                <Pressable onPress={() => setOpenId(openId === row.id ? null : row.id)}>
                  <Text style={styles.link}>{openId === row.id ? 'Thu gọn' : 'Xem định danh'}</Text>
                </Pressable>
                {status !== 'rejected' && (
                  <Pressable onPress={() => confirmReject(row.id, row.fullName)}>
                    <Text style={styles.reject}>Từ chối</Text>
                  </Pressable>
                )}
              </View>

              {status !== 'approved' && (
                <PinButton
                  label="Duyệt hồ sơ"
                  loading={approve.isPending}
                  onPress={() =>
                    approve.mutate(row.id, {
                      onSuccess: () => { setOpenId(null); toast('✓ Đã duyệt'); },
                      onError: fail,
                    })
                  }
                />
              )}
            </AdminPanel>
          ))
        )}
      </ScrollView>
    </AdminScreen>
  );
}

/** Ba lý do phủ gần hết ca thật — xem ghi chú ở `confirmReject`. */
const REASONS = [
  'Thông tin không khớp giấy tờ',
  'Số định danh không hợp lệ',
  'Thiếu thông tin tổ chức',
];

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  line: { fontFamily: F.ui, fontSize: 12.5, color: C.deskTxtSoft, marginTop: 2 },
  bad: { fontFamily: F.ui, fontSize: 12, color: C.badText, marginTop: 4 },
  detail: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: C.deskRaise,
    borderWidth: 1,
    borderColor: C.deskLine,
  },
  id: { fontFamily: F.monoBold, fontSize: 14, color: C.deskTxt, letterSpacing: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 },
  link: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.mossBright },
  reject: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.badText },
});
