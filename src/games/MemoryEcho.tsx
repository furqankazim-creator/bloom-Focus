import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { colors, font } from '../theme';
import { GameProps, Tally, useTicker } from './common';

const ROUNDS = 5;
const DIGIT_MS = [1100, 950, 800, 650, 500];
const BLANK_MS = 250;
const FEEDBACK_MS = 1400;

type Phase = 'ready' | 'showing' | 'hold' | 'input' | 'feedback';

/** Delayed recall: a wait between seeing and answering, with a moving dot competing for attention. */
const HOLD_MS_PER_LEVEL = 1000;

function makeSequence(n: number): number[] {
  const seq: number[] = [];
  while (seq.length < n) {
    const d = Math.floor(Math.random() * 10);
    if (d !== seq[seq.length - 1]) seq.push(d);
  }
  return seq;
}

export default function MemoryEcho({ params, paused, onCorrect, onDone }: GameProps) {
  const span = params.memoryLoad;
  const perDigit = DIGIT_MS[params.speed - 1] ?? 800;
  const holdMs = params.distractors * HOLD_MS_PER_LEVEL;
  const r = useRef({ elapsed: 0, phaseAt: 0, tally: new Tally(), done: false });
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [seq, setSeq] = useState<number[]>(() => makeSequence(span));
  const [entry, setEntry] = useState<number[]>([]);
  const [lastOk, setLastOk] = useState(false);
  const [, force] = useState(0);

  const go = (p: Phase) => {
    r.current.phaseAt = r.current.elapsed;
    setPhase(p);
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    // Time only counts while the child is actually doing something, not while waiting on "Show me".
    if (phase !== 'ready') st.elapsed += dt;
    const inPhase = st.elapsed - st.phaseAt;
    if (phase === 'showing' && inPhase >= seq.length * (perDigit + BLANK_MS)) go(holdMs > 0 ? 'hold' : 'input');
    if (phase === 'hold' && inPhase >= holdMs) go('input');
    if (phase === 'feedback' && inPhase >= FEEDBACK_MS) {
      if (round >= ROUNDS) {
        st.done = true;
        onDone(st.tally.result(st.elapsed));
        return;
      }
      setRound(round + 1);
      setSeq(makeSequence(span));
      setEntry([]);
      go('ready');
    }
    force((x) => x + 1);
  });

  const press = (d: number) => {
    if (phase !== 'input' || paused) return;
    const next = [...entry, d];
    setEntry(next);
    if (next.length === seq.length) {
      const ok = next.every((x, i) => x === seq[i]);
      const st = r.current;
      if (ok) {
        st.tally.hit();
        onCorrect();
      } else st.tally.miss();
      setLastOk(ok);
      go('feedback');
    }
  };

  const inPhase = r.current.elapsed - r.current.phaseAt;
  const showIndex = Math.floor(inPhase / (perDigit + BLANK_MS));
  const inBlank = inPhase % (perDigit + BLANK_MS) > perDigit;
  const shown = phase === 'showing' && !inBlank ? seq[showIndex] : undefined;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Feather name="eye" size={18} color={colors.forest} />
        <Text style={styles.headerText}>Look, remember, then tap the numbers in order.</Text>
      </View>
      <View style={styles.card}>
        <View style={[styles.display, phase === 'feedback' && { backgroundColor: lastOk ? colors.mint : '#F6E7DE' }]}>
          {phase === 'ready' && <Text style={styles.displayHint}>Round {round} of {ROUNDS} · {span} numbers</Text>}
          {phase === 'showing' && <Text style={styles.digit}>{shown ?? ''}</Text>}
          {phase === 'hold' && (
            <>
              <View
                style={[
                  styles.decoy,
                  { left: `${50 + 38 * Math.sin(inPhase / 350)}%`, top: `${50 + 30 * Math.cos(inPhase / 470)}%` },
                ]}
              />
              <Text style={styles.displayHint}>Hold it in your mind… {Math.ceil((holdMs - inPhase) / 1000)}</Text>
            </>
          )}
          {phase === 'input' && <Text style={styles.displayHint}>Sequence tucked away</Text>}
          {phase === 'feedback' && (
            <Text style={styles.feedback}>{lastOk ? 'You got it!' : `It was ${seq.join(' ')}`}</Text>
          )}
        </View>

        {phase === 'ready' ? (
          <Button label="Show me" icon="eye" variant="soft" onPress={() => go('showing')} />
        ) : (
          <>
            <View style={styles.slots}>
              {seq.map((_, i) => (
                <View key={i} style={[styles.slot, i === entry.length && phase === 'input' && styles.slotActive]}>
                  <Text style={styles.slotText}>{entry[i] ?? '·'}</Text>
                </View>
              ))}
            </View>
            <View style={styles.pad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => press(d)}
                  disabled={phase !== 'input'}
                  style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.sage }, phase !== 'input' && { opacity: 0.4 }]}
                >
                  <Text style={styles.keyText}>{d}</Text>
                </Pressable>
              ))}
            </View>
            {phase === 'input' && entry.length > 0 && (
              <Pressable onPress={() => setEntry(entry.slice(0, -1))} style={styles.undo} hitSlop={8}>
                <Feather name="delete" size={18} color={colors.inkSoft} />
                <Text style={styles.undoText}>Undo</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  headerText: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.inkSoft },
  card: { backgroundColor: colors.card, borderRadius: 28, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 18 },
  display: { height: 130, overflow: 'hidden', borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  decoy: { position: 'absolute', width: 18, height: 18, borderRadius: 9, marginLeft: -9, marginTop: -9, backgroundColor: colors.peach },
  displayHint: { fontFamily: font.medium, fontSize: 16, color: colors.inkSoft },
  digit: { fontFamily: font.heavy, fontSize: 72, color: colors.ink },
  feedback: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  slots: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  slot: {
    width: 46,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActive: { borderColor: colors.forest, borderWidth: 2 },
  slotText: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  key: {
    width: '17%',
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: font.semibold, fontSize: 24, color: colors.ink },
  undo: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6 },
  undoText: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft },
});
