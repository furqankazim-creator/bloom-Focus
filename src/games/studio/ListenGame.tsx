import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listenSettings, shuffle } from '../../engine/studio';
import { colors, font } from '../../theme';
import { GameBar, StudioGameProps, secondsSince } from './shared';

/** Words are spoken one by one; tap only when the target word is heard. */
export default function ListenGame({ content, level, onDone }: StudioGameProps<'listen'>) {
  const { gapMs, words } = listenSettings(level);
  const start = useRef(Date.now());
  // About a third of the words are the target, never two in a row.
  const script = useRef<string[]>(
    (() => {
      const out: string[] = [];
      for (let i = 0; i < words; i++) {
        const prevTarget = out[i - 1] === content.target;
        out.push(!prevTarget && Math.random() < 0.33 ? content.target : shuffle([...content.others])[0]);
      }
      if (!out.includes(content.target)) out[Math.floor(words / 2)] = content.target;
      return out;
    })(),
  ).current;
  const tally = useRef({ hits: 0, misses: 0, falseTaps: 0, rejections: 0 });
  const responded = useRef(false);
  const [index, setIndex] = useState(-1);
  const [pulse, setPulse] = useState<'hit' | 'oops' | null>(null);

  useEffect(() => {
    const score = (i: number) => {
      if (i < 0) return;
      const isTarget = script[i] === content.target;
      if (isTarget && !responded.current) tally.current.misses++;
      if (!isTarget && !responded.current) tally.current.rejections++;
    };
    const t = setInterval(() => {
      setIndex((i) => {
        score(i);
        const next = i + 1;
        if (next >= script.length) {
          clearInterval(t);
          const { hits, rejections } = tally.current;
          setTimeout(() => onDone({ accuracy: (hits + rejections) / script.length, activeSec: secondsSince(start.current) }), 300);
          return i;
        }
        responded.current = false;
        Speech.speak(script[next], { rate: 0.9 });
        return next;
      });
    }, gapMs);
    return () => {
      clearInterval(t);
      Speech.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    if (index < 0 || responded.current) return;
    responded.current = true;
    const hit = script[index] === content.target;
    if (hit) tally.current.hits++;
    else tally.current.falseTaps++;
    setPulse(hit ? 'hit' : 'oops');
    setTimeout(() => setPulse(null), 450);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <GameBar left={`Word ${Math.max(0, index + 1)} of ${script.length}`} right="🔊 Sound on" />
      <Text style={styles.prompt}>
        Tap when you hear “<Text style={{ color: '#C28B00' }}>{content.target}</Text>”
      </Text>
      <Pressable
        onPressIn={tap}
        style={[styles.button, pulse === 'hit' && styles.hit, pulse === 'oops' && styles.oops]}
        accessibilityRole="button"
        accessibilityLabel={`I heard ${content.target}`}
      >
        <Text style={{ fontSize: 64 }}>{pulse === 'hit' ? '🎉' : pulse === 'oops' ? '🙈' : '👂'}</Text>
        <Text style={styles.buttonText}>I heard it!</Text>
      </Pressable>
      <Text style={styles.hint}>{index < 0 ? 'Get ready…' : 'Listening…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { fontFamily: font.bold, fontSize: 20, color: colors.ink, textAlign: 'center', marginVertical: 18 },
  button: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#FBF1D3', borderWidth: 4, borderColor: '#C28B00', alignItems: 'center', justifyContent: 'center' },
  hit: { backgroundColor: colors.mint, borderColor: colors.leaf },
  oops: { backgroundColor: '#FBE4DE', borderColor: colors.danger },
  buttonText: { fontFamily: font.heavy, fontSize: 20, color: colors.ink, marginTop: 6 },
  hint: { fontFamily: font.medium, fontSize: 14, color: colors.inkMuted, marginTop: 18 },
});
