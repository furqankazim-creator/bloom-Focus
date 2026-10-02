import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MciName } from '../components/ui';
import { colors, font } from '../theme';
import { GameProps, pick, useStimulusStream } from './common';
import { FeedbackRing, GameFrame } from './parts';

const INTERVAL_MS = [3000, 2600, 2200, 1900, 1600];
const TARGET = 'apple';

/** Distractor words get closer in meaning and then in sound as the level rises. */
function wordPool(level: number): string[] {
  const words = ['dog', 'car', 'tree', 'ball', 'sun', 'fish', 'book', 'hat'];
  if (level >= 1) words.push('banana', 'orange', 'grape');
  if (level >= 2) words.push('pear', 'peach', 'cherry');
  if (level >= 3) words.push('apron', 'happy', 'chapel');
  if (level >= 4) words.push('maple', 'apricot', 'pebble', 'ample');
  return level >= 3 ? words.slice(level >= 5 ? 8 : 4) : words;
}

const PICTURES: MciName[] = ['dog', 'car', 'tree', 'basketball', 'white-balance-sunny', 'fish', 'book-open-variant', 'hat-fedora', 'fruit-cherries', 'fruit-grapes'];

export default function ListenFor({ params, paused, onCorrect, onDone }: GameProps) {
  const pool = wordPool(params.distractors);
  const picture = useRef<MciName>('apple');

  const { stim, progress, feedback, tap } = useStimulusStream<string>({
    durationMs: params.durationSec * 1000,
    intervalMs: INTERVAL_MS[params.speed - 1] ?? 2200,
    visibleFrac: 0.95,
    leadInMs: 1800,
    paused,
    next: () => (Math.random() < 0.3 ? { kind: TARGET, isTarget: true } : { kind: pick(pool), isTarget: false }),
    onShow: (word) => {
      // At higher levels, what's on screen stops matching what's heard — the ears have to lead.
      picture.current = params.distractors >= 5 && Math.random() < 0.3 ? 'apple' : pick(PICTURES);
      Speech.stop();
      Speech.speak(word, { rate: 0.85, pitch: 1.05 });
    },
    onCorrect,
    onDone,
  });

  useEffect(() => {
    if (paused) Speech.stop();
  }, [paused]);
  useEffect(() => () => void Speech.stop(), []);

  const showPictures = params.distractors >= 3;

  return (
    <GameFrame
      progress={progress}
      instruction={
        <View style={styles.row}>
          <Feather name="volume-2" size={20} color={colors.forest} />
          <Text style={styles.text}>Tap when you hear “apple”</Text>
        </View>
      }
      footer={
        <Pressable onPress={tap} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
          <MaterialCommunityIcons name="apple" size={26} color={colors.white} />
          <Text style={styles.buttonText}>I heard it!</Text>
        </Pressable>
      }
    >
      <View style={styles.pad}>
        {stim && showPictures ? (
          <MaterialCommunityIcons name={picture.current} size={120} color="#C9D3CB" />
        ) : (
          <View style={[styles.wave, stim && { backgroundColor: colors.mint, transform: [{ scale: 1.08 }] }]}>
            <MaterialCommunityIcons name="ear-hearing" size={72} color={colors.forest} />
          </View>
        )}
        <Text style={styles.hint}>Listen carefully…</Text>
        <FeedbackRing feedback={feedback} />
      </View>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontFamily: font.semibold, fontSize: 18, color: colors.ink },
  wave: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: font.regular, fontSize: 14, color: colors.inkMuted },
  button: {
    marginTop: 14,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: { fontFamily: font.bold, fontSize: 20, color: colors.white },
});
