import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { adjustmentNote, taskDisplay } from '../games/train/meta';
import { colors, font } from '../theme';
import type { BlockResult } from '../types';

export const fmtRt = (ms: number | null) => (ms === null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

/** Metrics grid plus the adaptive-engine note for one played game. */
export function BlockResultCard({ block }: { block: BlockResult }) {
  const m = block.metrics;
  const acc = block.accuracy;
  const { title, icon } = taskDisplay(block.taskId);
  const leveledUp = block.levelAfter > block.levelBefore;
  const leveledDown = block.levelAfter < block.levelBefore;
  const note = adjustmentNote(block.changes);
  const stats: [string, string][] = [
    ['Accuracy', acc === null ? '—' : `${Math.round(acc * 100)}%`],
    ['Duration', `${m.activeSec}s`],
    ['Correct', String(m.hits + m.correctRejections)],
    ['Missed', String(m.misses)],
    ['Off-target', String(m.falseTaps)],
    ['Avg response', fmtRt(m.meanRtMs)],
  ];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        {(leveledUp || leveledDown) && (
          <View style={[styles.lvlPill, { backgroundColor: leveledUp ? '#E3F6EE' : '#FEF3E2' }]}>
            <Text style={[styles.lvlText, { color: leveledUp ? '#138A5E' : '#B7791F' }]}>
              Level {block.levelBefore} → {block.levelAfter} {leveledUp ? '⬆' : '⬇'}
            </Text>
          </View>
        )}
      </View>
      {!m.completed && <Text style={styles.early}>Ended early</Text>}
      <View style={styles.grid}>
        {stats.map(([label, value]) => (
          <View key={label} style={styles.statBox}>
            <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.engine}>
        <Text style={styles.engineTitle}>⚙️ Adaptive engine</Text>
        {note && <Text style={styles.engineNote}>{note}</Text>}
        <Text style={styles.engineText}>{block.summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink, flex: 1 },
  early: { fontFamily: font.medium, fontSize: 12, color: colors.inkMuted, marginTop: -6, marginBottom: 10 },
  lvlPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  lvlText: { fontFamily: font.bold, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#F6F5F1', borderRadius: 14, padding: 12 },
  statLabel: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 0.8, color: colors.inkMuted },
  statValue: { fontFamily: font.heavy, fontSize: 18, color: colors.ink, marginTop: 4 },
  engine: { marginTop: 12, backgroundColor: '#F2F8F6', borderColor: '#D4E8E1', borderWidth: 1, borderRadius: 14, padding: 12 },
  engineTitle: { fontFamily: font.bold, fontSize: 13, color: colors.forest, marginBottom: 4 },
  engineNote: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginBottom: 4 },
  engineText: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
});
