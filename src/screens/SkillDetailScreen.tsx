import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, shortDate } from '../components/LineChart';
import { ProgressBar } from '../components/ui';
import { STEP_UP_ACCURACY, STEP_UP_STREAK, describeChange, taskLevel } from '../engine/adaptive';
import { SKILL_METRIC, skillHistory, skillSummary } from '../engine/skillHistory';
import { TRAIN_BY_ID, describeParams, starsFor, trainTaskDef } from '../engine/trainTasks';
import type { RootProps } from '../navigation/types';
import { useChild } from '../store/useStore';
import { colors, font } from '../theme';
import { SampleBanner } from '../components/SampleBanner';
import { firstName, useChildHistory } from './helpers';

const pctStr = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const fmtMin = (sec: number) => (sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec}s`);

export default function SkillDetailScreen({ route, navigation }: RootProps<'SkillDetail'>) {
  const { childId, taskId } = route.params;
  const child = useChild(childId);
  const { sessions, isDemo } = useChildHistory(child);
  if (!child) return null;

  const info = TRAIN_BY_ID[taskId];
  const def = trainTaskDef(taskId);
  const state = child.tasks[taskId];
  const level = taskLevel(def, state.params);
  const points = skillHistory(sessions, taskId);
  const sum = skillSummary(points);
  const metric = SKILL_METRIC[taskId];
  const recent = points.slice(-15);
  const first = firstName(child.name);
  const needed = Math.max(0, STEP_UP_STREAK - state.streak);

  const accData = recent.map((p) => ({ value: Math.round(p.accuracy * 100), label: shortDate(p.at) }));
  const metricData = recent.filter((p) => p.metric !== null).map((p) => ({ value: p.metric as number, label: shortDate(p.at) }));
  const firstM = metricData[0]?.value;
  const lastM = metricData[metricData.length - 1]?.value;
  const improved =
    firstM !== undefined && lastM !== undefined && firstM !== lastM ? (metric.lowerIsBetter ? lastM < firstM : lastM > firstM) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={8} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{info.skill}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isDemo && <SampleBanner name={first} />}

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: info.tint }]}>
          <Text style={{ fontSize: 44, lineHeight: 54 }}>{info.icon}</Text>
          <Text style={styles.heroTitle}>{info.title}</Text>
          <Text style={styles.heroSub}>{info.subtitle}</Text>
          <Pressable
            onPress={() => navigation.navigate('TrainGame', { childId, taskId })}
            style={[styles.play, { backgroundColor: info.color }]}
            accessibilityRole="button"
          >
            <Feather name="play" size={18} color={colors.white} />
            <Text style={styles.playText}>Play now</Text>
          </Pressable>
        </View>

        {/* Level */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Level {level} of 10</Text>
            <Text style={[styles.cardTitle, { color: info.color }]}>{describeParams(taskId, state.params)}</Text>
          </View>
          <View style={{ marginVertical: 10 }}>
            <ProgressBar value={level / 10} height={8} color={info.color} />
          </View>
          <Text style={styles.body}>
            {level >= 10
              ? `${first} is at the top level. Amazing!`
              : needed === 1
                ? `1 more strong game (${Math.round(STEP_UP_ACCURACY * 100)}%+) to level up 🚀`
                : `${needed} strong games in a row (${Math.round(STEP_UP_ACCURACY * 100)}%+) to level up.`}
          </Text>
        </View>

        {/* Key numbers */}
        <View style={styles.statsRow}>
          <Stat label="Best" value={pctStr(sum.best)} />
          <Stat label="Last 5 avg" value={pctStr(sum.avg5)} />
          <Stat label="Played" value={String(sum.played)} />
          <Stat label="Play time" value={fmtMin(sum.totalSec)} />
        </View>

        {/* Accuracy trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accuracy</Text>
          <Text style={styles.caption}>Last {recent.length} games · dashed line = level-up zone</Text>
          <View style={{ marginTop: 8 }}>
            <LineChart data={accData} color={info.color} max={100} ticks={[0, 50, 100]} unit="%" target={85} targetLabel="85%" />
          </View>
        </View>

        {/* Skill-specific metric */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{metric.title}</Text>
            {improved !== null && (
              <Text style={[styles.trend, { color: improved ? '#138A5E' : '#B7791F' }]}>{improved ? '▲ Improving' : '▼ Dipped'}</Text>
            )}
          </View>
          <Text style={styles.caption}>{metric.explain}</Text>
          <View style={{ marginTop: 8 }}>
            <LineChart data={metricData} color={info.color} unit={metric.unit} min={0} />
          </View>
        </View>

        {/* Difficulty history */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Difficulty changes</Text>
          {sum.changes.length === 0 ? (
            <Text style={[styles.body, { marginTop: 6 }]}>No changes yet. The engine adjusts after strong or tough games.</Text>
          ) : (
            sum.changes.slice(0, 6).map((c, i) => {
              const up = c.change.to > c.change.from;
              return (
                <View key={i} style={styles.timelineRow}>
                  <View style={[styles.dot, { backgroundColor: up ? '#1DB988' : '#F5A623' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>
                      {shortDate(c.at)} · {describeChange(c.change, def)}
                    </Text>
                    <Text style={styles.caption}>{c.reason}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent games */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent games</Text>
          {points
            .slice(-10)
            .reverse()
            .map((p) => {
              const stars = starsFor(p.accuracy);
              return (
                <Pressable
                  key={p.sessionId + p.at}
                  onPress={() => navigation.navigate('SessionDetail', { sessionId: p.sessionId, childId })}
                  style={styles.gameRow}
                >
                  <Text style={styles.gameDate}>{shortDate(p.at)}</Text>
                  <Text style={styles.gameStars}>{'⭐'.repeat(stars)}</Text>
                  <Text style={styles.gameAcc}>{pctStr(p.accuracy)}</Text>
                  <Feather name="chevron-right" size={16} color={colors.inkMuted} />
                </Pressable>
              );
            })}
          {points.length === 0 && <Text style={[styles.body, { marginTop: 6 }]}>Not played yet.</Text>}
        </View>

        {/* Parent tip */}
        <View style={[styles.card, { backgroundColor: '#F2F8F6', borderColor: '#D4E8E1' }]}>
          <Text style={styles.cardTitle}>💡 Try at home</Text>
          <Text style={[styles.body, { marginTop: 6 }]}>{info.tip}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBFAF7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEECE6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.heavy, fontSize: 17, color: colors.ink },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  hero: { borderRadius: 24, padding: 20, alignItems: 'center' },
  heroTitle: { fontFamily: font.heavy, fontSize: 22, color: colors.ink, marginTop: 6 },
  heroSub: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  play: { marginTop: 14, height: 46, paddingHorizontal: 26, borderRadius: 23, flexDirection: 'row', alignItems: 'center', gap: 8 },
  playText: { fontFamily: font.bold, fontSize: 15, color: colors.white },
  card: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  caption: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  body: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  trend: { fontFamily: font.bold, fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontFamily: font.heavy, fontSize: 17, color: colors.ink },
  statLabel: { fontFamily: font.medium, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  timelineRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  gameRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F1EC', gap: 10 },
  gameDate: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, width: 60 },
  gameStars: { flex: 1, fontSize: 12 },
  gameAcc: { fontFamily: font.bold, fontSize: 14, color: colors.ink },
});
