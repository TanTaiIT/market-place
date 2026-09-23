import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import type { CatShare, TrendPoint } from '@/api/admin';
import { C, F } from '@/theme';

/**
 * Ba hình vẽ của màn tổng quan. Gom một file vì cùng một việc — đọc số ra hình — và cả ba
 * đều chỉ nhận mảng số, không biết gì về domain.
 *
 * Toạ độ tính trong viewBox cố định rồi để `width="100%"` co giãn: RN không có `vw`, mà đo
 * bề rộng bằng `onLayout` thì mỗi lần xoay máy lại vẽ lại một nhịp.
 */

/** Chia cho `length - 1`; kẹp sàn 1 để mảng một phần tử không cho ra NaN trong path. */
const stepOf = (length: number) => Math.max(1, length - 1);

/**
 * MẢNG RỖNG LÀ MỘT ĐẦU VÀO HỢP LỆ, và phải chặn ở NGAY ĐẦU mỗi hình.
 *
 * Không phải phòng thủ thừa: `/moderation/overview` dựng `trend` bằng một `$group` theo ngày,
 * nên nhóm chưa có tin nào trả về `[]`. Lúc đó `TrendChart` ghép ra chuỗi path mở đầu bằng
 * `L` thay vì `M` (` L-490 170 L30 170 Z`) — và RNSVGPathParser ném `UnexpectedData` ở tầng
 * NATIVE, tức là đỏ cả app chứ không phải trống một ô biểu đồ. `Sparkline` hỏng theo kiểu
 * khác nhưng cùng gốc: `xy[xy.length - 1]` là `undefined`, destructure nó là TypeError.
 *
 * Người dùng gặp nó bằng cách bình thường nhất có thể: mở bàn quản trị một nhóm mới lập.
 */
const EMPTY_NOTE = 'Chưa có dữ liệu trong khoảng này';

/** Đường gấp khúc mini nằm trong thẻ số — không trục, không nhãn. */
export function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 62;
  const h = 22;
  // Không vẽ gì còn hơn vẽ một chấm ở toạ độ không tồn tại — xem `EMPTY_NOTE`.
  if (points.length === 0) return null;
  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const xy = points.map(
    (v, i) =>
      [(i / stepOf(points.length)) * w, h - ((v - min) / span) * (h - 3) - 1.5] as const,
  );
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];

  return (
    <Svg width={w} height={h}>
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={lx} cy={ly} r={2} fill={color} />
    </Svg>
  );
}

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Nhãn trục x của MỘT cột, đọc từ chính ngày của cột đó.
 *
 * `T+00:00` để `Date` không diễn giải `YYYY-MM-DD` theo giờ máy: BE đã cắt cột theo múi giờ
 * thị trường rồi, nên ở đây chỉ cần đọc lại đúng ký tự đó chứ không quy đổi lần nữa — quy đổi
 * thêm một lần là lệch cột ở những máy đặt múi giờ khác.
 */
const tickOf = (day: string) => DAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];

