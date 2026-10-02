import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MciName, ProgressBar } from '../components/ui';
import { colors, font } from '../theme';
import type { Feedback } from './common';

export const SHAPE_COLORS = {
  red: '#E07A5F',
  blue: '#5B8DB8',
  green: '#6FA35B',
  yellow: '#E9B949',
  purple: '#9C7FC1',
} as const;
export type ShapeColor = keyof typeof SHAPE_COLORS;

export const SHAPES = {
  circle: 'circle',
  square: 'square-rounded',
  triangle: 'triangle',
  star: 'star',
  heart: 'heart',
} as const;
export type Shape = keyof typeof SHAPES;

export function ShapeIcon({ shape, color, size }: { shape: Shape; color: ShapeColor; size: number }) {
  return <MaterialCommunityIcons name={SHAPES[shape] as MciName} size={size} color={SHAPE_COLORS[color]} />;
}

export function GameFrame({
  instruction,
  progress,
  children,
  footer,
}: {
  instruction: React.ReactNode;
  progress?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={st.instruction}>
        {typeof instruction === 'string' ? <Text style={st.instructionText}>{instruction}</Text> : instruction}
      </View>
      {progress !== undefined && (
        <View style={{ marginBottom: 14 }}>
          <ProgressBar value={progress} height={6} />
        </View>
      )}
      <View style={st.area}>{children}</View>
      {footer}
    </View>
  );
}

export function FeedbackRing({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        st.ring,
        { borderColor: feedback === 'good' ? colors.leaf : '#E8C9A8' },
      ]}
    >
      {feedback === 'oops' && <Text style={st.oops}>Wait for it…</Text>}
    </View>
  );
}

export const st = StyleSheet.create({
  instruction: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  instructionText: { fontFamily: font.semibold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  area: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 300,
  },
  ring: { borderRadius: 28, borderWidth: 6, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 18 },
  oops: { fontFamily: font.semibold, fontSize: 15, color: colors.inkSoft },
});
