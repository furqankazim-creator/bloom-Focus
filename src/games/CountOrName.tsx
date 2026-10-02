import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, shuffle, useTicker } from './common';

const TRIAL_MS = [8000, 6500, 5000, 4000, 3000];
const GAP_MS = 550;
/** Same switching ladder as Switch Sort: fixed beat at 0–1, random and more frequent from 2. */
const FIXED_EVERY: Record<number, number | undefined> = { 0: 6, 1: 4 };
const SWITCH_ODDS = [0, 0, 0.3, 0.4, 0.5, 0.5];
const BANNER_UNTIL = 4;

type Rule = 'count' | 'name';
type Trial = { digit: number; count: number };

/** The count never equals the digit, so the rule — not the picture — decides the answer. */
function makeTrial(): Trial {
  const digit = pick([1, 2, 3, 4]);
  const count = pick([1, 2, 3, 4].filter((n) => n !== digit));
  return { digit, count };
}

export default function CountOrName({ params, paused, onCorrect, onDone }: GameProps) {
  const level = params.distractors;
  const trialMs = TRIAL_MS[params.speed - 1] ?? 5000;
  const r = useRef({ elapsed: 0, trialAt: 600, gapUntil: 600, sinceSwitch: 0, tally: new Tally(), done: false });
  const [rule, setRule] = useState<Rule>(() => pick(['count', 'name'] as Rule[]));
  const [trial, setTrial] = useState<Trial>(makeTrial);
  const [switched, setSwitched] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'oops' | null>(null);
  const [, force] = useState(0);
  // Scatter positions so the copies can't be read as a single number.
  const [spots] = useState(() => shuffle([0, 1, 2, 3, 4, 5]));

  const next = () => {
    const st = r.current;
    st.gapUntil = st.elapsed + GAP_MS;
    st.trialAt = st.gapUntil;
    st.sinceSwitch++;
    const fixed = FIXED_EVERY[level];
    const doSwitch = fixed !== undefined ? st.sinceSwitch >= fixed : Math.random() < (SWITCH_ODDS[level] ?? 0.4);
    if (doSwitch) st.sinceSwitch = 0;
    setRule(doSwitch ? (rule === 'count' ? 'name' : 'count') : rule);
    setSwitched(doSwitch);
    setTrial(makeTrial());
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;
    const inGap = st.elapsed < st.gapUntil;
    if (!inGap) setFeedback(null);
    if (!inGap && st.elapsed >= params.durationSec * 1000) {
      st.done = true;
      onDone(st.tally.result(st.elapsed));
      return;
    }
    if (!inGap && st.elapsed - st.trialAt >= trialMs) {
      st.tally.miss();
      next();
    }
    force((x) => x + 1);
  });

  const answer = (n: number) => {
    const st = r.current;
    if (paused || st.done || st.elapsed < st.gapUntil) return;
    if (n === (rule === 'count' ? trial.count : trial.digit)) {
      st.tally.hit(st.elapsed - st.trialAt);
      onCorrect();
      setFeedback('good');
    } else {
      st.tally.falseTap();
      setFeedback('oops');
    }
    next();
  };

  const st = r.current;
  const inGap = st.elapsed < st.gapUntil;
  const timeLeft = inGap ? 1 : Math.max(0, 1 - (st.elapsed - st.trialAt) / trialMs);
  const subtle = level >= BANNER_UNTIL;
  const showBanner = switched && !subtle && !inGap && st.elapsed - st.trialAt < 1200;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.sign, { backgroundColor: rule === 'count' ? colors.butter : colors.sky }, subtle && styles.signSubtle]}>
        <MaterialCommunityIcons name={rule === 'count' ? 'counter' : 'format-text'} size={subtle ? 22 : 28} color={colors.ink} />
        <Text style={[styles.signText, subtle && { fontSize: 16 }]}>{rule === 'count' ? 'HOW MANY?' : 'WHICH NUMBER?'}</Text>
      </View>
      <View style={styles.timer}>
        <View style={[styles.timerFill, { width: `${timeLeft * 100}%` }]} />
      </View>

      <View style={[styles.area, feedback === 'good' && { borderColor: colors.leaf, borderWidth: 3 }]}>
        {showBanner && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>New rule!</Text>
          </View>
        )}
        <View style={styles.field}>
          {!inGap &&
            spots.slice(0, trial.count).map((spot) => (
              <View key={spot} style={[styles.spot, { left: `${(spot % 3) * 33 + 4}%`, top: `${Math.floor(spot / 3) * 50 + 8}%` }]}>
                <Text style={styles.digit}>{trial.digit}</Text>
              </View>
            ))}
        </View>
        <View style={styles.answers}>
          {[1, 2, 3, 4].map((n) => (
            <Pressable
              key={n}
              onPress={() => answer(n)}
              style={({ pressed }) => [styles.answer, pressed && { backgroundColor: colors.sage }]}
              accessibilityRole="button"
              accessibilityLabel={`Answer ${n}`}
            >
              <Text style={styles.answerText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.foot}>Count them, or name the number — the sign decides</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 20, paddingVertical: 14, marginBottom: 10 },
  signSubtle: { paddingVertical: 8, alignSelf: 'center', paddingHorizontal: 18 },
  signText: { fontFamily: font.bold, fontSize: 20, letterSpacing: 1, color: colors.ink },
  timer: { height: 6, borderRadius: 3, backgroundColor: '#ECEBE4', marginBottom: 12, overflow: 'hidden' },
  timerFill: { height: 6, backgroundColor: colors.leaf },
  area: { flex: 1, backgroundColor: colors.card, borderRadius: 28, borderWidth: 1, borderColor: colors.border, padding: 16, justifyContent: 'space-between' },
  banner: { position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: colors.lime, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, zIndex: 2 },
  bannerText: { fontFamily: font.bold, fontSize: 14, color: colors.forestDeep },
  field: { flex: 1, minHeight: 180 },
  spot: { position: 'absolute', width: '26%', alignItems: 'center' },
  digit: { fontFamily: font.heavy, fontSize: 64, color: colors.forest },
  answers: { flexDirection: 'row', gap: 10 },
  answer: { flex: 1, height: 72, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  answerText: { fontFamily: font.bold, fontSize: 28, color: colors.ink },
  foot: { textAlign: 'center', marginTop: 10, fontFamily: font.regular, fontSize: 13, color: colors.inkMuted },
});
