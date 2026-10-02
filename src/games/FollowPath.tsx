import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, shuffle, useTicker } from './common';
import { SHAPES, SHAPE_COLORS, Shape, ShapeColor, ShapeIcon } from './parts';

const ROUNDS = 5;
const BOARD_SIZE = [4, 6, 8, 9, 12, 12];
/** From speed 3 up, the instruction hides after this long and must be held in mind. */
const HIDE_AFTER_MS: Record<number, number | undefined> = { 3: 6000, 4: 4500, 5: 3000 };
const FEEDBACK_MS = 1000;

type Item = { key: string; shape: Shape; color: ShapeColor };

function makeRound(boardSize: number, steps: number) {
  const combos = shuffle(
    (Object.keys(SHAPES) as Shape[]).flatMap((shape) =>
      (Object.keys(SHAPE_COLORS) as ShapeColor[]).map((color) => ({ key: `${color}-${shape}`, shape, color })),
    ),
  );
  const board = combos.slice(0, boardSize);
  const path = shuffle(board).slice(0, Math.min(steps, boardSize));
  return { board, path };
}

const describe = (i: Item) => `the ${i.color} ${i.shape}`;
const sentence = (path: Item[]) =>
  'Tap ' + path.map(describe).join(path.length > 2 ? ', then ' : ', then ') + '.';

export default function FollowPath({ params, paused, onCorrect, onDone }: GameProps) {
  const boardSize = BOARD_SIZE[params.distractors] ?? 6;
  const hideAfter = HIDE_AFTER_MS[params.speed];
  const r = useRef({ elapsed: 0, roundAt: 0, feedbackAt: -1, tally: new Tally(), done: false });
  const [round, setRound] = useState(1);
  const [{ board, path }, setRoundData] = useState(() => makeRound(boardSize, params.instructionSteps));
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<'good' | 'oops' | null>(null);
  const [, force] = useState(0);

  const say = () => {
    Speech.stop();
    Speech.speak(sentence(path), { rate: 0.9 });
  };
  useEffect(() => () => void Speech.stop(), []);

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;
    if (st.feedbackAt >= 0 && st.elapsed - st.feedbackAt >= FEEDBACK_MS) {
      st.feedbackAt = -1;
      if (round >= ROUNDS) {
        st.done = true;
        onDone(st.tally.result(st.elapsed));
        return;
      }
      setRound(round + 1);
      setRoundData(makeRound(boardSize, params.instructionSteps));
      setProgress(0);
      setResult(null);
      st.roundAt = st.elapsed;
    }
    force((x) => x + 1);
  });

  const tap = (item: Item) => {
    const st = r.current;
    if (paused || st.done || st.feedbackAt >= 0) return;
    if (item.key === path[progress].key) {
      if (progress + 1 === path.length) {
        st.tally.hit(st.elapsed - st.roundAt);
        onCorrect();
        setResult('good');
        st.feedbackAt = st.elapsed;
      }
      setProgress(progress + 1);
    } else {
      st.tally.falseTap();
      setResult('oops');
      st.feedbackAt = st.elapsed;
    }
  };

  const hidden = hideAfter !== undefined && r.current.elapsed - r.current.roundAt > hideAfter && result === null;
  const done = new Set(path.slice(0, progress).map((p) => p.key));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.instruction}>
        <Text style={styles.text}>
          {result === 'good'
            ? 'Perfect path!'
            : result === 'oops'
              ? `It was ${path.map(describe).join(', then ')}.`
              : hidden
                ? 'Now do it from memory.'
                : sentence(path)}
        </Text>
        <Pressable onPress={say} hitSlop={10} accessibilityLabel="Hear the instruction" style={styles.speak}>
          <Feather name="volume-2" size={20} color={colors.forest} />
        </Pressable>
      </View>
      <View style={[styles.area, result === 'good' && { borderColor: colors.leaf, borderWidth: 3 }]}>
        <View style={styles.grid}>
          {board.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => tap(item)}
              style={({ pressed }) => [styles.cell, pressed && { backgroundColor: colors.sage }]}
              accessibilityLabel={`${item.color} ${item.shape}`}
            >
              <ShapeIcon shape={item.shape} color={item.color} size={boardSize > 8 ? 50 : 62} />
              {done.has(item.key) && (
                <View style={styles.check}>
                  <MaterialCommunityIcons name="check-circle" size={22} color={colors.forest} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.foot}>
        Round {round} of {ROUNDS} · {path.length}-step path
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  instruction: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 76,
  },
  text: { flex: 1, fontFamily: font.semibold, fontSize: 17, lineHeight: 24, color: colors.ink },
  speak: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  area: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  cell: { width: '28%', aspectRatio: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  check: { position: 'absolute', top: 6, right: 6 },
  foot: { textAlign: 'center', marginTop: 10, fontFamily: font.regular, fontSize: 13, color: colors.inkMuted },
});
