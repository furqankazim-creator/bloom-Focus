import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlockResultCard } from '../components/BlockResultCard';
import { Avatar } from '../components/ui';
import { taskLevel } from '../engine/adaptive';
import { DOMAIN_LABEL } from '../engine/tasks';
import { sessionAccuracy } from '../engine/profile';
import { TRAIN_GAME, TrainTaskId, starsFor, taskDisplay, trainTaskDef } from '../games/train/meta';
import type { RootProps } from '../navigation/types';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';
import { OBSERVATIONS } from './SessionScreen';
import { headline } from './TrainGameScreen';
import { SampleBanner } from '../components/SampleBanner';
import { useChildHistory } from './helpers';

export default function SessionDetailScreen({ route, navigation }: RootProps<'SessionDetail'>) {
  const stored = useStore((s) => s.sessions.find((x) => x.id === route.params.sessionId));
  const child = useStore((s) => s.children.find((c) => c.id === (stored?.childId ?? route.params.childId)));
  // Sample sessions aren't stored, so look them up in the child's generated history.
  const { sessions: history_, isDemo } = useChildHistory(child);
  const session = stored ?? history_.find((x) => x.id === route.params.sessionId);
  if (!session || !child) return null;

  const acc = sessionAccuracy(session);
  const stars = starsFor(acc);
  const first = child.name.split(' ')[0];
  const single = session.blocks.length === 1 ? session.blocks[0] : null;
  const display = single ? taskDisplay(single.taskId) : { title: 'Mixed session', icon: '🌱', color: colors.forest };
  const trainId = single && TRAIN_GAME[single.taskId as TrainTaskId] ? (single.taskId as TrainTaskId) : null;
  const obs = OBSERVATIONS.find((o) => o.id === session.observation);
  const date = new Date(session.startedAt);
  const when = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // How this skill has gone over the child's recent games, for context.
  const history = trainId
    ? history_
        .filter((s) => s.blocks.some((b) => b.taskId === trainId && b.accuracy !== null))
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    : [];
  const idx = history.findIndex((s) => s.id === session.id);
  const prev = idx > 0 ? sessionAccuracy(history[idx - 1]) : null;
  const delta = acc !== null && prev !== null ? Math.round((acc - prev) * 100) : null;
  const best = history.reduce((m, s) => Math.max(m, sessionAccuracy(s) ?? 0), 0);
  const currentLevel = trainId ? taskLevel(trainTaskDef(trainId), child.tasks[trainId].params) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.close} hitSlop={8} accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Session details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isDemo && <SampleBanner name={first} />}
        <View style={styles.childCard}>
          <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childMeta}>
              Age {child.age} · Focus: {DOMAIN_LABEL[child.focus]}
            </Text>
            <Text style={styles.childMeta}>
              {when} · {time} · {session.by === 'parent' ? 'at home' : 'with therapist'}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={{ fontSize: 44, lineHeight: 54 }}>{display.icon}</Text>
          <Text style={styles.heroSkill}>{display.title.toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{acc === null ? 'Practice complete' : headline(stars)}</Text>
          <View style={styles.starsRow}>
            {[0, 1, 2].map((i) => (
              <Text key={i} style={[styles.star, i >= stars && { opacity: 0.2 }]}>
                ⭐
              </Text>
            ))}
          </View>
          <Text style={styles.heroAcc}>{acc === null ? '—' : `${Math.round(acc * 100)}%`}</Text>
          <Text style={styles.heroAccLabel}>ACCURACY</Text>
        </View>

        {trainId && (
          <Pressable onPress={() => navigation.navigate('SkillDetail', { childId: child.id, taskId: trainId })} style={styles.skillLink}>
            <Text style={styles.skillLinkText}>See all {TRAIN_GAME[trainId].skill} progress</Text>
            <Feather name="chevron-right" size={16} color={colors.forest} />
          </Pressable>
        )}
        {trainId && (
          <View style={styles.trendRow}>
            <Mini label="vs last time" value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`} tone={delta === null ? 'neutral' : delta >= 0 ? 'up' : 'down'} />
            <Mini label="Best score" value={`${Math.round(best * 100)}%`} tone="neutral" />
            <Mini label="Level now" value={String(currentLevel)} tone="neutral" />
          </View>
        )}

        <View style={{ gap: 12 }}>
          {session.blocks.map((b, i) => (
            <BlockResultCard key={i} block={b} />
          ))}
        </View>

        {(obs || session.note) && (
          <View style={styles.noteCard}>
            {obs && session.blocks.length > 1 && (
              <Text style={styles.noteText}>
                <Text style={{ fontFamily: font.bold }}>Observation: </Text>
                {obs.title}
              </Text>
            )}
            {session.note && (
              <Text style={styles.noteText}>
                <Text style={{ fontFamily: font.bold }}>Note: </Text>
                {session.note}
              </Text>
            )}
          </View>
        )}

        {trainId && (
          <Pressable
            onPress={() => navigation.navigate('TrainGame', { childId: child.id, taskId: trainId })}
            style={[styles.primary, { backgroundColor: TRAIN_GAME[trainId].color }]}
            accessibilityRole="button"
          >
            <Feather name="play" size={18} color={colors.white} />
            <Text style={styles.primaryText}>Play {TRAIN_GAME[trainId].title} again</Text>
          </Pressable>
        )}
        <Text style={styles.disclaimer}>
          {first}’s practice summary — not a clinical assessment.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: 'up' | 'down' | 'neutral' }) {
  const color = tone === 'up' ? '#138A5E' : tone === 'down' ? '#B5533C' : colors.ink;
  return (
    <View style={styles.mini}>
      <Text style={[styles.miniValue, { color }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBFAF7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEECE6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.heavy, fontSize: 17, color: colors.ink },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 4,
  },
  childName: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  childMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroSkill: { marginTop: 8, fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: colors.inkMuted },
  heroTitle: { fontFamily: font.heavy, fontSize: 26, color: colors.ink, marginTop: 4 },
  starsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  star: { fontSize: 28, lineHeight: 36 },
  heroAcc: { fontFamily: font.heavy, fontSize: 34, color: colors.ink, marginTop: 10 },
  heroAccLabel: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.4, color: colors.inkMuted },
  skillLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 12, paddingVertical: 6 },
  skillLinkText: { fontFamily: font.bold, fontSize: 14, color: colors.forest },
  trendRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mini: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  miniValue: { fontFamily: font.heavy, fontSize: 18 },
  miniLabel: { fontFamily: font.medium, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  noteCard: { marginTop: 12, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  noteText: { fontFamily: font.regular, fontSize: 14, color: colors.ink, lineHeight: 20 },
  primary: {
    marginTop: 20,
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: font.bold, fontSize: 16, color: colors.white },
  disclaimer: { textAlign: 'center', fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 16 },
});
