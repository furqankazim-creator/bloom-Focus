import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Tally } from '../common';
import type { TrainGameProps } from './shared';

const GRID_SIZE = 3;

export default function BlockBuilderTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const memoryLoad = Math.max(2, Math.min(5, params.memoryLoad ?? 3));
  const [cells, setCells] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [steps, setSteps] = useState(0);
  const [showPattern, setShowPattern] = useState(true);
  const [done, setDone] = useState(false);
  const tally = useRef(new Tally());
  const startedAt = useRef(Date.now());

  const pattern = useMemo(() => {
    return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index)
      .sort(() => Math.random() - 0.5)
      .slice(0, memoryLoad);
  }, [durationSec, memoryLoad]);

  useEffect(() => {
    setCells([]);
    setRevealed([...pattern]);
    setSteps(0);
    setShowPattern(true);
    setDone(false);
    startedAt.current = Date.now();
    tally.current = new Tally();
    const t = setTimeout(() => {
      setRevealed([]);
      setShowPattern(false);
    }, 1400);
    return () => clearTimeout(t);
  }, [pattern]);

  const handleCell = (index: number) => {
    if (done || paused || showPattern) return;
    const next = [...cells, index];
    setCells(next);
    setSteps((s) => s + 1);

    const expected = pattern[next.length - 1];
    if (index !== expected) {
      tally.current.falseTap();
      onDone(tally.current.result(Date.now() - startedAt.current));
      setDone(true);
      return;
    }

    tally.current.hit();
    onCorrect();
    if (next.length === pattern.length) {
      onDone(tally.current.result(Date.now() - startedAt.current));
      setDone(true);
    }
  };

  const allCells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Build the pattern</Text>
      <Text style={styles.caption}>
        {showPattern ? 'Remember the glowing blocks.' : 'Tap the blocks in the same order.'}
      </Text>
      <View style={styles.grid}>
        {allCells.map((cell) => {
          const lit = revealed.includes(cell);
          const selected = cells.includes(cell);
          const canPress = !done && !paused && !showPattern && !selected;
          return (
            <Pressable
              key={cell}
              onPress={() => canPress && handleCell(cell)}
              style={[
                styles.cell,
                lit && styles.cellLit,
                selected && styles.cellSelected,
                !lit && !selected && styles.cellIdle,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.meta}>{steps}/{pattern.length} steps</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  caption: { color: colors.inkSoft, marginBottom: 16, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    justifyContent: 'center',
    marginTop: 8,
  },
  cell: {
    width: 56,
    height: 56,
    borderRadius: 14,
    margin: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cellIdle: { backgroundColor: '#f1f5f9' },
  cellLit: { backgroundColor: colors.butter, borderColor: colors.butter },
  cellSelected: { backgroundColor: colors.mint, borderColor: colors.forest },
  meta: { color: colors.inkSoft, marginTop: 12 },
});
