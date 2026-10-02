import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { buildWordGrid, lineBetween } from '../../engine/studio';
import { colors, font } from '../../theme';
import { GameBar, StudioGameProps, secondsSince } from './shared';

const FOUND_COLORS = ['#FFD66B', '#9FE2BF', '#A9C8FF', '#FFB3C7', '#D4B8FF', '#FFC48C'];

/** Tap the first letter of a word, then its last letter. */
export default function WordSearchGame({ content, level, onDone }: StudioGameProps<'wordsearch'>) {
  const grid = useMemo(() => buildWordGrid(content.words, level), [content.words, level]);
  const { width } = useWindowDimensions();
  const cell = Math.min(Math.floor((Math.min(width, 520) - 40) / grid.size), 44);
  const start = useRef(Date.now());
  const [first, setFirst] = useState<number | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<number[] | null>(null);

  const colorOf = useMemo(() => {
    const m = new Map<number, string>();
    found.forEach((w, i) => grid.placed.find((p) => p.word === w)?.cells.forEach((c) => m.set(c, FOUND_COLORS[i % FOUND_COLORS.length])));
    return m;
  }, [found, grid]);

  const finish = (foundCount: number, wrongCount: number) => {
    // Found share, lightly reduced by wrong guesses.
    const accuracy = Math.max(0, foundCount / grid.placed.length - Math.min(0.3, wrongCount * 0.03));
    onDone({ accuracy, activeSec: secondsSince(start.current) });
  };

  const tap = (i: number) => {
    if (first === null) return setFirst(i);
    if (first === i) return setFirst(null);
    const line = lineBetween(first, i, grid.size);
    setFirst(null);
    const hit = line && grid.placed.find((p) => !found.includes(p.word) && (same(p.cells, line) || same(p.cells, [...line].reverse())));
    if (hit) {
      const next = [...found, hit.word];
      setFound(next);
      if (next.length === grid.placed.length) setTimeout(() => finish(next.length, wrong), 700);
    } else {
      setWrong((w) => w + 1);
      setFlash(line ?? [first, i]);
      setTimeout(() => setFlash(null), 450);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <GameBar left={`${found.length}/${grid.placed.length} words found`} right={first !== null ? 'Now tap the last letter' : 'Tap the first letter'} />
      <View style={[styles.grid, { width: cell * grid.size + 8 }]}>
        {grid.letters.map((ch, i) => {
          const bg = colorOf.get(i) ?? (flash?.includes(i) ? '#F6C9BD' : first === i ? colors.lime : colors.white);
          return (
            <Pressable key={i} onPress={() => tap(i)} style={[styles.cell, { width: cell, height: cell, backgroundColor: bg }]} accessibilityLabel={`Letter ${ch}`}>
              <Text style={[styles.letter, { fontSize: cell * 0.5 }]}>{ch}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.words}>
        {grid.placed.map((p) => {
          const done = found.includes(p.word);
          return (
            <View key={p.word} style={[styles.word, done && { backgroundColor: FOUND_COLORS[found.indexOf(p.word) % FOUND_COLORS.length] }]}>
              <Text style={[styles.wordText, done && styles.wordDone]}>{p.word}</Text>
            </View>
          );
        })}
      </View>
      {found.length < grid.placed.length && (
        <Pressable onPress={() => finish(found.length, wrong)} style={styles.stop} accessibilityRole="button">
          <Text style={styles.stopText}>I’m done for now</Text>
        </Pressable>
      )}
    </View>
  );
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 14, backgroundColor: colors.ink },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.border },
  letter: { fontFamily: font.bold, color: colors.ink },
  words: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 16, maxWidth: 520 },
  word: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.sage },
  wordText: { fontFamily: font.bold, fontSize: 13, letterSpacing: 1, color: colors.ink },
  wordDone: { textDecorationLine: 'line-through', opacity: 0.7 },
  stop: { marginTop: 18, paddingHorizontal: 16, paddingVertical: 10 },
  stopText: { fontFamily: font.semibold, fontSize: 14, color: colors.inkSoft },
});
