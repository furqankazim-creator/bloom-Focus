import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import type { StudioContent, StudioPicture } from '../../types';

export type StudioResult = {
  /** 0–1, or null for unscored games (worksheets). */
  accuracy: number | null;
  activeSec: number;
  strokes?: { color: string; points: number[] }[];
};

export type StudioGameProps<T extends StudioContent['template']> = {
  content: Extract<StudioContent, { template: T }>;
  level: number;
  onDone: (r: StudioResult) => void;
};

/** An emoji or a photo, drawn at a fixed size. */
export function StudioPic({ pic, size }: { pic: StudioPicture; size: number }) {
  if (pic.kind === 'image') return <Image source={{ uri: pic.uri }} style={{ width: size, height: size, borderRadius: size * 0.18 }} />;
  return <Text style={{ fontSize: size * 0.72, lineHeight: size * 0.95, textAlign: 'center' }}>{pic.value}</Text>;
}

/** Small status line used at the top of every studio game. */
export function GameBar({ left, right }: { left: string; right?: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.barText}>{left}</Text>
      {!!right && <Text style={styles.barText}>{right}</Text>}
    </View>
  );
}

export const secondsSince = (start: number) => Math.max(1, Math.round((Date.now() - start) / 1000));

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 },
  barText: { fontFamily: font.semibold, fontSize: 14, color: colors.inkSoft },
});
