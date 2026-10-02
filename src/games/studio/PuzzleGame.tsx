import React, { useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { puzzleNumbers, puzzleSize, shuffle } from '../../engine/studio';
import { colors, font } from '../../theme';
import { GameBar, StudioGameProps, secondsSince } from './shared';

/** Tap two pieces to swap them until the picture is whole again. */
export default function PuzzleGame({ content, level, onDone }: StudioGameProps<'puzzle'>) {
  const n = puzzleSize(level);
  const { width } = useWindowDimensions();
  const board = Math.min(width - 48, 380);
  const tile = board / n;
  const start = useRef(Date.now());
  // order[position] = piece index; never start already solved.
  const [order, setOrder] = useState(() => {
    let o = shuffle(Array.from({ length: n * n }, (_, i) => i));
    while (o.every((p, i) => p === i)) o = shuffle(o);
    return o;
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [peek, setPeek] = useState(false);
  const [solved, setSolved] = useState(false);
  const correct = useMemo(() => order.filter((p, i) => p === i).length, [order]);

  const tap = (pos: number) => {
    if (solved) return;
    if (picked === null) return setPicked(pos);
    if (picked === pos) return setPicked(null);
    const next = [...order];
    [next[picked], next[pos]] = [next[pos], next[picked]];
    setOrder(next);
    setPicked(null);
    const m = moves + 1;
    setMoves(m);
    if (next.every((p, i) => p === i)) {
      setSolved(true);
      // A perfect solve needs at most n² − 1 swaps; allow some slack before the score drops.
      const best = n * n - 1;
      const accuracy = Math.min(1, (best * 1.5) / Math.max(m, best));
      setTimeout(() => onDone({ accuracy, activeSec: secondsSince(start.current) }), 900);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <GameBar left={`${correct}/${n * n} pieces in place`} right={`${moves} moves`} />
      <View style={[styles.board, { width: board, height: board }]}>
        {order.map((piece, pos) => {
          const row = Math.floor(piece / n);
          const col = piece % n;
          const ok = piece === pos;
          return (
            <Pressable
              key={pos}
              onPress={() => tap(pos)}
              style={[
                styles.tile,
                { width: tile, height: tile, left: (pos % n) * tile, top: Math.floor(pos / n) * tile },
                picked === pos && styles.picked,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Piece ${piece + 1}${ok ? ', in place' : ''}`}
            >
              <View style={{ width: tile, height: tile, overflow: 'hidden' }}>
                <Image source={{ uri: content.image }} style={{ width: board, height: board, marginLeft: -col * tile, marginTop: -row * tile }} />
              </View>
              {puzzleNumbers(level) && !solved && (
                <View style={[styles.num, ok && { backgroundColor: colors.leaf }]}>
                  <Text style={styles.numText}>{piece + 1}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {peek && <Image source={{ uri: content.image }} style={[StyleSheet.absoluteFill, { opacity: 0.92 }]} />}
      </View>
      <Pressable
        onPressIn={() => setPeek(true)}
        onPressOut={() => setPeek(false)}
        style={styles.peek}
        accessibilityRole="button"
        accessibilityLabel="Hold to see the whole picture"
      >
        <Text style={styles.peekText}>👁 Hold to peek at the picture</Text>
      </Pressable>
      {solved && <Text style={styles.done}>🎉 You did it!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: colors.border },
  tile: { position: 'absolute', borderWidth: 1, borderColor: colors.white },
  picked: { borderWidth: 4, borderColor: '#FFB020', zIndex: 2 },
  num: { position: 'absolute', top: 4, left: 4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: 'rgba(30,58,47,0.75)', alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: font.bold, fontSize: 12, color: colors.white },
  peek: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.sage },
  peekText: { fontFamily: font.semibold, fontSize: 14, color: colors.forest },
  done: { marginTop: 12, fontFamily: font.heavy, fontSize: 22, color: colors.forest },
});
