import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, useTicker } from './common';
import { FeedbackPill, useFeedback } from './train/shared';
import { useAuditoryDistraction } from './useAuditoryDistraction';

const TRIAL_MS = [4800, 3800, 3000, 2300, 1750];

type ColorItem = {
  name: string;
  hex: string;
};

const COLOR_PALETTE: ColorItem[] = [
  { name: 'RED', hex: '#EF4444' },
  { name: 'BLUE', hex: '#3B82F6' },
  { name: 'GREEN', hex: '#10B981' },
  { name: 'YELLOW', hex: '#EAB308' },
  { name: 'PURPLE', hex: '#8B5CF6' },
  { name: 'ORANGE', hex: '#F97316' },
];

type Trial = {
  word: ColorItem;
  ink: ColorItem;
  matches: boolean;
};

function makeTrial(distractors: number): Trial {
  const word = pick(COLOR_PALETTE);
  const matchOdds = distractors <= 1 ? 0.6 : 0.45;
  const matches = Math.random() < matchOdds;
  let ink = word;
  if (!matches) {
    const others = COLOR_PALETTE.filter((c) => c.name !== word.name);
    ink = pick(others);
  }
  return { word, ink, matches };
}

export default function ColorClash({ params, paused, onCorrect, onDone }: GameProps) {
  const trialMs = TRIAL_MS[params.speed - 1] ?? 3000;
  const { fb, good, bad } = useFeedback();

  const [trial, setTrial] = useState<Trial>(() => makeTrial(params.distractors));
  const r = useRef({
    elapsed: 0,
    trialAt: 400,
    tally: new Tally(),
    done: false,
    answered: false,
  });
  const [, force] = useState(0);

  // Distraction voices at distractor level 5
  useAuditoryDistraction(params.distractors >= 5 ? ['red', 'blue', 'green', 'yellow'] : null, paused);

  const next = () => {
    const st = r.current;
    st.trialAt = st.elapsed + 280;
    st.answered = false;
    setTrial(makeTrial(params.distractors));
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;

    if (st.elapsed >= params.durationSec * 1000) {
      st.done = true;
      onDone(st.tally.result(st.elapsed));
      return;
    }

    if (!st.answered && st.elapsed - st.trialAt >= trialMs) {
      if (trial.matches) {
        st.tally.miss();
        bad('Time’s up! They matched');
      } else {
        st.tally.reject();
      }
      next();
    }
    force((x) => x + 1);
  });

  const respond = (saidMatch: boolean) => {
    const st = r.current;
    if (st.done || paused || st.answered || st.elapsed < st.trialAt) return;
    st.answered = true;

    if (saidMatch === trial.matches) {
      if (saidMatch) {
        st.tally.hit(st.elapsed - st.trialAt);
        onCorrect();
        good('Match! 🎨');
      } else {
        st.tally.reject();
        onCorrect();
        good('Good catch! Ink clashed ⭐');
      }
    } else {
      st.tally.falseTap();
      bad(trial.matches ? 'Oops! The ink matched the word' : `Oops! Word said ${trial.word.name} but ink was ${trial.ink.name}`);
    }
    next();
  };

  const st = r.current;
  const inGap = st.elapsed < st.trialAt;
  const timeLeft = inGap ? 1 : Math.max(0, 1 - (st.elapsed - st.trialAt) / trialMs);

  return (
    <View style={styles.container}>
      <FeedbackPill fb={fb} top={8} />

      <View style={styles.header}>
        <Text style={styles.title}>Color Clash</Text>
        <Text style={styles.subtitle}>
          Does the <Text style={{ fontFamily: font.bold, color: colors.ink }}>INK COLOR</Text> match the word?
        </Text>
      </View>

      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timeLeft * 100}%` }]} />
      </View>

      {/* Main Flash Card Stage */}
      <View style={styles.stage}>
        {!inGap && (
          <View style={styles.cardBox}>
            <View style={styles.swatchPreview}>
              <View style={[styles.swatchCircle, { backgroundColor: trial.ink.hex }]} />
              <Text style={styles.swatchText}>Ink: {trial.ink.name}</Text>
            </View>

            <Text style={[styles.colorWord, { color: trial.ink.hex }]}>
              {trial.word.name}
            </Text>

            <View style={styles.tipBox}>
              <Text style={styles.tipText}>
                Word is <Text style={{ fontFamily: font.bold }}>{trial.word.name}</Text> in <Text style={{ fontFamily: font.bold }}>{trial.ink.name}</Text> ink
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Two action buttons: CLASH (No) vs MATCH (Yes) */}
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnNo, pressed && styles.btnPressed]}
          onPress={() => respond(false)}
          accessibilityLabel="Clash (No)"
        >
          <Feather name="x" size={26} color={colors.white} />
          <Text style={styles.btnText}>CLASH (NO)</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnYes, pressed && styles.btnPressed]}
          onPress={() => respond(true)}
          accessibilityLabel="Match (Yes)"
        >
          <Feather name="check" size={26} color={colors.white} />
          <Text style={styles.btnText}>MATCH (YES)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  header: { alignItems: 'center', marginVertical: 6 },
  title: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  subtitle: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  timerBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginVertical: 8, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.forest, borderRadius: 3 },
  stage: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E4DC',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    minHeight: 220,
  },
  cardBox: {
    backgroundColor: colors.white,
    paddingHorizontal: 36,
    paddingVertical: 28,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    minWidth: 260,
  },
  swatchPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  swatchCircle: { width: 14, height: 14, borderRadius: 7 },
  swatchText: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft },
  colorWord: {
    fontFamily: font.heavy,
    fontSize: 44,
    letterSpacing: 2,
    marginVertical: 12,
    textAlign: 'center',
  },
  tipBox: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tipText: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted },
  btnRow: { flexDirection: 'row', gap: 14, marginTop: 8, marginBottom: 12 },
  btn: {
    flex: 1,
    height: 72,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  btnNo: { backgroundColor: '#EF5A4C' },
  btnYes: { backgroundColor: '#1DB988' },
  btnPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  btnText: { fontFamily: font.heavy, fontSize: 16, color: colors.white, letterSpacing: 0.5 },
});
