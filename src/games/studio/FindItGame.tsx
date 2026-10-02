import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { findItSettings, shuffle } from '../../engine/studio';
import { colors, font } from '../../theme';
import type { StudioPicture } from '../../types';
import { GameBar, StudioGameProps, StudioPic, secondsSince } from './shared';

type Cell = { pic: StudioPicture; target: boolean; state: 'idle' | 'hit' | 'wrong' };

/** Several rounds: tap every target picture, leave the others. */
export default function FindItGame({ content, level, onDone }: StudioGameProps<'findit'>) {
  const { cells: count, roundSec, rounds } = findItSettings(level);
  const { width } = useWindowDimensions();
  const cols = count <= 6 ? 3 : count <= 12 ? 4 : 5;
  const tile = Math.min(Math.floor((Math.min(width, 480) - 48) / cols), 92);
  const start = useRef(Date.now());
  const tally = useRef({ targets: 0, hits: 0, wrong: 0 });
  const [round, setRound] = useState(0);
  const [cells, setCells] = useState<Cell[]>(() => makeRound());
  const [left, setLeft] = useState(roundSec);

  function makeRound(): Cell[] {
    const targets = 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(count / 5)));
    const others = Array.from({ length: count - targets }, (_, i) => content.others[i % content.others.length]);
    tally.current.targets += targets;
    return shuffle([
      ...Array.from({ length: targets }, () => ({ pic: content.target, target: true, state: 'idle' as const })),
      ...others.map((pic) => ({ pic, target: false, state: 'idle' as const })),
    ]);
  }

  const nextRound = () => {
    if (round + 1 >= rounds) {
      const { targets, hits, wrong } = tally.current;
      onDone({ accuracy: hits / Math.max(1, targets + wrong), activeSec: secondsSince(start.current) });
      return;
    }
    setRound((r) => r + 1);
    setCells(makeRound());
    setLeft(roundSec);
  };

  // Optional round timer at the harder levels; missed targets count against accuracy.
  useEffect(() => {
    if (!roundSec) return;
    if (left <= 0) {
      const t = setTimeout(nextRound, 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, roundSec]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (i: number) => {
    const c = cells[i];
    if (c.state !== 'idle') return;
    const next = cells.map((x, j) => (j === i ? { ...x, state: (x.target ? 'hit' : 'wrong') as Cell['state'] } : x));
    setCells(next);
    if (c.target) tally.current.hits++;
    else {
      tally.current.wrong++;
      setTimeout(() => setCells((cur) => cur.map((x, j) => (j === i ? { ...x, state: 'idle' } : x))), 500);
    }
    if (c.target && next.filter((x) => x.target).every((x) => x.state === 'hit')) setTimeout(nextRound, 600);
  };

  const remaining = cells.filter((c) => c.target && c.state !== 'hit').length;
  return (
    <View style={{ alignItems: 'center' }}>
      <GameBar left={`Round ${round + 1} of ${rounds}`} right={roundSec ? `${left}s` : undefined} />
      <View style={styles.ask}>
        <Text style={styles.askText}>Find every {content.targetName}</Text>
        <StudioPic pic={content.target} size={36} />
        <Text style={styles.askText}>· {remaining} left</Text>
      </View>
      <View style={[styles.grid, { width: tile * cols + 8 * (cols - 1) }]}>
        {cells.map((c, i) => (
          <Pressable
            key={`${round}-${i}`}
            onPress={() => tap(i)}
            style={[styles.tile, { width: tile, height: tile }, c.state === 'hit' && styles.hit, c.state === 'wrong' && styles.wrong]}
            accessibilityRole="button"
          >
            <StudioPic pic={c.pic} size={tile * 0.78} />
            {c.state === 'hit' && <Text style={styles.check}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  askText: { fontFamily: font.bold, fontSize: 18, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 18, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hit: { borderColor: colors.leaf, backgroundColor: colors.mint },
  wrong: { borderColor: colors.danger, backgroundColor: '#FBE4DE' },
  check: { position: 'absolute', top: 4, right: 8, fontFamily: font.heavy, fontSize: 16, color: colors.forest },
});
