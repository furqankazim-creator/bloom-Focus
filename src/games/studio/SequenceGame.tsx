import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sequenceSettings, shuffle } from '../../engine/studio';
import { colors, font } from '../../theme';
import { GameBar, StudioGameProps, secondsSince } from './shared';

type Item = { label: string; emoji?: string };

/** Watch the items light up in order, then tap them back in the same order. */
export default function SequenceGame({ content, level, onDone }: StudioGameProps<'sequence'>) {
  const { length: wanted, showMs, rounds } = sequenceSettings(level);
  const length = Math.min(wanted, content.items.length);
  const start = useRef(Date.now());
  const correctRounds = useRef(0);
  const [round, setRound] = useState(0);
  const [seq, setSeq] = useState<Item[]>(() => shuffle(content.items).slice(0, length));
  // Options keep the steps in their original (meaningful) order so routines stay recognisable.
  const options = content.items.filter((it) => seq.includes(it) || content.items.length <= length + 2);
  const [phase, setPhase] = useState<'watch' | 'answer' | 'feedback'>('watch');
  const [lit, setLit] = useState(-1);
  const [taps, setTaps] = useState<Item[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);

  // Show the sequence one item at a time.
  useEffect(() => {
    if (phase !== 'watch') return;
    let i = -1;
    const t = setInterval(() => {
      i++;
      if (i >= seq.length) {
        clearInterval(t);
        setLit(-1);
        setPhase('answer');
        return;
      }
      setLit(i);
    }, showMs);
    return () => clearInterval(t);
  }, [phase, seq, showMs]);

  const endRound = (correct: boolean) => {
    if (correct) correctRounds.current++;
    setOk(correct);
    setPhase('feedback');
    setTimeout(() => {
      if (round + 1 >= rounds) {
        onDone({ accuracy: correctRounds.current / rounds, activeSec: secondsSince(start.current) });
        return;
      }
      setRound((r) => r + 1);
      setSeq(shuffle(content.items).slice(0, length));
      setTaps([]);
      setOk(null);
      setPhase('watch');
    }, 1100);
  };

  const tap = (it: Item) => {
    if (phase !== 'answer') return;
    const next = [...taps, it];
    setTaps(next);
    if (seq[next.length - 1] !== it) return endRound(false);
    if (next.length === seq.length) endRound(true);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <GameBar left={`Round ${round + 1} of ${rounds}`} right={`${length} to remember`} />
      <Text style={styles.prompt}>
        {phase === 'watch' ? 'Watch carefully…' : phase === 'answer' ? `Tap them in order (${taps.length}/${seq.length})` : ok ? 'Great remembering! 🎉' : 'Nearly! Let’s try another.'}
      </Text>
      {phase === 'watch' ? (
        <View style={styles.stage}>
          {lit >= 0 && (
            <View style={styles.big}>
              <Text style={{ fontSize: 64 }}>{seq[lit].emoji ?? '⭐'}</Text>
              <Text style={styles.bigLabel}>{seq[lit].label}</Text>
              <Text style={styles.step}>{lit + 1}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.options}>
          {options.map((it) => {
            const order = taps.indexOf(it);
            return (
              <Pressable key={it.label} onPress={() => tap(it)} style={[styles.option, order >= 0 && styles.optionOn]} accessibilityRole="button" accessibilityLabel={it.label}>
                <Text style={{ fontSize: 34 }}>{it.emoji ?? '⭐'}</Text>
                <Text style={styles.optionLabel} numberOfLines={2}>
                  {it.label}
                </Text>
                {order >= 0 && <Text style={styles.badge}>{order + 1}</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { fontFamily: font.bold, fontSize: 18, color: colors.ink, marginBottom: 16, textAlign: 'center' },
  stage: { height: 220, alignItems: 'center', justifyContent: 'center' },
  big: { width: 190, height: 190, borderRadius: 32, backgroundColor: colors.white, borderWidth: 3, borderColor: '#D9467A', alignItems: 'center', justifyContent: 'center' },
  bigLabel: { fontFamily: font.bold, fontSize: 17, color: colors.ink, marginTop: 6 },
  step: { position: 'absolute', top: 10, left: 14, fontFamily: font.heavy, fontSize: 18, color: '#D9467A' },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 420 },
  option: { width: 110, height: 110, borderRadius: 22, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 6 },
  optionOn: { borderColor: '#D9467A', backgroundColor: '#FBE4EC' },
  optionLabel: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink, textAlign: 'center', marginTop: 4 },
  badge: { position: 'absolute', top: 6, right: 8, fontFamily: font.heavy, fontSize: 15, color: '#D9467A' },
});
