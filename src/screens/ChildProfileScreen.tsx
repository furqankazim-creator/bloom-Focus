import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { DomainBars } from '../components/charts';
import { NotesThread } from '../components/NotesThread';
import { Avatar, Button, Card, IconButton, Notice, ProgressBar, Screen, SectionHeader, StatTile, T, TaskIcon, TopBar } from '../components/ui';
import { pct } from '../engine/adaptive';
import { attentionProfile, profileSentence, sessionAccuracy } from '../engine/profile';
import { DOMAIN_LABEL, TASKS } from '../engine/tasks';
import type { RootProps } from '../navigation/types';
import { shareReport } from '../services/report';
import { useChild, useStore } from '../store/useStore';
import { colors, font } from '../theme';
import { childStats, shortDate } from './helpers';

export default function ChildProfileScreen({ route, navigation }: RootProps<'ChildProfile'>) {
  const child = useChild(route.params.childId);
  const sessions = useStore((s) => s.sessions);
  const role = useStore((s) => s.role);
  const removeChild = useStore((s) => s.removeChild);
  const notes = useStore((s) => s.notes);
  const [exporting, setExporting] = useState(false);
  if (!child) return null;

  const exportPdf = async () => {
    setExporting(true);
    try {
      await shareReport(child, sessions, notes);
    } catch {
      Alert.alert('Could not create the report', 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const st = childStats(child, sessions);
  const profile = attentionProfile(st.sessions);
  const therapist = role === 'therapist';

  const remove = () =>
    Alert.alert('Remove this profile?', `${child.name}'s sessions and notes will be deleted from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          navigation.goBack();
          removeChild(child.id);
        },
      },
    ]);

  return (
    <Screen>
      <TopBar
        title="Child profile"
        onBack={() => navigation.goBack()}
        right={therapist && <IconButton icon="edit" label="Edit profile" bg="transparent" color={colors.ink} onPress={() => navigation.navigate('EditChild', { childId: child.id })} />}
      />

      <View style={styles.hero}>
        <View style={[styles.row, { gap: 18 }]}>
          <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={80} />
          <View style={{ flex: 1 }}>
            <T.H1 style={{ fontSize: 26 }}>{child.name}</T.H1>
            <T.Body>
              {child.age} years · Joined {new Date(child.createdAt).toLocaleDateString('en-GB')}
            </T.Body>
          </View>
        </View>
        <View style={styles.focusChip}>
          <Text style={styles.focusText}>{DOMAIN_LABEL[child.focus]}</Text>
        </View>
        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 18, marginBottom: 12 }]}>
          <View style={[styles.row, { gap: 10 }]}>
            <TaskIcon icon={st.task.icon} tint={colors.white} size={36} />
            <T.Eyebrow style={{ marginBottom: 0 }}>{st.task.name} level</T.Eyebrow>
          </View>
          <Text style={styles.level}>
            {st.level} <Text style={styles.levelOf}>/ 10</Text>
          </Text>
        </View>
        <ProgressBar value={st.level / 10} color={colors.forest} height={10} />
      </View>

      {!child.baselineAt && (
        <Card style={{ marginTop: 16, backgroundColor: colors.lime, borderColor: colors.lime }}>
          <T.H3>Start with a starting check</T.H3>
          <T.Body style={{ color: colors.ink, marginTop: 4, marginBottom: 14, fontSize: 14 }}>
            One short round of each activity places {child.name.split(' ')[0]} at the right level before regular practice.
          </T.Body>
          <Button label="Run starting check" icon="compass" onPress={() => navigation.navigate('Session', { childId: child.id, mode: 'baseline' })} />
        </Card>
      )}

      <View style={[styles.row, { gap: 10, marginTop: 16 }]}>
        <StatTile value={st.count} label="Sessions" bg={colors.peach} />
        <StatTile value={st.avg === null ? '—' : pct(st.avg)} label="Recent avg." bg={colors.butter} />
        <StatTile value={`${st.streak}/${st.streakNeeded}`} label="Next step" bg={colors.sky} />
      </View>
      <Notice
        icon="trending-up"
        style={{ marginTop: 14 }}
        text={`${st.streak} of ${st.streakNeeded} strong blocks (85%+) before ${st.task.name} gets a little harder.`}
      />

      <Notice
        icon="clock"
        style={{ marginTop: 10 }}
        text={`Sessions are ${child.currentMinutes} min now. They grow a minute at a time, up to ${child.sessionMinutes}, while engagement holds.`}
      />

      <Button label="Start a practice session" icon="play" onPress={() => navigation.navigate('Session', { childId: child.id })} style={{ marginTop: 18 }} />
      {therapist && (
        <View style={[styles.row, { gap: 10, marginTop: 10 }]}>
          <Button label="Plan" icon="layers" variant="light" style={{ flex: 1 }} onPress={() => navigation.navigate('Tabs', { screen: 'Plan', params: { childId: child.id } })} />
          <Button label="Tuning" icon="sliders" variant="light" style={{ flex: 1 }} onPress={() => navigation.navigate('Tuning', { childId: child.id })} />
        </View>
      )}

      <SectionHeader title="Attention profile" subtitle={profileSentence(child, profile)} />
      <Card>
        <DomainBars profile={profile} />
      </Card>

      <SectionHeader title="Recent practice" action={`${st.count} sessions`} />
      <View style={{ gap: 10 }}>
        {st.sessions.slice(0, 5).map((s) => {
          const acc = sessionAccuracy(s);
          const t = TASKS[s.blocks.find((b) => b.accuracy !== null)?.taskId ?? s.blocks[0]?.taskId ?? 'starWatch'];
          return (
            <Card key={s.id} onPress={() => navigation.navigate('Summary', { sessionId: s.id })} style={[styles.row, { gap: 14 }]}>
              <TaskIcon icon={t.icon} tint={colors.sage} size={48} />
              <View style={{ flex: 1 }}>
                <T.H3>{s.blocks.map((b) => TASKS[b.taskId].name).filter((n, i, a) => a.indexOf(n) === i && n !== 'Feelings Check-in').slice(0, 2).join(' + ') || 'Check-in'}</T.H3>
                <T.Small>
                  {shortDate(s.startedAt)} · {s.by === 'parent' ? 'at home' : 'in clinic'}
                </T.Small>
              </View>
              <Text style={styles.acc}>{acc === null ? '—' : pct(acc)}</Text>
            </Card>
          );
        })}
        {st.count === 0 && <T.Body>No sessions yet. Start one above.</T.Body>}
      </View>

      {therapist && (
        <>
          <SectionHeader title="Family access" subtitle="Parents enter this code when they choose “I’m a parent”." />
          <Card style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.code}>{child.familyCode}</Text>
            <Button
              label="Share code"
              icon="share-2"
              variant="light"
              onPress={() =>
                Share.share({ message: `Bloom Focus family code for ${child.name.split(' ')[0]}: ${child.familyCode}` })
              }
            />
          </Card>
        </>
      )}

      <Button
        label={exporting ? 'Preparing report…' : 'Export progress report (PDF)'}
        icon="file-text"
        variant="soft"
        disabled={exporting}
        onPress={exportPdf}
        style={{ marginTop: 16 }}
      />

      <SectionHeader title="Recent family messages" />
      <NotesThread childId={child.id} limit={6} />

      {therapist && (
        <Button label="Remove local profile" icon="trash-2" variant="danger" onPress={remove} style={{ marginTop: 28 }} />
      )}
      <T.Small style={{ textAlign: 'center', marginTop: 12 }}>
        <Feather name="lock" size={12} /> Demo profiles stay on this device. Do not use this demo for clinical records.
      </T.Small>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: { backgroundColor: colors.mint, borderRadius: 30, padding: 22 },
  focusChip: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16 },
  focusText: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  level: { fontFamily: font.bold, fontSize: 26, color: colors.ink },
  levelOf: { fontFamily: font.regular, fontSize: 15, color: colors.inkSoft },
  acc: { fontFamily: font.bold, fontSize: 18, color: colors.forest },
  code: { fontFamily: font.heavy, fontSize: 26, letterSpacing: 4, color: colors.ink },
});
