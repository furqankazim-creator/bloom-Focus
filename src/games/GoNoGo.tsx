import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, useStimulusStream } from './common';
import { FeedbackRing, GameFrame } from './parts';
import { CHATTER, useAuditoryDistraction } from './useAuditoryDistraction';

const INTERVAL_MS = [1800, 1500, 1250, 1000, 800];
/** Share of "stop" circles. More stops = more chances to practise holding back. */
const NOGO_RATE = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
const GO = '#6FA35B';
const STOP = '#E07A5F';

export default function GoNoGo({ params, paused, onCorrect, onDone }: GameProps) {
  const { stim, progress, feedback, tap } = useStimulusStream<'go' | 'stop'>({
    durationMs: params.durationSec * 1000,
    intervalMs: INTERVAL_MS[params.speed - 1] ?? 1250,
    visibleFrac: 0.7,
    paused,
    next: () =>
      Math.random() < (NOGO_RATE[params.distractors] ?? 0.3)
        ? { kind: 'stop', isTarget: false }
        : { kind: 'go', isTarget: true },
    onCorrect,
    onDone,
  });

  // Level 4: background chatter. Level 5: voices calling "go!" that must not decide the tap.
  useAuditoryDistraction(
    params.distractors >= 5 ? [...CHATTER, 'go', 'go', 'tap'] : params.distractors >= 4 ? CHATTER : null,
    paused,
  );

  return (
    <GameFrame
      progress={progress}
      instruction={
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: GO }]} />
          <Text style={styles.text}>tap</Text>
          <Text style={[styles.text, { color: colors.inkMuted }]}>·</Text>
          <View style={[styles.dot, { backgroundColor: STOP }]} />
          <Text style={styles.text}>hold still</Text>
        </View>
      }
    >
      <Pressable style={styles.pad} onPress={tap} accessibilityLabel="Tap area">
        {stim && (
          <MaterialCommunityIcons
            name={stim.kind === 'go' ? 'circle' : 'hand-back-right'}
            size={160}
            color={stim.kind === 'go' ? GO : STOP}
          />
        )}
        <FeedbackRing feedback={feedback} />
      </Pressable>
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  text: { fontFamily: font.semibold, fontSize: 18, color: colors.ink },
});
