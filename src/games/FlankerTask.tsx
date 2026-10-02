import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, useTicker } from './common';
import { FeedbackPill, useFeedback } from './train/shared';
import { useAuditoryDistraction } from './useAuditoryDistraction';

export type Direction = 'left' | 'right' | 'up' | 'down';
const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

const ROTATION: Record<Direction, string> = {
  up: '0deg',
  right: '90deg',
  down: '180deg',
  left: '270deg',
};

const TRIAL_MS = [5000, 4200, 3400, 2700, 2100];
const AUDITORY_DIRECTIONS = ['left', 'right', 'up', 'down'];

type Trial = {
  center: Direction;
  flankers: Direction;
  isCongruent: boolean;
};

function makeTrial(distractors: number): Trial {
  const center = pick(DIRECTIONS);
  let flankers = center;
  const isCongruent = distractors <= 1 ? Math.random() < 0.75 : Math.random() < 0.4;
  if (!isCongruent) {
    const others = DIRECTIONS.filter((d) => d !== center);
    flankers = pick(others);
  }
  return { center, flankers, isCongruent };
}

export default function FlankerTask({ params, paused, onCorrect, onDone }: GameProps) {
  const trialMs = TRIAL_MS[params.speed - 1] ?? 3400;
  const { fb, good, bad } = useFeedback();

  const r = useRef({
    elapsed: 0,
    trialAt: 400,
    tally: new Tally(),
    done: false,
    answered: false,
  });

  const [trial, setTrial] = useState<Trial>(() => makeTrial(params.distractors));
  const [, force] = useState(0);

  // Auditory distraction at distractor level 5
  useAuditoryDistraction(params.distractors >= 5 ? AUDITORY_DIRECTIONS : null, paused);

  const next = () => {
    const st = r.current;
    st.trialAt = st.elapsed + 350;
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
      st.tally.miss();
      bad('Time’s up! Look for the center bird');
      next();
    }
    force((x) => x + 1);
  });

  const respond = (dir: Direction) => {
    const st = r.current;
    if (st.done || paused || st.answered || st.elapsed < st.trialAt) return;
    st.answered = true;

    if (dir === trial.center) {
      st.tally.hit(st.elapsed - st.trialAt);
      onCorrect();
      good(trial.isCongruent ? 'Great focus!' : 'Tuned out the flock! ⭐');
    } else {
      st.tally.falseTap();
      bad('Watch the center bird!');
    }
    next();
  };

  const st = r.current;
  const inGap = st.elapsed < st.trialAt;
  const timeLeft = inGap ? 1 : Math.max(0, 1 - (st.elapsed - st.trialAt) / trialMs);
  const showBackgroundClutter = params.distractors >= 4;

  return (
    <View style={styles.container}>
      <FeedbackPill fb={fb} top={8} />

      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>Flock Focus</Text>
        <Text style={styles.instructionSub}>
          Tap the direction the <Text style={{ fontFamily: font.bold, color: '#D97706' }}>CENTER</Text> bird is flying
        </Text>
      </View>

      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timeLeft * 100}%` }]} />
      </View>

      {/* Sky Play Area */}
      <View style={styles.skyArea}>
        {showBackgroundClutter && (
          <View style={styles.clutterRow} pointerEvents="none">
            <MaterialCommunityIcons name="cloud" size={28} color="#D7E8DE" />
            <MaterialCommunityIcons name="leaf" size={20} color="#CCE0D4" style={{ marginTop: 20 }} />
            <MaterialCommunityIcons name="cloud" size={34} color="#DCEEE3" />
          </View>
        )}

        {!inGap && (
          <View style={styles.flockContainer}>
            {/* Flanker 1 */}
            <View style={[styles.birdWrap, { transform: [{ rotate: ROTATION[trial.flankers] }] }]}>
              <MaterialCommunityIcons name="bird" size={42} color="#7BA08B" />
            </View>

            {/* Flanker 2 */}
            <View style={[styles.birdWrap, { transform: [{ rotate: ROTATION[trial.flankers] }] }]}>
              <MaterialCommunityIcons name="bird" size={42} color="#7BA08B" />
            </View>

            {/* Target Center Bird (Highlight Gold/Amber) */}
            <View style={[styles.birdWrap, styles.centerBirdWrap, { transform: [{ rotate: ROTATION[trial.center] }] }]}>
              <MaterialCommunityIcons name="bird" size={54} color="#F59E0B" />
            </View>

            {/* Flanker 3 */}
            <View style={[styles.birdWrap, { transform: [{ rotate: ROTATION[trial.flankers] }] }]}>
              <MaterialCommunityIcons name="bird" size={42} color="#7BA08B" />
            </View>

            {/* Flanker 4 */}
            <View style={[styles.birdWrap, { transform: [{ rotate: ROTATION[trial.flankers] }] }]}>
              <MaterialCommunityIcons name="bird" size={42} color="#7BA08B" />
            </View>
          </View>
        )}

        <View style={styles.guideBadge}>
          <Text style={styles.guideText}>Center bird: 🎯</Text>
        </View>
      </View>

      {/* 4-Way Directional Controls (D-Pad style with large touch targets) */}
      <View style={styles.controlsArea}>
        <View style={styles.controlRow}>
          <Pressable
            style={({ pressed }) => [styles.arrowBtn, pressed && styles.arrowBtnPressed]}
            onPress={() => respond('up')}
            accessibilityLabel="Up"
          >
            <Feather name="arrow-up" size={32} color={colors.white} />
          </Pressable>
        </View>

        <View style={[styles.controlRow, { gap: 40 }]}>
          <Pressable
            style={({ pressed }) => [styles.arrowBtn, pressed && styles.arrowBtnPressed]}
            onPress={() => respond('left')}
            accessibilityLabel="Left"
          >
            <Feather name="arrow-left" size={32} color={colors.white} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.arrowBtn, pressed && styles.arrowBtnPressed]}
            onPress={() => respond('right')}
            accessibilityLabel="Right"
          >
            <Feather name="arrow-right" size={32} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.controlRow}>
          <Pressable
            style={({ pressed }) => [styles.arrowBtn, pressed && styles.arrowBtnPressed]}
            onPress={() => respond('down')}
            accessibilityLabel="Down"
          >
            <Feather name="arrow-down" size={32} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  instructionCard: { alignItems: 'center', marginVertical: 6 },
  instructionTitle: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  instructionSub: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  timerBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginVertical: 8, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.forest, borderRadius: 3 },
  skyArea: {
    flex: 1,
    backgroundColor: '#EAF3ED',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D3E5DA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 220,
  },
  clutterRow: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.6,
  },
  flockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  birdWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBirdWrap: {
    width: 64,
    height: 64,
    backgroundColor: '#FEF3C7',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  guideBadge: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  guideText: { fontFamily: font.semibold, fontSize: 12, color: colors.inkSoft },
  controlsArea: { marginTop: 14, marginBottom: 8, alignItems: 'center' },
  controlRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  arrowBtn: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.forestDeep,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  arrowBtnPressed: {
    backgroundColor: colors.forestDeep,
    transform: [{ scale: 0.94 }],
  },
});
