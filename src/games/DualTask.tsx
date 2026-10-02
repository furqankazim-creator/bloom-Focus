import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, useTicker } from './common';
import { FeedbackPill, useFeedback } from './train/shared';

const TRIAL_MS = [6500, 5500, 4600, 3800, 3000];

const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart'] as const;
type ShapeName = typeof SHAPES[number];

const SHAPE_ICONS: Record<ShapeName, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  circle: 'circle',
  square: 'square',
  triangle: 'triangle',
  star: 'star',
  heart: 'heart',
};

const AUDIO_WORDS = ['bell', 'whistle', 'drum', 'horn'] as const;
type AudioWord = typeof AUDIO_WORDS[number];

export default function DualTask({ params, paused, onCorrect, onDone }: GameProps) {
  const trialMs = TRIAL_MS[params.speed - 1] ?? 4600;
  const showColors = params.distractors >= 2;
  const requireSound = params.distractors >= 3;
  const { fb, good, bad } = useFeedback();

  const r = useRef({
    elapsed: 0,
    trialAt: 500,
    tally: new Tally(),
    done: false,
    answeredVisual: false,
    answeredAudio: false,
  });

  const [visualTarget, setVisualTarget] = useState<ShapeName>(() => pick(SHAPES));
  const [visualPresent, setVisualPresent] = useState<ShapeName>(() => pick(SHAPES));
  const [audioTarget, setAudioTarget] = useState<AudioWord>(() => pick(AUDIO_WORDS));
  const [audioPresent, setAudioPresent] = useState<AudioWord | 'none'>(() => pick([...AUDIO_WORDS, 'none']));

  const [, force] = useState(0);

  const speakWord = (word: string) => {
    Speech.stop();
    if (!paused) {
      Speech.speak(word, { rate: 0.9, pitch: 1.1 });
    }
  };

  useEffect(() => {
    if (paused) Speech.stop();
  }, [paused]);

  useEffect(() => () => void Speech.stop(), []);

  const next = () => {
    const st = r.current;
    st.trialAt = st.elapsed + 400;
    st.answeredVisual = false;
    st.answeredAudio = false;

    const nextVTarget = pick(SHAPES);
    const vMatch = Math.random() < 0.45;
    const nextVPresent = vMatch ? nextVTarget : pick(SHAPES.filter((s) => s !== nextVTarget));
    setVisualTarget(nextVTarget);
    setVisualPresent(nextVPresent);

    if (requireSound) {
      const nextATarget = pick(AUDIO_WORDS);
      const aMatch = Math.random() < 0.4;
      const options: (AudioWord | 'none')[] = [...AUDIO_WORDS.filter((w) => w !== nextATarget), 'none'];
      const nextAPresent: AudioWord | 'none' = aMatch ? nextATarget : pick(options);
      setAudioTarget(nextATarget);
      setAudioPresent(nextAPresent);

      if (nextAPresent !== 'none') {
        speakWord(nextAPresent);
      }
    }
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;

    if (st.elapsed >= params.durationSec * 1000) {
      st.done = true;
      Speech.stop();
      onDone(st.tally.result(st.elapsed));
      return;
    }

    if (st.elapsed - st.trialAt >= trialMs) {
      const visualMiss = visualTarget === visualPresent && !st.answeredVisual;
      const audioMiss = requireSound && audioTarget === audioPresent && !st.answeredAudio;

      if (visualMiss || audioMiss) {
        st.tally.miss();
        bad('Time’s up!');
      } else {
        st.tally.reject();
      }
      next();
    }
    force((x) => x + 1);
  });

  const handleVisualTap = () => {
    const st = r.current;
    if (st.done || paused || st.answeredVisual || st.elapsed < st.trialAt) return;
    st.answeredVisual = true;

    if (visualTarget === visualPresent) {
      st.tally.hit(st.elapsed - st.trialAt);
      onCorrect();
      good('Shape match! 👁️');
    } else {
      st.tally.falseTap();
      bad('Shapes did not match!');
    }
  };

  const handleAudioTap = () => {
    const st = r.current;
    if (st.done || paused || st.answeredAudio || st.elapsed < st.trialAt) return;
    st.answeredAudio = true;

    if (audioTarget === audioPresent) {
      st.tally.hit(st.elapsed - st.trialAt);
      onCorrect();
      good('Sound match! 👂');
    } else {
      st.tally.falseTap();
      bad('Sound did not match!');
    }
  };

  const st = r.current;
  const inGap = st.elapsed < st.trialAt;
  const timeLeft = inGap ? 1 : Math.max(0, 1 - (st.elapsed - st.trialAt) / trialMs);

  return (
    <View style={styles.container}>
      <FeedbackPill fb={fb} top={8} />

      <View style={styles.header}>
        <Text style={styles.title}>Multi-Modal Focus</Text>
        <Text style={styles.subtitle}>
          Tap when the screen matches target shape{requireSound ? ' or spoken sound' : ''}
        </Text>
      </View>

      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timeLeft * 100}%` }]} />
      </View>

      {/* Target Mission Badges */}
      <View style={styles.missionRow}>
        <View style={styles.missionChip}>
          <Text style={styles.missionLabel}>LOOK FOR:</Text>
          <Text style={styles.missionVal}>{visualTarget.toUpperCase()}</Text>
        </View>
        {requireSound && (
          <View style={[styles.missionChip, { backgroundColor: '#F0EAFE', borderColor: '#DDD6FE' }]}>
            <Text style={[styles.missionLabel, { color: '#6D28D9' }]}>LISTEN FOR:</Text>
            <Text style={[styles.missionVal, { color: '#6D28D9' }]}>{audioTarget.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Central Stimulus Display */}
      <View style={styles.stage}>
        {!inGap && (
          <View style={[styles.shapeBox, showColors && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
            <MaterialCommunityIcons
              name={SHAPE_ICONS[visualPresent]}
              size={100}
              color={showColors ? '#4F46E5' : colors.forest}
            />
          </View>
        )}

        {requireSound && !inGap && (
          <View style={styles.audioStatus}>
            <Feather name="volume-2" size={20} color={colors.forest} />
            <Text style={styles.audioStatusText}>
              {audioPresent === 'none' ? 'Silence' : `Spoken: "${audioPresent}"`}
            </Text>
          </View>
        )}
      </View>

      {/* Split Control Buttons */}
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnVisual, pressed && styles.btnPressed, st.answeredVisual && styles.btnDisabled]}
          onPress={handleVisualTap}
          accessibilityLabel="Shape Match"
        >
          <Feather name="eye" size={24} color={colors.white} />
          <Text style={styles.btnText}>SHAPE MATCH</Text>
        </Pressable>

        {requireSound && (
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnAudio, pressed && styles.btnPressed, st.answeredAudio && styles.btnDisabled]}
            onPress={handleAudioTap}
            accessibilityLabel="Sound Match"
          >
            <Feather name="headphones" size={24} color={colors.white} />
            <Text style={styles.btnText}>SOUND MATCH</Text>
          </Pressable>
        )}
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
  missionRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 6 },
  missionChip: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  missionLabel: { fontFamily: font.bold, fontSize: 11, color: colors.forest, letterSpacing: 0.5 },
  missionVal: { fontFamily: font.heavy, fontSize: 16, color: colors.forest, marginTop: 2 },
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
    position: 'relative',
  },
  shapeBox: {
    backgroundColor: colors.white,
    padding: 30,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  audioStatus: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  audioStatusText: { fontFamily: font.semibold, fontSize: 13, color: colors.forest },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 12 },
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
  btnVisual: { backgroundColor: colors.forest },
  btnAudio: { backgroundColor: '#7C3AED' },
  btnPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: font.heavy, fontSize: 15, color: colors.white, letterSpacing: 0.5 },
});
