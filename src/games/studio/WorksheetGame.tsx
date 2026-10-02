import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font } from '../../theme';
import { StudioGameProps, secondsSince } from './shared';

export type Stroke = { color: string; points: number[] };
const PENS = ['#E5484D', '#2F7FD0', '#1E9E5A', '#1E3A2F'];

/** Draws normalised strokes over a picture; shared by the game and the chat card. */
export function StrokeLayer({ strokes, width, height }: { strokes: Stroke[]; width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {strokes.map((s, i) => (
        <Path
          key={i}
          d={s.points.reduce((d, v, j) => (j % 2 ? d : `${d}${j ? ' L' : 'M'}${(v * width).toFixed(1)} ${(s.points[j + 1] * height).toFixed(1)}`), '')}
          stroke={s.color}
          strokeWidth={Math.max(3, width * 0.008)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

/** Hook: the picture's display height for a given width. */
export function useImageHeight(uri: string, width: number) {
  const [ratio, setRatio] = useState(1.3);
  useEffect(() => {
    Image.getSize(uri, (w, h) => w > 0 && setRatio(h / w), () => {});
  }, [uri]);
  return width * ratio;
}

/** The child circles and writes on the therapist's worksheet with a finger. */
export default function WorksheetGame({ content, onDone }: StudioGameProps<'worksheet'>) {
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen - 32, 560);
  const height = useImageHeight(content.image, width);
  const start = useRef(Date.now());
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pen, setPen] = useState(PENS[0]);
  const live = useRef<Stroke | null>(null);
  const size = useRef({ width, height });
  size.current = { width, height };
  const penRef = useRef(pen);
  penRef.current = pen;

  const point = (x: number, y: number) => [
    +Math.min(1, Math.max(0, x / size.current.width)).toFixed(4),
    +Math.min(1, Math.max(0, y / size.current.height)).toFixed(4),
  ];

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        live.current = { color: penRef.current, points: point(e.nativeEvent.locationX, e.nativeEvent.locationY) };
        setStrokes((s) => [...s, live.current!]);
      },
      onPanResponderMove: (e) => {
        if (!live.current) return;
        live.current.points.push(...point(e.nativeEvent.locationX, e.nativeEvent.locationY));
        setStrokes((s) => [...s.slice(0, -1), { ...live.current! }]);
      },
      onPanResponderRelease: () => {
        live.current = null;
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View style={{ alignItems: 'center' }}>
      {!!content.task && <Text style={styles.task}>{content.task}</Text>}
      <View style={[styles.sheet, { width, height }]} {...responder.panHandlers}>
        <Image source={{ uri: content.image }} style={{ width, height }} resizeMode="contain" />
        <StrokeLayer strokes={strokes} width={width} height={height} />
      </View>
      <View style={styles.tools}>
        {PENS.map((c) => (
          <Pressable key={c} onPress={() => setPen(c)} style={[styles.pen, { backgroundColor: c }, pen === c && styles.penOn]} accessibilityLabel={`Pen colour ${c}`} />
        ))}
        <Pressable onPress={() => setStrokes((s) => s.slice(0, -1))} style={styles.tool} accessibilityRole="button" accessibilityLabel="Undo">
          <Feather name="corner-up-left" size={18} color={colors.ink} />
        </Pressable>
        <Pressable onPress={() => setStrokes([])} style={styles.tool} accessibilityRole="button" accessibilityLabel="Clear drawing">
          <Feather name="trash-2" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => onDone({ accuracy: null, activeSec: secondsSince(start.current), strokes })}
        disabled={strokes.length === 0}
        style={[styles.finish, strokes.length === 0 && { opacity: 0.4 }]}
        accessibilityRole="button"
      >
        <Feather name="check" size={18} color={colors.white} />
        <Text style={styles.finishText}>I’m finished</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  task: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, textAlign: 'center', marginBottom: 10 },
  sheet: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  pen: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: colors.white },
  penOn: { borderColor: colors.ink, transform: [{ scale: 1.15 }] },
  tool: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  finish: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 24, height: 48, borderRadius: 24, backgroundColor: colors.forest },
  finishText: { fontFamily: font.semibold, fontSize: 16, color: colors.white },
});
