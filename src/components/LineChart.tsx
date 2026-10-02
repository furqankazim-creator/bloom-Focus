import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, font } from '../theme';

export type ChartPoint = { value: number; label: string };

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const cx = (a.x + b.x) / 2;
    d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

/**
 * Responsive line chart. `max` fixes the top of the scale (e.g. 100 for percentages);
 * `target` draws a dashed goal line; `invert` is for "lower is better" series.
 */
export function LineChart({
  data,
  color = colors.forest,
  height = 150,
  max,
  min = 0,
  target,
  targetLabel,
  unit = '',
  ticks,
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  max?: number;
  min?: number;
  target?: number;
  targetLabel?: string;
  unit?: string;
  ticks?: number[];
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (data.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.inkMuted }}>No data yet</Text>
      </View>
    );
  }

  const top = max ?? Math.max(1, ...data.map((d) => d.value), target ?? 0) * 1.15;
  const padL = 34;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = height - padT - padB;
  const y = (v: number) => padT + innerH - ((v - min) / Math.max(1e-6, top - min)) * innerH;
  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: y(d.value),
    ...d,
  }));
  const tickVals = ticks ?? [min, (min + top) / 2, top].map((v) => Math.round(v));
  // Only label a handful of x points so they never collide.
  const every = Math.max(1, Math.ceil(data.length / 5));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {tickVals.map((v) => (
            <React.Fragment key={v}>
              <Line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} stroke="#EEF2EC" strokeWidth={1} strokeDasharray="4,4" />
              <SvgText x={padL - 6} y={y(v) + 3} fontSize="10" fill="#99A499" textAnchor="end">
                {`${v}${unit}`}
              </SvgText>
            </React.Fragment>
          ))}
          {target !== undefined && (
            <>
              <Line x1={padL} y1={y(target)} x2={width - padR} y2={y(target)} stroke={color} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="6,4" />
              {targetLabel && (
                <SvgText x={width - padR} y={y(target) - 4} fontSize="9" fill={color} textAnchor="end">
                  {targetLabel}
                </SvgText>
              )}
            </>
          )}
          {pts.length > 1 && <Path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth={2.5} />}
          {pts.map((p, i) => (
            <React.Fragment key={i}>
              <Circle cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5.5 : 4} fill={color} stroke="#fff" strokeWidth={i === pts.length - 1 ? 2 : 0} />
              {(i % every === 0 || i === pts.length - 1) && (
                <SvgText x={p.x} y={height - 6} fontSize="9" fill="#889688" textAnchor="middle">
                  {p.label}
                </SvgText>
              )}
            </React.Fragment>
          ))}
        </Svg>
      )}
    </View>
  );
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