/** Tin đã duyệt (đường liền + vùng tô) so với tin còn chờ (đường đứt) theo 14 ngày. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <Text style={styles.empty}>{EMPTY_NOTE}</Text>;

  const W = 560;
  const H = 196;
  const pad = { top: 14, right: 10, bottom: 26, left: 30 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  // Trần cao hơn đỉnh 15% để đường không chạm mép trên của khung.
  const ceiling = Math.max(...data.map((d) => d.approved)) * 1.15 || 1;
  const x = (i: number) => pad.left + (i / stepOf(data.length)) * iw;
  const y = (v: number) => pad.top + ih - (v / ceiling) * ih;
  const line = (pick: (d: TrendPoint) => number) =>
    data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(pick(d)).toFixed(1)}`).join(' ');
  const approved = line((d) => d.approved);

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <Defs>
        <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={C.mossBright} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={C.mossBright} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <React.Fragment key={f}>
          <Line
            x1={pad.left}
            y1={pad.top + ih - f * ih}
            x2={W - pad.right}
            y2={pad.top + ih - f * ih}
            stroke={C.deskLine}
            strokeWidth={1}
          />
          <SvgText
            x={pad.left - 7}
            y={pad.top + ih - f * ih + 3.5}
            textAnchor="end"
            fontFamily={F.mono}
            fontSize={8.5}
            fill={C.deskTxtDim}
          >
            {Math.round(f * ceiling)}
          </SvgText>
        </React.Fragment>
      ))}

      <Path d={`${approved} L${x(data.length - 1)} ${pad.top + ih} L${pad.left} ${pad.top + ih} Z`} fill="url(#areaFill)" />
      <Path d={approved} fill="none" stroke={C.mossBright} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={line((d) => d.pending)} fill="none" stroke={C.tape} strokeWidth={1.6} strokeDasharray="4 4" strokeLinecap="round" />

      {data.map((d, i) => (
        <Circle key={`dot${x(i)}`} cx={x(i)} cy={y(d.approved)} r={2.4} fill={C.mossBright} />
      ))}
      {data.map((d, i) =>
        i % 2 ? null : (
          <SvgText
            key={`day${x(i)}`}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontFamily={F.mono}
            fontSize={8.5}
            fill={C.deskTxtDim}
          >
            {tickOf(d.day)}
          </SvgText>
        ),
      )}
    </Svg>
  );
}

const BAR_COLORS = [C.mossBright, C.sky, C.amber, C.cork];

/** Thanh ngang so sánh danh mục — dựng bằng View, không cần SVG cho hình chữ nhật. */
export function CategoryBars({ data }: { data: CatShare[] }) {
  const max = Math.max(...data.map((d) => d.count)) || 1;

  return (
    <View style={styles.bars}>
      {data.map((row, i) => (
        <View key={row.cat}>
          <View style={styles.barTop}>
            <Text style={styles.barLabel}>{row.cat}</Text>
            <Text style={styles.barValue}>{row.count} tin</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${(row.count / max) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: F.ui,
    fontSize: 12.5,
    color: C.deskTxtDim,
    textAlign: 'center',
    paddingVertical: 34,
  },
  bars: { gap: 13 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxt },
  barValue: { fontFamily: F.mono, fontSize: 11.5, color: C.deskTxtSoft },
  barTrack: { height: 7, borderRadius: 20, backgroundColor: C.deskHi, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 20 },
});

/**
 * Cột dọc cho báo cáo theo thời gian — mỗi cột một ngày/tháng/năm.
 *
 * Dựng bằng `View` chứ không SVG: đây là hình chữ nhật xếp cạnh nhau, và `flex` vẽ được mà
 * không kéo theo một `viewBox` phải tính toạ độ tay. `CategoryBars` ngay trên cũng chọn vậy.
 *
 * Nhãn trục x THƯA DẦN theo số cột: 30 nhãn ngày chồng lên nhau thành một vệt mực. Cột thì vẫn
 * vẽ đủ — mất nhãn còn đọc được hình dạng, mất cột là mất dữ liệu.
 */
export function ReportColumns({
  points,
  labelOf,
  unit = 'tin',
}: {
  /**
   * `value` chứ không `posts`: cùng một biểu đồ phục vụ mọi báo cáo con (tin đăng, người
   * dùng, và cái thứ ba sắp tới). Gọi nó theo tên của một domain là buộc báo cáo sau phải
   * đổi tên field khi truyền vào — hoặc tệ hơn, sao chép cả component.
   */
  points: readonly { bucket: string; value: number }[];
  labelOf: (bucket: string) => string;
  unit?: string;
}) {
  // Trần là đỉnh thật, không cộng biên: cột cao nhất chạm trần là đúng ý "đây là mốc lớn nhất".
  const ceiling = Math.max(...points.map((p) => p.value), 1);
  const every = Math.ceil(points.length / 6);

  return (
    <View>
      <View style={columnStyles.plot}>
        {points.map((p, i) => (
          <View key={p.bucket} style={columnStyles.slot}>
            {/* Số chỉ hiện ở cột có dữ liệu và khi còn đủ chỗ — nhiều cột thì nó thành nhiễu. */}
            {p.value > 0 && points.length <= 14 ? (
              <Text style={columnStyles.value}>{p.value}</Text>
            ) : null}
            <View
              style={[
                columnStyles.bar,
                {
                  height: `${Math.max((p.value / ceiling) * 100, p.value > 0 ? 4 : 1)}%`,
                  backgroundColor: p.value > 0 ? C.mossBright : C.deskLine,
                },
              ]}
            />
            <Text numberOfLines={1} style={columnStyles.tick}>
              {i % every === 0 ? labelOf(p.bucket) : ''}
            </Text>
          </View>
        ))}
      </View>
      <Text style={columnStyles.ceiling}>
        đỉnh {ceiling} {unit}
      </Text>
    </View>
  );
}

const columnStyles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', height: 168, gap: 2 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  value: { fontFamily: F.mono, fontSize: 8.5, color: C.deskTxtSoft, marginBottom: 2 },
  bar: { width: '78%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  tick: { fontFamily: F.mono, fontSize: 8, color: C.deskTxtDim, marginTop: 5, height: 11 },
  ceiling: {
    fontFamily: F.mono,
    fontSize: 8.5,
    color: C.deskTxtDim,
    textAlign: 'right',
    marginTop: 4,
  },
});
