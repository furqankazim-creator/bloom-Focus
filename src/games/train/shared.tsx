import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font } from '../../theme';
import { pick } from '../common';
import { playSound } from '../../services/sounds';

export const GOOD_WORDS = ['Nice!', 'Great!', 'Super!', 'Yes!', 'Awesome!'];

export const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));
export const easeOut = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);

/** Settings the game screen passes down to every game. */
export type GameEnv = {
  /** Gentler feedback: no warning buzz, softer words, neutral colours. */
  calm: boolean;
  /** Ages 6 and under: larger targets. */
  young: boolean;
  /** Called when rapid wrong taps suggest the child is getting upset. */
  onFrustrated: () => void;
  /** The child's favourite character, used as a game target where it fits. */
  hero: { name: string; emoji: string } | null;
};
export const GameEnvContext = createContext<GameEnv>({ calm: false, young: false, onFrustrated: () => {}, hero: null });
export const useGameEnv = () => useContext(GameEnvContext);

const CALM_WORDS = ['Try the next one 🙂', 'That’s okay!', 'Keep going 🌱'];
/** Wrong taps within this window that count as rage-tapping. */
const FRUSTRATION_TAPS = 4;
const FRUSTRATION_WINDOW_MS = 4000;

export function haptic(kind: 'good' | 'bad') {
  try {
    const p =
      kind === 'good'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    p.catch(() => {});
  } catch {
    // Haptics are unavailable on some platforms (e.g. web).
  }
}

export type Fb = { kind: 'good' | 'bad' | 'info'; text: string; key: number };

/** Short floating feedback messages plus a running "in a row" streak. */
export function useFeedback() {
  const [fb, setFb] = useState<Fb | null>(null);
  const streak = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = useRef(0);
  const badTimes = useRef<number[]>([]);
  const env = useGameEnv();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = (kind: Fb['kind'], text: string, ms = 700) => {
    key.current++;
    setFb({ kind, text, key: key.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFb(null), ms);
  };

  return {
    fb,
    good: (text?: string) => {
      streak.current++;
      haptic('good');
      playSound('pop');
      show('good', text ?? (streak.current >= 3 ? `${streak.current} in a row! 🔥` : pick(GOOD_WORDS)));
    },
    bad: (text: string) => {
      streak.current = 0;
      const now = Date.now();
      badTimes.current = [...badTimes.current.filter((t) => now - t < FRUSTRATION_WINDOW_MS), now];
      if (badTimes.current.length >= FRUSTRATION_TAPS) {
        badTimes.current = [];
        env.onFrustrated();
      }
      if (env.calm) {
        show('info', pick(CALM_WORDS), 900);
        return;
      }
      haptic('bad');
      playSound('soft');
      show('bad', text, 900);
    },
    info: (text: string) => show('info', text, 1100),
  };
}

const FB_COLORS = {
  good: { bg: '#E3F6EE', fg: '#138A5E' },
  bad: { bg: '#FDEDE4', fg: '#B5533C' },
  info: { bg: '#EEF0FF', fg: '#4B4FB8' },
};

export function FeedbackPill({ fb, top = 14 }: { fb: Fb | null; top?: number }) {
  if (!fb) return null;
  const c = FB_COLORS[fb.kind];
  return (
    <View pointerEvents="none" style={[styles.pillWrap, { top }]}>
      <View key={fb.key} style={[styles.pill, { backgroundColor: c.bg }]}>
        <Text style={[styles.pillText, { color: c.fg }]}>{fb.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  pillText: { fontFamily: font.bold, fontSize: 15 },
});

export type TrainGameProps = import('../common').GameProps & { durationSec: number };

export { MAX_SEQUENCE } from '../../engine/trainTasks';
