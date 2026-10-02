import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { Tally, useTicker } from '../common';
import { FeedbackPill, MAX_SEQUENCE, TrainGameProps, useFeedback } from './shared';

const PURPLE = '#8E5CF7';
/** How long each cell stays lit at each speed step. */
const SHOW_MS = [900, 750, 620, 520, 430];
const GAP_MS = 260;
const CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_LEN = MAX_SEQUENCE;

type Phase = 'ready' | 'show' | 'hold' | 'input' | 'result';

function makeSeq(len: number): number[] {
  const seq: number[] = [];
  while (seq.length < len) {
    const n = 1 + Math.floor(Math.random() * 9);
    if (n !== seq[seq.length - 1]) seq.push(n);
  }
  return seq;
}

export default function MemorySequence({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const showMs = SHOW_MS[params.speed - 1] ?? 620;
  // "Distractors" in this task means a recall delay, with flickering cells from level 3.
  const holdMs = params.distractors * 700;
  const minLen = Math.max(2, Math.min(MAX_LEN, params.memoryLoad) - 1);
  const maxLen = Math.min(MAX_LEN, params.memoryLoad + 2);
  const { fb, good, bad, info } = useFeedback();
  const r = useRef({
    elapsed: 0,
    tally: new Tally(),
    len: Math.min(MAX_LEN, params.memoryLoad),
    okInRow: 0,
    seq: [] as number[],
    input: [] as number[],
    phase: 'ready' as Phase,
    phaseAt: 0,
    success: false,
    wrongCell: null as number | null,
    earlyTapped: false,
    tapFlash: null as { cell: number; at: number } | null,
    done: false,
  });
  const [, force] = useState(0);

  const go = (phase: Phase) => {
    r.current.phase = phase;
    r.current.phaseAt = r.current.elapsed;
  };

  useTicker(
    paused,
    (dt) => {
      const s = r.current;
      if (s.done) return;
      s.elapsed += dt;
      const t = s.elapsed - s.phaseAt;

      if (s.elapsed >= durationSec * 1000 && s.phase !== 'result') {
        s.done = true;
        onDone(s.tally.result(durationSec * 1000));
        return;
      }

      if (s.phase === 'ready' && t >= 700) {
        s.seq = makeSeq(s.len);
        s.input = [];
        s.wrongCell = null;
        s.earlyTapped = false;
        go('show');
      } else if (s.phase === 'show' && t >= s.seq.length * (showMs + GAP_MS)) {
        go(holdMs > 0 ? 'hold' : 'input');
      } else if (s.phase === 'hold' && t >= holdMs) {
        go('input');
      } else if (s.phase === 'input' && t >= 4000 + s.seq.length * 1500) {
        s.tally.miss();
        s.success = false;
        s.okInRow = 0;
        s.len = Math.max(minLen, s.len - 1);
        bad('Time’s up!');
        go('result');
      } else if (s.phase === 'result' && t >= 900) {
        if (s.elapsed >= durationSec * 1000) {
          s.done = true;
          onDone(s.tally.result(durationSec * 1000));
          return;
        }
        go('ready');
      }
      force((n) => n + 1);
    },
    40,
  );

  const tap = (cell: number) => {
    const s = r.current;
    if (s.done || paused) return;
    if (s.phase === 'show' || s.phase === 'hold') {
      // Tapping before your turn is an impulsive response; counted once per round.
      if (!s.earlyTapped) {
        s.earlyTapped = true;
        s.tally.falseTap();
        bad('Wait for your turn');
      }
      return;
    }
    if (s.phase !== 'input') return;
    s.tapFlash = { cell, at: s.elapsed };
    const expected = s.seq[s.input.length];
    if (cell === expected) {
      s.input.push(cell);
      if (s.input.length === s.seq.length) {
        s.tally.hit(s.elapsed - s.phaseAt);
        onCorrect();
        s.success = true;
        s.okInRow++;
        if (s.okInRow >= 2 && s.len < maxLen) {
          s.len++;
          s.okInRow = 0;
          info(`Level up! ${s.len} to remember 🚀`);
        } else good();
        go('result');
      }
    } else {
      s.wrongCell = cell;
      s.tally.miss();
      s.success = false;
      s.okInRow = 0;
      s.len = Math.max(minLen, s.len - 1);
      bad('Not quite. Next one!');
      go('result');
    }
    force((n) => n + 1);
  };

  const s = r.current;
  const t = s.elapsed - s.phaseAt;
  const step = Math.floor(t / (showMs + GAP_MS));
  const lit = s.phase === 'show' && t % (showMs + GAP_MS) < showMs ? s.seq[step] : null;
  // Distracting flickers during the recall delay at higher levels.
  const flicker = s.phase === 'hold' && params.distractors >= 3 ? 1 + (Math.floor(s.elapsed / 380) * 7) % 9 : null;
  const expected = s.phase === 'result' && !s.success ? s.seq[s.input.length] : null;

  const status =
    s.phase === 'show'
      ? { big: '👀', text: 'Watch the numbers…' }
      : s.phase === 'hold'
        ? { big: '🤔', text: 'Hold it in your mind…' }
        : s.phase === 'input'
          ? { big: '👆', text: `Now tap them in order (${s.input.length}/${s.seq.length})` }
          : s.phase === 'result'
            ? { big: s.success ? '✅' : '💭', text: s.success ? 'You got it!' : 'Good try!' }
            : { big: '🧠', text: 'Get ready…' };

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.status}>{status.text}</Text>
      <View style={styles.dots}>
        {Array.from({ length: s.phase === 'ready' ? s.len : s.seq.length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              (i < s.input.length || (s.phase === 'result' && s.success)) && { backgroundColor: PURPLE },
              s.phase === 'show' && i === step && lit !== null && { backgroundColor: '#C9B5FB' },
            ]}
          />
        ))}
      </View>

      <View style={styles.middle}>
        <FeedbackPill fb={fb} top={4} />
        {s.phase === 'show' ? (
          <View style={[styles.digitBox, lit === null && { opacity: 0 }]}>
            <Text style={styles.digit}>{lit ?? ''}</Text>
          </View>
        ) : (
          <Text style={styles.big}>{status.big}</Text>
        )}
      </View>

      <View style={styles.pad}>
        {CELLS.map((n) => {
          const flash = s.tapFlash && s.tapFlash.cell === n && s.elapsed - s.tapFlash.at < 220;
          const isWrong = s.phase === 'result' && s.wrongCell === n;
          const isExpected = expected === n;
          return (
            <Pressable
              key={n}
              onPressIn={() => tap(n)}
              accessibilityLabel={`Number ${n}`}
              style={[
                styles.cell,
                flicker === n && { backgroundColor: '#EFEDE7' },
                flash && { backgroundColor: '#E9E0FE', borderColor: PURPLE },
                isWrong && { backgroundColor: '#FDEDE4', borderColor: '#E07A5F' },
                isExpected && { borderColor: '#1DB988', borderWidth: 3 },
              ]}
            >
              <Text style={styles.cellText}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { textAlign: 'center', fontFamily: font.medium, fontSize: 15, color: colors.inkSoft, marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, minHeight: 6 },
  dot: { width: 22, height: 6, borderRadius: 3, backgroundColor: '#E4E2DA' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 80 },
  big: { fontSize: 54, lineHeight: 66 },
  digitBox: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  digit: { fontFamily: font.heavy, fontSize: 64, lineHeight: 76, color: colors.white },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingBottom: 6 },
  cell: {
    width: '30.5%',
    aspectRatio: 1.05,
    maxWidth: 130,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontFamily: font.heavy, fontSize: 24, color: colors.ink },
});
