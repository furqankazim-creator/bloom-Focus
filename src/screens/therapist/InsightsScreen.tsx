import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { RhythmChart } from '../../components/charts';
import { Avatar, Button, Card, ProgressBar, Screen, SectionHeader, T, TaskIcon } from '../../components/ui';
import { describeChange, pct } from '../../engine/adaptive';
import { attentionProfile, averageAccuracy, childSessions } from '../../engine/profile';
import { DOMAIN_LABEL, TASKS } from '../../engine/tasks';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import { childStats, firstName, relativeDay, weekRhythm } from '../helpers';

export default function InsightsScreen() {
  const nav = useNavigation();
  const children = useStore((s) => s.children);
  const sessions = useStore((s) => s.sessions);
  const avg = averageAccuracy(sessions);

  // The latest adjustments the engine made, across every child.
  const decisions = [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((s) => s.blocks.filter((b) => b.changes.some((c) => c.dim !== 'reinforceEvery')).map((b) => ({ s, b })))
    .slice(0, 5);

  const share = () => {
    const lines = children.map((c) => {
      const st = childStats(c, sessions);
      const prof = attentionProfile(childSessions(sessions, c.id))
        .filter((p) => p.score !== null)
        .map((p) => `  - ${DOMAIN_LABEL[p.domain]}: ${pct(p.score!)}`)
        .join('\n');
      return `${c.name} (${c.age}) — ${st.count} sessions, level ${st.level} in ${st.task.name}\n${prof}`;
    });
    Share.share({
      message: `Bloom Focus practice overview\n\n${lines.join('\n\n')}\n\nPractice-session summaries, not clinical measures.`,
    });
  };

  return (
    <Screen>
      <T.Eyebrow>Small signals, steady growth</T.Eyebrow>
      <T.Display>Insights</T.Display>
      <T.Body style={{ marginTop: 6 }}>A gentle look back at practice, not a diagnosis.</T.Body>

      <View style={styles.hero}>
        <View style={[styles.row, { gap: 14 }]}>
          <View style={styles.heroIcon}>
            <Feather name="zap" size={24} color={colors.forestDeep} />
          </View>
          <Text style={styles.heroEyebrow}>ALL PROFILES</Text>
        </View>
        <Text style={styles.heroValue}>{sessions.length}</Text>
        <Text style={styles.heroLabel}>practice sessions completed</Text>
        <View style={styles.heroDivider} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroStat, { color: colors.lime }]}>{avg === null ? '—' : pct(avg)}</Text>
            <Text style={styles.heroStatLabel}>AVERAGE ACCURACY</Text>
          </View>
          <View style={styles.vr} />
          <View style={{ flex: 1, paddingLeft: 24 }}>
            <Text style={[styles.heroStat, { color: colors.peach }]}>{children.length}</Text>
            <Text style={styles.heroStatLabel}>PROFILES</Text>
          </View>
        </View>
      </View>

      <SectionHeader title="This week" />
      <Card>
        <T.H3 style={{ fontSize: 19 }}>Practice rhythm</T.H3>
        <T.Body>Completed sessions · this week</T.Body>
        <RhythmChart counts={weekRhythm(sessions)} />
      </Card>

      <SectionHeader title="A closer look" subtitle="Recent accuracy and progress towards the next step." />
      <View style={{ gap: 12 }}>
        {children.map((c) => {
          const st = childStats(c, sessions);
          return (
            <Card key={c.id} onPress={() => nav.navigate('ChildProfile', { childId: c.id })}>
              <View style={[styles.row, { gap: 14 }]}>
                <Avatar name={c.name} color={c.color} photo={c.photo} emoji={c.avatarEmoji} size={50} />
                <View style={{ flex: 1 }}>
                  <T.H3>{c.name}</T.H3>
                  <T.Small>
                    {st.count} sessions · {st.task.name} level {st.level}
                  </T.Small>
                </View>
                <Text style={styles.pct}>{st.avg === null ? '—' : pct(st.avg)}</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <ProgressBar value={st.avg ?? 0} />
              </View>
              <T.Small style={{ marginTop: 10 }}>
                {st.streak} of {st.streakNeeded} strong blocks toward the next step in {st.task.name}
              </T.Small>
            </Card>
          );
        })}
      </View>

      {decisions.length > 0 && (
        <>
          <SectionHeader title="Recent engine decisions" subtitle="What changed, and why." />
          <View style={{ gap: 10 }}>
            {decisions.map(({ s, b }, i) => {
              const c = children.find((x) => x.id === s.childId);
              const t = TASKS[b.taskId];
              const main = b.changes.find((x) => x.dim !== 'reinforceEvery')!;
              return (
                <Card key={i} onPress={() => nav.navigate('Summary', { sessionId: s.id })} style={[styles.row, { gap: 12, alignItems: 'flex-start' }]}>
                  <TaskIcon icon={t.icon} tint={t.tint} size={40} />
                  <View style={{ flex: 1 }}>
                    <T.Small>
                      {c ? firstName(c.name) : 'Removed'} · {t.name} · {relativeDay(s.startedAt)}
                    </T.Small>
                    <Text style={styles.decision}>{describeChange(main, t)}</Text>
                    <T.Small>{main.reason}</T.Small>
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      )}

      <Card style={[styles.row, { gap: 14, alignItems: 'flex-start', marginTop: 24 }]}>
        <View style={styles.info}>
          <Feather name="info" size={20} color={colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <T.H3>Use with care</T.H3>
          <T.Body style={{ marginTop: 4, fontSize: 14 }}>
            These are practice-session summaries from sample or locally entered data. They are not clinical measures. No biometric sensor is connected.
          </T.Body>
        </View>
      </Card>
      <Button label="Share practice overview" icon="share" variant="soft" onPress={share} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: { backgroundColor: colors.forestDeep, borderRadius: 30, padding: 24, marginTop: 22 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { fontFamily: font.semibold, fontSize: 12, letterSpacing: 2, color: '#D7E4DA' },
  heroValue: { fontFamily: font.heavy, fontSize: 56, color: colors.white, marginTop: 16 },
  heroLabel: { fontFamily: font.regular, fontSize: 16, color: '#D7E4DA' },
  heroDivider: { height: 1, backgroundColor: '#3A5A4C', marginVertical: 20 },
  heroStat: { fontFamily: font.bold, fontSize: 28 },
  heroStatLabel: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.6, color: '#D7E4DA', marginTop: 6 },
  vr: { width: 1, alignSelf: 'stretch', backgroundColor: '#3A5A4C' },
  pct: { fontFamily: font.bold, fontSize: 20, color: colors.forest },
  decision: { fontFamily: font.semibold, fontSize: 15, color: colors.forest, marginVertical: 3 },
  info: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.butter, alignItems: 'center', justifyContent: 'center' },
});
