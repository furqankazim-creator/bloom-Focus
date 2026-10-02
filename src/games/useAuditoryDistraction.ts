import * as Speech from 'expo-speech';
import { useEffect, useRef } from 'react';
import { pick, useTicker } from './common';

/** Neutral background chatter: irrelevant words the child should tune out. */
export const CHATTER = ['dog', 'bell', 'look', 'hello', 'car', 'bird', 'jump', 'ball', 'clap', 'rain'];

/**
 * Speaks a random word every few seconds while a visual task runs.
 * Pass `null` to switch it off. Timing uses the game clock, so pausing silences it.
 */
export function useAuditoryDistraction(words: string[] | null, paused: boolean, minGapMs = 2800, maxGapMs = 5200) {
  const r = useRef({ elapsed: 0, nextAt: 2000 });
  const wordsRef = useRef(words);
  wordsRef.current = words;

  useTicker(paused || !words, (dt) => {
    const st = r.current;
    st.elapsed += dt;
    const list = wordsRef.current;
    if (!list || st.elapsed < st.nextAt) return;
    Speech.stop();
    Speech.speak(pick(list), { rate: 0.95, pitch: 0.8 + Math.random() * 0.6 });
    st.nextAt = st.elapsed + minGapMs + Math.random() * (maxGapMs - minGapMs);
  }, 200);

  useEffect(() => {
    if (paused) Speech.stop();
  }, [paused]);
  useEffect(() => () => void Speech.stop(), []);
}
