import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../components/ui';
import { colors, font } from '../../theme';
import { Tally, shuffle, useTicker } from '../common';
import { useAuditoryDistraction } from '../useAuditoryDistraction';
import { FeedbackPill, TrainGameProps, easeOut, lerp, useFeedback, useGameEnv } from './shared';

type Piece = { emoji: string; color: string; shape: string };

const PIECES: Piece[] = [
  { emoji: '🔴', color: 'red', shape: 'circle' },
  { emoji: '🟠', color: 'orange', shape: 'circle' },
  { emoji: '🟡', color: 'yellow', shape: 'circle' },
  { emoji: '🟢', color: 'green', shape: 'circle' },
  { emoji: '🔵', color: 'blue', shape: 'circle' },
  { emoji: '🟣', color: 'purple', shape: 'circle' },
  { emoji: '🟥', color: 'red', shape: 'square' },
  { emoji: '🟧', color: 'orange', shape: 'square' },
  { emoji: '🟨', color: 'yellow', shape: 'square' },
  { emoji: '🟩', color: 'green', shape: 'square' },
  { emoji: '🟦', color: 'blue', shape: 'square' },
  { emoji: '🟪', color: 'purple', shape: 'square' },
  { emoji: '🔶', color: 'orange', shape: 'diamond' },
  { emoji: '🔷', color: 'blue', shape: 'diamond' },
  { emoji: '🔺', color: 'red', shape: 'triangle' },
  { emoji: '⭐', color: 'yellow', shape: 'star' },
  { emoji: '❤️', color: 'red', shape: 'heart' },
  { emoji: '💙', color: 'blue', shape: 'heart' },
  { emoji: '💚', color: 'green', shape: 'heart' },
  { emoji: '💜', color: 'purple', shape: 'heart' },
  { emoji: '🧡', color: 'orange', shape: 'heart' },
  { emoji: '💛', color: 'yellow', shape: 'heart' },
];

/** Time allowed to find the target at each speed step. */
const ROUND_MS = [7000, 5800, 4800, 4000, 3200];
const COLOR_WORDS = ['red', 'blue', 'green', 'purple', 'circle', 'square', 'diamond', 'heart'];

type Round = { target: Piece; board: Piece[]; start: number; wrong: number[]; found: number | null; revealed: boolean };

/** More tiles and more look-alikes (same colour or same shape) as distractors rise. */
const TARGET = PIECES.find((p) => p.color === 'blue' && p.shape === 'circle')!;

function makeRound(level: number, start: number): Round {
  const target = TARGET;
  const count = Math.min(12, 4 + level * 2) - 1;
  const others = PIECES.filter((p) => p !== target);
  const similar = shuffle(others.filter((p) => p.color === target.color || p.shape === target.shape));
  const different = shuffle(others.filter((p) => p.color !== target.color && p.shape !== target.shape));
  const nSimilar = Math.min(similar.length, Math.round(count * (0.2 + level * 0.14)));
  const chosen = [...similar.slice(0, nSimilar), ...different].slice(0, count);
  return { target, board: shuffle([target, ...chosen]), start, wrong: [], found: null, revealed: false };
}

export default function FindTarget({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const roundMs = ROUND_MS[params.speed - 1] ?? 4800;
  const { fb, good, bad } = useFeedback();
  const { calm } = useGameEnv();
  const r = useRef({
    elapsed: 0,
    tally: new Tally(),
    round: makeRound(params.distractors, 300),
    nextAt: null as number | null,
    done: false,
  });
  const [, force] = useState(0);

  useAuditoryDistraction(params.distractors >= 5 ? COLOR_WORDS : null, paused);

  useTicker(
    paused,
    (dt) => {
      const s = r.current;
      if (s.done) return;
      s.elapsed += dt;
      const now = s.elapsed;
      const rd = s.round;

      if (s.nextAt === null && rd.found === null && now - rd.start >= roundMs) {
        rd.revealed = true;
        s.tally.miss();
        bad('Here it was 👆');
        s.nextAt = now + 1000;
      }
      // Time up mid-round: the unfinished round isn't counted. Otherwise let the feedback finish first.
      if (now >= durationSec * 1000 && s.nextAt === null) {
        s.done = true;
        onDone(s.tally.result(durationSec * 1000));
        return;
      }
      if (s.nextAt !== null && now >= s.nextAt) {
        if (now >= durationSec * 1000) {
          s.done = true;
          onDone(s.tally.result(durationSec * 1000));
          return;
        }
        s.round = makeRound(params.distractors, now);
        s.nextAt = null;
      }
      force((n) => n + 1);
    },
    50,
  );

  const tap = (i: number) => {
    const s = r.current;
    const rd = s.round;
    if (s.done || paused || s.nextAt !== null || rd.wrong.includes(i)) return;
    if (rd.board[i] === rd.target) {
      rd.found = i;
      s.tally.hit(s.elapsed - rd.start);
      onCorrect();
      good();
      s.nextAt = s.elapsed + 500;
    } else {
      rd.wrong.push(i);
      s.tally.falseTap();
      bad('Not that one');
    }
    force((n) => n + 1);
  };

  const { round, elapsed } = r.current;
  const age = elapsed - round.start;
  const timeLeft = round.found !== null || round.revealed ? 0 : 1 - age / roundMs;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.prompt}>
        <Text style={styles.promptText}>
          Tap the <Text style={{ fontSize: 18 }}>{round.target.emoji}</Text>{' '}
          <Text style={styles.promptBold}>
            {round.target.color} {round.target.shape}
          </Text>
        </Text>
        <View style={{ width: 120, marginTop: 8 }}>
          <ProgressBar value={timeLeft} height={4} color={timeLeft < 0.3 ? '#E8A14A' : '#4A90E2'} />
        </View>
      </View>

      <View style={styles.boardWrap}>
        <FeedbackPill fb={fb} top={0} />
        <View style={styles.board}>
          {round.board.map((p, i) => {
            const k = easeOut((age - i * 35) / 220);
            const isWrong = round.wrong.includes(i);
            const isFound = round.found === i;
            const isReveal = round.revealed && p === round.target;
            return (
              <Pressable
                key={`${round.start}-${i}`}
                onPressIn={() => tap(i)}
                accessibilityLabel={`${p.color} ${p.shape}`}
                style={[
                  styles.tile,
                  { opacity: k, transform: [{ scale: lerp(0.7, isFound ? 1.08 : 1, k) }] },
                  isWrong && (calm ? styles.tileWrongCalm : styles.tileWrong),
                  (isFound || isReveal) && styles.tileFound,
                ]}
              >
                <Text style={[styles.emoji, isWrong && { opacity: 0.35 }]}>{p.emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { alignItems: 'center', paddingTop: 4, paddingBottom: 10 },
  promptText: { fontFamily: font.medium, fontSize: 16, color: colors.inkSoft },
  promptBold: { fontFamily: font.heavy, color: colors.ink },
  boardWrap: { flex: 1, justifyContent: 'center', paddingTop: 44 },
  board: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  tile: {
    width: '30.5%',
    aspectRatio: 1,
    maxWidth: 130,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tileWrong: { backgroundColor: '#FDEDE4', borderColor: '#F0B39A' },
  tileWrongCalm: { backgroundColor: '#F4F3EF' },
  tileFound: { backgroundColor: '#E3F6EE', borderColor: '#1DB988', borderWidth: 2.5 },
  emoji: { fontSize: 36, lineHeight: 46, textAlign: 'center' },
});
