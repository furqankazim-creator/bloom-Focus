import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MciName } from '../components/ui';
import { colors, font } from '../theme';
import { GameProps, pick, useStimulusStream } from './common';
import { FeedbackRing, GameFrame } from './parts';
import { CHATTER, useAuditoryDistraction } from './useAuditoryDistraction';

const TARGET_COLOR = '#E9B949';
const INTERVAL_MS = [2200, 1800, 1500, 1200, 950];

type Kind = { icon: MciName; color: string };

/** Non-targets get more star-like as the distractor level rises. */
function lures(level: number): Kind[] {
  const out: Kind[] = [{ icon: 'circle', color: '#C9D3CB' }];
  if (level >= 1) out.push({ icon: 'circle', color: '#9CC5C1' }, { icon: 'square-rounded', color: '#F2B49A' });
  if (level >= 2) out.push({ icon: 'heart', color: '#E7A1A1' }, { icon: 'moon-waning-crescent', color: '#9C7FC1' });
  if (level >= 3) out.push({ icon: 'star-outline', color: TARGET_COLOR });
  if (level >= 4) out.push({ icon: 'star-four-points', color: TARGET_COLOR }, { icon: 'star', color: '#9CC5C1' });
  if (level >= 5) out.push({ icon: 'star-three-points', color: TARGET_COLOR });
  return out;
}

const DRIFT_ICONS: MciName[] = ['cloud', 'butterfly', 'leaf', 'balloon', 'bird', 'flower'];

export default function StarWatch({ params, paused, onCorrect, onDone }: GameProps) {
  const pool = useMemo(() => lures(params.distractors), [params.distractors]);
  const { stim, elapsed, progress, feedback, tap } = useStimulusStream<Kind>({
    durationMs: params.durationSec * 1000,
    intervalMs: INTERVAL_MS[params.speed - 1] ?? 1500,
    visibleFrac: 0.65,
    paused,
    next: () =>
      Math.random() < 0.3
        ? { kind: { icon: 'star', color: TARGET_COLOR }, isTarget: true }
        : { kind: pick(pool), isTarget: false },
    onCorrect,
    onDone,
  });

  // Level 4: background chatter. Level 5: chatter that says "star" when there may be none.
  useAuditoryDistraction(
    params.distractors >= 5 ? [...CHATTER, 'star', 'star', 'tap now'] : params.distractors >= 4 ? CHATTER : null,
    paused,
  );

  const drifters = params.distractors >= 3 ? (params.distractors - 2) * 2 : 0;

  return (
    <GameFrame
      progress={progress}
      instruction={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.text}>Tap only for the</Text>
          <MaterialCommunityIcons name="star" size={26} color={TARGET_COLOR} />
          <Text style={styles.text}>star</Text>
        </View>
      }
    >
      <Pressable style={styles.pad} onPress={tap} accessibilityLabel="Tap area">
        {Array.from({ length: drifters }).map((_, i) => {
          const t = elapsed / 1000;
          const left = 50 + 40 * Math.sin(t * (0.35 + i * 0.07) + i * 1.7);
          const top = 50 + 40 * Math.cos(t * (0.28 + i * 0.05) + i * 2.3);
          return (
            <View key={i} style={[styles.drift, { left: `${left}%`, top: `${top}%` }]} pointerEvents="none">
              <MaterialCommunityIcons name={DRIFT_ICONS[i % DRIFT_ICONS.length]} size={30} color="#D5DDD6" />
            </View>
          );
        })}
        {stim && <MaterialCommunityIcons name={stim.kind.icon} size={150} color={stim.kind.color} />}
        <FeedbackRing feedback={feedback} />
      </Pressable>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  drift: { position: 'absolute', marginLeft: -15, marginTop: -15 },
  text: { fontFamily: font.semibold, fontSize: 18, color: colors.ink },
});
