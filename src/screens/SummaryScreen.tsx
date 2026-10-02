import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { REWARD_ICON } from '../components/RewardBurst';
import { Button, Card, Divider, IconButton, Screen, T, TaskIcon } from '../components/ui';
import { describeChange, pct } from '../engine/adaptive';
import { sessionAccuracy } from '../engine/profile';
import { TASKS } from '../engine/tasks';
import type { RootProps } from '../navigation/types';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';
import { OBSERVATIONS } from './SessionScreen';

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

export default function SummaryScreen({ route, navigation }: RootProps<'Summary'>) {
  const session = useStore((s) => s.sessions.find((x) => x.id === route.params.sessionId));
  const child = useStore((s) => s.children.find((c) => c.id === session?.childId));
  if (!session || !child) return null;

  const acc = sessionAccuracy(session);
  const scored = session.blocks.filter((b) => b.accuracy !== null);
  const obs = OBSERVATIONS.find((o) => o.id === session.observation)!;
  const first = child.name.split(' ')[0];
  const reward = REWARD_ICON[child.rewardTheme];
  const close = () => (route.params.fresh ? navigation.popToTop() : navigation.goBack());

  const headline =
    acc === null ? 'Practice complete.' : acc >= 0.85 ? 'A great bit of growing.' : acc >= 0.65 ? 'A good bit of growing.' : 'Brave practice today.';

  return (
    <Screen>
      <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 16 }]}>
        <T.Eyebrow style={{ marginBottom: 0 }}>
          {session.kind === 'baseline' ? 'Starting check' : 'Session'} {route.params.fresh ? 'complete' : 'details'}
        </T.Eyebrow>
        <IconButton icon="x" label="Close" onPress={close} bg="transparent" color={colors.ink} />
      </View>

      <LinearGradient colors={[colors.forestDeep, colors.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="flower" size={34} color={colors.forestDeep} />
        </View>
        <Text style={styles.heroTitle}>{headline}</Text>
        <Text style={styles.heroSub}>
          {first} finished {session.blocks.length} {session.blocks.length === 1 ? 'activity' : 'activities'}
          {session.by === 'parent' ? ' at home.' : ' with you.'}
        </Text>
        <View style={styles.ring}>
          <Text style={styles.ringValue}>{acc === null ? '—' : pct(acc)}</Text>
          <Text style={styles.ringLabel}>{acc === null ? 'NOT SCORED' : 'AVERAGE ACCURACY'}</Text>
        </View>
      </LinearGradient>

      <Card style={{ marginTop: 16, gap: 14 }}>
        <Row label="Time together" value={formatDuration(session.activeSec)} />
        <Row label="Scored activities" value={`${scored.length}`} />
        <Row label="Rewards earned" value={`${session.rewards} ${reward.label.toLowerCase()}`} />
        <Row label="Observation" value={obs.title} />
        <Row label="Attention drifted" value={session.disengaged ? `${session.disengaged}×` : 'No'} />
      </Card>
      {session.lengthChange && (
        <Card style={{ marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Feather name="clock" size={18} color={colors.forest} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.change}>
              Next session: {session.lengthChange.from} → {session.lengthChange.to} min
            </Text>
            <T.Small>{session.lengthChange.reason}</T.Small>
          </View>
        </Card>
      )}
      {session.note && (
        <Card style={{ marginTop: 12 }}>
          <T.Small>{session.by === 'parent' ? 'Parent note' : 'Session note'}</T.Small>
          <T.Body style={{ color: colors.ink, marginTop: 4 }}>{session.note}</T.Body>
        </Card>
      )}

      <T.H2 style={{ marginTop: 28, marginBottom: 4 }}>{session.kind === 'baseline' ? 'Where each activity starts' : 'What the engine adjusted'}</T.H2>
      <T.Body style={{ marginBottom: 14 }}>After each activity, Bloom Focus changed only the setting that explains how it went.</T.Body>
      {session.blocks.map((b, i) => {
        const t = TASKS[b.taskId];
        return (
          <Card key={i} style={{ marginBottom: 10 }}>
            <View style={[styles.row, { gap: 12 }]}>
              <TaskIcon icon={t.icon} tint={t.tint} size={44} />
              <View style={{ flex: 1 }}>
                <T.H3>{t.name}</T.H3>
                <T.Small>
                  {b.metrics.completed ? `${b.metrics.hits} hits · ${b.metrics.misses} missed · ${b.metrics.falseTaps} early taps` : 'Ended early'}
                  {b.metrics.meanRtMs ? ` · ${(b.metrics.meanRtMs / 1000).toFixed(1)}s avg` : ''}
                </T.Small>
              </View>
              <Text style={styles.acc}>{b.accuracy === null ? '—' : pct(b.accuracy)}</Text>
            </View>
            <Divider style={{ marginVertical: 12 }} />
            <T.Body style={{ color: colors.ink, fontSize: 14 }}>{b.summary}</T.Body>
            {b.changes.map((c, j) => (
              <View key={j} style={[styles.row, { gap: 8, marginTop: 8, alignItems: 'flex-start' }]}>
                <Feather name="sliders" size={14} color={colors.forest} style={{ marginTop: 3 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.change}>{describeChange(c, t)}</Text>
                  <T.Small>{c.reason}</T.Small>
                </View>
              </View>
            ))}
            {b.levelAfter !== b.levelBefore && (
              <Text style={styles.level}>
                Level {b.levelBefore} → {b.levelAfter}
              </Text>
            )}
          </Card>
        );
      })}

      <T.Small style={{ textAlign: 'center', marginVertical: 18 }}>
        Practice feedback is a simple activity summary, not a clinical assessment. No heart-rate or biometric data was collected.
      </T.Small>
      <Button label={route.params.fresh ? 'Back to today' : 'Done'} icon="arrow-right" onPress={close} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <T.Body>{label}</T.Body>
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.ink }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: { borderRadius: 30, padding: 28, alignItems: 'center' },
  heroIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: font.heavy, fontSize: 26, color: colors.white, marginTop: 16, textAlign: 'center', letterSpacing: -0.5 },
  heroSub: { fontFamily: font.regular, fontSize: 15, color: '#D7E4DA', marginTop: 8, textAlign: 'center' },
  ring: { width: 170, height: 170, borderRadius: 85, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  ringValue: { fontFamily: font.heavy, fontSize: 40, color: colors.ink },
  ringLabel: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.4, color: colors.inkSoft, marginTop: 4 },
  acc: { fontFamily: font.bold, fontSize: 18, color: colors.forest },
  change: { fontFamily: font.semibold, fontSize: 14, color: colors.forest },
  level: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, marginTop: 10 },
});
