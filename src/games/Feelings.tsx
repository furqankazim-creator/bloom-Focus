import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, MciName } from '../components/ui';
import { colors, font } from '../theme';
import { GameProps } from './common';

const FEELINGS: { icon: MciName; label: string; tip: string }[] = [
  { icon: 'emoticon-happy-outline', label: 'Happy', tip: 'Let’s carry that good feeling into practice.' },
  { icon: 'emoticon-cool-outline', label: 'Calm', tip: 'Calm is a great place to start.' },
  { icon: 'emoticon-excited-outline', label: 'Excited', tip: 'Big energy! Let’s slow it down with a breath.' },
  { icon: 'emoticon-confused-outline', label: 'Worried', tip: 'Worries feel smaller after slow breaths.' },
  { icon: 'emoticon-sad-outline', label: 'Sad', tip: 'It’s okay to feel sad. We can go gently today.' },
  { icon: 'emoticon-angry-outline', label: 'Cross', tip: 'Let’s blow the cross feeling out like a balloon.' },
  { icon: 'sleep', label: 'Tired', tip: 'We’ll keep things short and cosy.' },
];

const BREATHS = 3;
const BREATH_MS = 4000;

/**
 * Unscored and unstored by design: only the fact that a check-in happened is recorded,
 * never which feeling the child chose.
 */
export default function Feelings({ paused, onDone }: GameProps) {
  const [choice, setChoice] = useState<number | null>(null);
  const [breath, setBreath] = useState(0);
  const scale = useRef(new Animated.Value(0.6)).current;
  const start = useRef(Date.now());

  useEffect(() => {
    if (choice === null || paused || breath >= BREATHS) return;
    const anim = Animated.sequence([
      Animated.timing(scale, { toValue: 1, duration: BREATH_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.6, duration: BREATH_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && setBreath((b) => b + 1));
    return () => anim.stop();
  }, [choice, breath, paused, scale]);

  const finish = () =>
    onDone({
      trials: 0,
      hits: 0,
      misses: 0,
      falseTaps: 0,
      correctRejections: 0,
      meanRtMs: null,
      earlyAccuracy: 0,
      lateAccuracy: 0,
      activeSec: Math.round((Date.now() - start.current) / 1000),
    });

  if (choice === null) {
    return (
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>How are you feeling right now?</Text>
        <Text style={styles.sub}>There is no wrong answer.</Text>
        <View style={styles.grid}>
          {FEELINGS.map((f, i) => (
            <Pressable key={f.label} onPress={() => setChoice(i)} style={({ pressed }) => [styles.face, pressed && { backgroundColor: colors.mint }]}>
              <MaterialCommunityIcons name={f.icon} size={48} color={colors.forest} />
              <Text style={styles.faceLabel}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const done = breath >= BREATHS;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.title}>{FEELINGS[choice].tip}</Text>
      <View style={styles.breathWrap}>
        <Animated.View style={[styles.breath, { transform: [{ scale }] }]} />
        <Text style={styles.breathText}>{done ? 'Ready' : 'Breathe in… and out'}</Text>
      </View>
      <Text style={styles.sub}>{done ? 'Nice breathing.' : `Breath ${breath + 1} of ${BREATHS}`}</Text>
      <Button label={done ? 'Let’s play' : 'Skip breathing'} variant={done ? 'primary' : 'ghost'} onPress={finish} style={{ alignSelf: 'stretch', marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.bold, fontSize: 22, color: colors.ink, textAlign: 'center', marginTop: 8 },
  sub: { fontFamily: font.regular, fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 24 },
  face: {
    width: '29%',
    aspectRatio: 0.95,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  faceLabel: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  breathWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  breath: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: colors.mint },
  breathText: { fontFamily: font.semibold, fontSize: 18, color: colors.forest },
});
