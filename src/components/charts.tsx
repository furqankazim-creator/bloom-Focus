import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { pct } from '../engine/adaptive';
import type { DomainScore } from '../engine/profile';
import { DOMAIN_LABEL } from '../engine/tasks';
import { colors, font } from '../theme';
import { ProgressBar } from './ui';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function RhythmChart({ counts }: { counts: number[] }) {
  const max = Math.max(2, ...counts);
  const today = (new Date().getDay() + 6) % 7;
  return (
    <View style={styles.chart}>
      {counts.map((c, i) => (
        <View key={i} style={styles.col}>
          <Text style={styles.count}>{c > 0 ? c : ''}</Text>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                {
                  height: c > 0 ? `${(c / max) * 100}%` : 8,
                  backgroundColor: c === 0 ? '#DCE8D3' : i === today ? colors.forest : colors.leaf,
                },
              ]}
            />
          </View>
          <Text style={[styles.day, i === today && { color: colors.ink, fontFamily: font.bold }]}>{DAYS[i]}</Text>
        </View>
      ))}
    </View>
  );
}

/** Per-domain practice accuracy. Deliberately shown as bars, not a single "attention score". */
export function DomainBars({ profile }: { profile: DomainScore[] }) {
  return (
    <View style={{ gap: 14 }}>
      {profile.map((p) => (
        <View key={p.domain}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>{DOMAIN_LABEL[p.domain]}</Text>
            <Text style={styles.value}>{p.score === null ? 'Not practised yet' : pct(p.score)}</Text>
          </View>
          <ProgressBar value={p.score ?? 0} color={p.score !== null && p.score < 0.65 ? colors.butter : colors.leaf} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', height: 170, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 },
  col: { alignItems: 'center', flex: 1, height: '100%' },
  count: { fontFamily: font.medium, fontSize: 12, color: colors.inkSoft, height: 18 },
  track: { flex: 1, justifyContent: 'flex-end', width: 34 },
  bar: { width: 34, borderRadius: 17 },
  day: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
  value: { fontFamily: font.semibold, fontSize: 14, color: colors.forest },
});
