import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, useTicker } from './common';
import { SHAPES, SHAPE_COLORS, Shape, ShapeColor, ShapeIcon } from './parts';

const TRIAL_MS = [8000, 6500, 5000, 4000, 3000];
const GAP_MS = 550;
/** Levels 0–1 switch on a fixed beat (predictable); 2+ switch at random with rising odds. */
const FIXED_EVERY: Record<number, number | undefined> = { 0: 6, 1: 4 };
const SWITCH_ODDS = [0, 0, 0.3, 0.4, 0.5, 0.5];
/** From level 4 the big "new rule" banner goes away; only the sign changes. */
const BANNER_UNTIL = 4;

type Rule = 'color' | 'shape';
type Card = { shape: Shape; color: ShapeColor };
type Trial = { card: Card; bins: [Card, Card]; correct: 0 | 1 };

const SHAPE_KEYS = Object.keys(SHAPES) as Shape[];
const COLOR_KEYS = Object.keys(SHAPE_COLORS) as ShapeColor[];

/** One bin shares the card's colour, the other its shape, so the rule decides the answer. */
function makeTrial(rule: Rule): Trial {
  const card = { shape: pick(SHAPE_KEYS), color: pick(COLOR_KEYS) };
  const byColor: Card = { color: card.color, shape: pick(SHAPE_KEYS.filter((s) => s !== card.shape)) };
  const byShape: Card = { shape: card.shape, color: pick(COLOR_KEYS.filter((c) => c !== card.color)) };
  const colorFirst = Math.random() < 0.5;
  const bins: [Card, Card] = colorFirst ? [byColor, byShape] : [byShape, byColor];
  const correct = (rule === 'color') === colorFirst ? 0 : 1;
  return { card, bins, correct };
}

export default function SwitchSort({ params, paused, onCorrect, onDone }: GameProps) {
  const level = params.distractors;
  const trialMs = TRIAL_MS[params.speed - 1] ?? 5000;
  const r = useRef({
    elapsed: 0,
    trialAt: 600,
    gapUntil: 600,
    sinceSwitch: 0,
    tally: new Tally(),
    done: false,
  });
  const [rule, setRule] = useState<Rule>(() => pick(['color', 'shape'] as Rule[]));
  const [trial, setTrial] = useState<Trial>(() => makeTrial(rule));
  const [switched, setSwitched] = useState(false);
  const [feedback, setFeedback] = useState<'good' | 'oops' | null>(null);
  const [, force] = useState(0);

  const next = () => {
    const st = r.current;
    st.gapUntil = st.elapsed + GAP_MS;
    st.trialAt = st.gapUntil;
    st.sinceSwitch++;
    const fixed = FIXED_EVERY[level];
    const doSwitch = fixed !== undefined ? st.sinceSwitch >= fixed : Math.random() < (SWITCH_ODDS[level] ?? 0.4);
    let nextRule = rule;
    if (doSwitch) {
      nextRule = rule === 'color' ? 'shape' : 'color';
      st.sinceSwitch = 0;
    }
    setRule(nextRule);
    setSwitched(doSwitch);
    setTrial(makeTrial(nextRule));
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
      setFeedback('oops');
      next();
    }
    force((x) => x + 1);
  });

  const choose = (i: 0 | 1) => {
    const st = r.current;
    if (paused || st.done || st.elapsed < st.gapUntil) return;
    if (i === trial.correct) {
      st.tally.hit(st.elapsed - st.trialAt);
      onCorrect();
      setFeedback('good');
    } else {
      // Sorting by the old rule after a switch is the classic flexibility error.
      st.tally.falseTap();
      setFeedback('oops');
    }
    next();
  };

  const st = r.current;
  const inGap = st.elapsed < st.gapUntil;
  const timeLeft = inGap ? 1 : Math.max(0, 1 - (st.elapsed - st.trialAt) / trialMs);
  const showBanner = switched && level < BANNER_UNTIL && !inGap && st.elapsed - st.trialAt < 1200;
  const subtle = level >= BANNER_UNTIL;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.sign, { backgroundColor: rule === 'color' ? colors.butter : colors.sky }, subtle && styles.signSubtle]}>
        <MaterialCommunityIcons name={rule === 'color' ? 'palette' : 'shape'} size={subtle ? 22 : 28} color={colors.ink} />
        <Text style={[styles.signText, subtle && { fontSize: 16 }]}>Sort by {rule === 'color' ? 'COLOUR' : 'SHAPE'}</Text>
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
        <View style={styles.cardWrap}>{!inGap && <ShapeIcon shape={trial.card.shape} color={trial.card.color} size={130} />}</View>
        <View style={styles.bins}>
          {trial.bins.map((b, i) => (
            <Pressable
              key={i}
              onPress={() => choose(i as 0 | 1)}
              style={({ pressed }) => [styles.bin, pressed && { backgroundColor: colors.sage }]}
              accessibilityLabel={`Bin with ${b.color} ${b.shape}`}
            >
              <ShapeIcon shape={b.shape} color={b.color} size={64} />
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.foot}>Tap the box that matches by the rule on the sign</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 20,
    paddingVertical: 14,
    marginBottom: 10,
  },
  signSubtle: { paddingVertical: 8, alignSelf: 'center', paddingHorizontal: 18 },
  signText: { fontFamily: font.bold, fontSize: 20, letterSpacing: 1, color: colors.ink },
  timer: { height: 6, borderRadius: 3, backgroundColor: '#ECEBE4', marginBottom: 12, overflow: 'hidden' },
  timerFill: { height: 6, backgroundColor: colors.leaf },
  area: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: 'space-between',
  },
  banner: { position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: colors.lime, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, zIndex: 2 },
  bannerText: { fontFamily: font.bold, fontSize: 14, color: colors.forestDeep },
  cardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 150 },
  bins: { flexDirection: 'row', gap: 14 },
  bin: {
    flex: 1,
    height: 120,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foot: { textAlign: 'center', marginTop: 10, fontFamily: font.regular, fontSize: 13, color: colors.inkMuted },
});
