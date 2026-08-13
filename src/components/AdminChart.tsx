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

/** Đường gấp khúc mini nằm trong thẻ số — không trục, không nhãn. */
export function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 62;
  const h = 22;
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

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Tin đã duyệt (đường liền + vùng tô) so với tin còn chờ (đường đứt) theo 14 ngày. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
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
      {data.map((_, i) =>
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
            {DAYS[i % DAYS.length]}
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
  bars: { gap: 13 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontFamily: F.uiSemi, fontSize: 12.5, color: C.deskTxt },
  barValue: { fontFamily: F.mono, fontSize: 11.5, color: C.deskTxtSoft },
  barTrack: { height: 7, borderRadius: 20, backgroundColor: C.deskHi, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 20 },
});
