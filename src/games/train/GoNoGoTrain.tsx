import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { Tally, useTicker } from '../common';
import { CHATTER, useAuditoryDistraction } from '../useAuditoryDistraction';
import { FeedbackPill, TrainGameProps, easeOut, lerp, useFeedback } from './shared';

export const GO_COLOR = '#1DB988';
export const STOP_COLOR = '#EF5A4C';
const INTERVAL_MS = [1700, 1450, 1200, 1000, 850];
const VISIBLE_FRAC = 0.7;
/** Share of red circles. More reds = more chances to practise holding back. */
const NOGO_RATE = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
const LEAD_IN_MS = 900;

type Stim = { go: boolean; at: number; responded: boolean; dx: number; dy: number };

export default function GoNoGoTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const intervalMs = INTERVAL_MS[params.speed - 1] ?? 1200;
  const visibleMs = intervalMs * VISIBLE_FRAC;
  const nogo = NOGO_RATE[params.distractors] ?? 0.3;
  // From level 3 the circle jumps around the board instead of staying centred.
  const jitter = params.distractors >= 3 ? 60 + (params.distractors - 3) * 20 : 0;
  const { fb, good, bad } = useFeedback();
  const r = useRef({
    elapsed: 0,
    nextAt: LEAD_IN_MS,
    stim: null as Stim | null,
    tally: new Tally(),
    gapTapped: false,
    goInRow: 0,
    done: false,
  });
  const [, force] = useState(0);

  useAuditoryDistraction(
    params.distractors >= 5 ? [...CHATTER, 'go', 'go', 'tap'] : params.distractors >= 4 ? CHATTER : null,
    paused,
  );

  useTicker(
    paused,
    (dt) => {
      const s = r.current;
      if (s.done) return;
      s.elapsed += dt;
      const now = s.elapsed;
      if (s.stim && now - s.stim.at >= visibleMs) {
        if (!s.stim.responded) {
          if (s.stim.go) {
            s.tally.miss();
            bad('Too slow — tap green!');
          } else {
            s.tally.reject();
            onCorrect();
            good('Nice hold! ✋');
          }
        }
        s.stim = null;
        s.gapTapped = false;
        s.nextAt = now + (intervalMs - visibleMs) * (0.7 + Math.random() * 0.6);
      }
      if (!s.stim && now >= durationSec * 1000) {
        s.done = true;
        onDone(s.tally.result(now));
        return;
      }
      if (!s.stim && now >= s.nextAt) {
        // Build up a "go" habit before a red, which is where holding back gets hard.
        const go = s.goInRow >= 4 ? false : Math.random() >= nogo;
        s.goInRow = go ? s.goInRow + 1 : 0;
        s.stim = {
          go,
          at: now,
          responded: false,
          dx: (Math.random() * 2 - 1) * jitter,
          dy: (Math.random() * 2 - 1) * jitter * 1.8,
        };
      }
      force((n) => n + 1);
    },
    40,
  );

  const tap = () => {
    const s = r.current;
    if (s.done || paused) return;
    if (s.stim && !s.stim.responded) {
      s.stim.responded = true;
      if (s.stim.go) {
        s.tally.hit(s.elapsed - s.stim.at);
        onCorrect();
        good();
      } else {
        s.tally.falseTap();
        bad('Red means hold back!');
      }
    } else if (!s.stim && !s.gapTapped && s.elapsed >= LEAD_IN_MS) {
      s.gapTapped = true;
      s.tally.falseTap();
      bad('Wait for the circle');
    }
    force((n) => n + 1);
  };

  const { stim, elapsed } = r.current;
  const age = stim ? elapsed - stim.at : 0;
  const scale = stim ? (stim.responded ? lerp(1, 0.8, age / visibleMs) : lerp(0.4, 1, easeOut(age / 160))) : 0;
  const opacity = stim ? (stim.responded ? 0.55 : age > visibleMs * 0.8 ? lerp(1, 0.4, (age - visibleMs * 0.8) / (visibleMs * 0.2)) : 1) : 0;

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.prompt}>
        Tap only on <Text style={{ color: GO_COLOR, fontFamily: font.heavy }}>green</Text>. Hold back on red.
      </Text>
      <Pressable style={styles.area} onPressIn={tap} accessibilityLabel="Tap area">
        {stim && (
          <View
            pointerEvents="none"
            style={[
              styles.circle,
              {
                backgroundColor: stim.go ? GO_COLOR : STOP_COLOR,
                opacity,
                transform: [{ translateX: stim.dx }, { translateY: stim.dy }, { scale }],
              },
            ]}
          >
            {!stim.go && <Text style={styles.hand}>✋</Text>}
          </View>
        )}
        <FeedbackPill fb={fb} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { textAlign: 'center', fontFamily: font.medium, fontSize: 15, color: colors.inkSoft, marginBottom: 12 },
  area: {
    flex: 1,
    backgroundColor: '#FAF9F5',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  hand: { fontSize: 40, lineHeight: 50, opacity: 0.9 },
});
