import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, shuffle, useTicker } from './common';
import { CHATTER, useAuditoryDistraction } from './useAuditoryDistraction';
import { FeedbackRing, SHAPES, SHAPE_COLORS, Shape, ShapeColor, ShapeIcon } from './parts';

const TRIAL_MS = [9000, 7000, 5500, 4500, 3500];
const DISTRACTOR_COUNT = [3, 5, 8, 11, 14, 17];
const GAP_MS = 600;
const SHUFFLE_MS = 1600;

type Item = { key: string; shape: Shape; color: ShapeColor; target: boolean };

const SHAPE_KEYS = Object.keys(SHAPES) as Shape[];
const COLOR_KEYS = Object.keys(SHAPE_COLORS) as ShapeColor[];

/**
 * Levels 0–1: distractors differ in shape AND colour (the target pops out).
 * Levels 2+: distractors share the target's shape OR colour (a real search).
 * Levels 4+: the board reshuffles during the trial.
 */
function makeBoard(level: number): Item[] {
  const target = { shape: pick(SHAPE_KEYS), color: pick(COLOR_KEYS) };
  const n = DISTRACTOR_COUNT[level] ?? 8;
  const items: Item[] = [{ key: 't', ...target, target: true }];
  for (let i = 0; i < n; i++) {
    let shape: Shape, color: ShapeColor;
    if (level < 2) {
      shape = pick(SHAPE_KEYS.filter((s) => s !== target.shape));
      color = pick(COLOR_KEYS.filter((c) => c !== target.color));
    } else if (Math.random() < 0.5) {
      shape = target.shape;
      color = pick(COLOR_KEYS.filter((c) => c !== target.color));
    } else {
      shape = pick(SHAPE_KEYS.filter((s) => s !== target.shape));
      color = target.color;
    }
    items.push({ key: `d${i}`, shape, color, target: false });
  }
  return shuffle(items);
}

export default function PatternGarden({ params, paused, onCorrect, onDone }: GameProps) {
  const durationMs = params.durationSec * 1000;
  const trialMs = TRIAL_MS[params.speed - 1] ?? 5500;
  const moving = params.distractors >= 4;
  const r = useRef({ elapsed: 0, trialAt: 0, gapUntil: 0, lastShuffle: 0, tally: new Tally(), done: false });
  const [board, setBoard] = useState<Item[]>(() => makeBoard(params.distractors));
  const [feedback, setFeedback] = useState<'good' | 'oops' | null>(null);
  const [, force] = useState(0);
  const target = board.find((i) => i.target)!;
  // Level 4: background chatter alongside moving items. Level 5: voices naming the wrong colours and shapes.
  useAuditoryDistraction(
    params.distractors >= 5
      ? [...CHATTER, ...COLOR_KEYS.filter((c) => c !== target.color), ...SHAPE_KEYS.filter((s) => s !== target.shape)]
      : params.distractors >= 4
        ? CHATTER
        : null,
    paused,
  );

  // The board is hidden during the short gap, so the next one can be dealt straight away.
  const nextTrial = () => {
    const st = r.current;
    st.gapUntil = st.elapsed + GAP_MS;
    st.trialAt = st.gapUntil;
    st.lastShuffle = st.gapUntil;
    setBoard(makeBoard(params.distractors));
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;
    const inGap = st.elapsed < st.gapUntil;
    if (!inGap) setFeedback(null);
    if (!inGap && st.elapsed >= durationMs) {
      st.done = true;
      onDone(st.tally.result(st.elapsed));
      return;
    }
    if (!inGap && st.elapsed - st.trialAt >= trialMs) {
      st.tally.miss();
      setFeedback('oops');
      nextTrial();
    } else if (!inGap && moving && st.elapsed - st.lastShuffle >= SHUFFLE_MS) {
      st.lastShuffle = st.elapsed;
      setBoard((b) => shuffle(b));
    }
    force((x) => x + 1);
  });

  const choose = (item: Item) => {
    const st = r.current;
    if (paused || st.done || st.elapsed < st.gapUntil) return;
    if (item.target) {
      st.tally.hit(st.elapsed - st.trialAt);
      onCorrect();
      setFeedback('good');
    } else {
      st.tally.falseTap();
      setFeedback('oops');
    }
    nextTrial();
  };

  const inGap = r.current.elapsed < r.current.gapUntil;
  const trialLeft = inGap ? 1 : Math.max(0, 1 - (r.current.elapsed - r.current.trialAt) / trialMs);
  const size = board.length > 12 ? 44 : board.length > 6 ? 54 : 70;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.instruction}>
        <Text style={styles.text}>Find the</Text>
        <ShapeIcon shape={target.shape} color={target.color} size={34} />
        <Text style={styles.text}>
          {target.color} {target.shape}
        </Text>
      </View>
      <View style={styles.timer}>
        <View style={[styles.timerFill, { width: `${trialLeft * 100}%` }]} />
      </View>
      <View style={styles.area}>
        <View style={styles.grid}>
          {board.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => choose(item)}
              style={({ pressed }) => [styles.cell, pressed && { backgroundColor: colors.sage }]}
              accessibilityLabel={`${item.color} ${item.shape}`}
            >
              {!inGap && <ShapeIcon shape={item.shape} color={item.color} size={size} />}
            </Pressable>
          ))}
        </View>
        <FeedbackRing feedback={feedback === 'good' ? 'good' : null} />
      </View>
      <Text style={styles.foot}>Round {r.current.tally.outcomes.length + 1} · take your time</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  instruction: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: { fontFamily: font.semibold, fontSize: 18, color: colors.ink },
  timer: { height: 6, borderRadius: 3, backgroundColor: '#ECEBE4', marginBottom: 12, overflow: 'hidden' },
  timerFill: { height: 6, backgroundColor: colors.leaf },
  area: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  cell: { width: '22%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  foot: { textAlign: 'center', marginTop: 10, fontFamily: font.regular, fontSize: 13, color: colors.inkMuted },
});
