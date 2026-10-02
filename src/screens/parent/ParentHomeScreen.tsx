import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, ProgressBar, Screen, T } from '../../components/ui';
import { attentionProfile, childSessions, sessionAccuracy, startOfWeek } from '../../engine/profile';
import { starsFor, TRAIN_BY_ID, TRAIN_IDS, type TrainTaskId } from '../../engine/trainTasks';
import { SUPPORT_LEVELS } from '../../services/noteCards';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import { childStats, dayStreak, firstName } from '../helpers';

export default function ParentHomeScreen() {
  const nav = useNavigation<any>();
  const { parentChildId, children, sessions } = useStore();
  const child = children.find((c) => c.id === parentChildId) || children[0];

  if (!child) {
    return (
      <Screen>
        <T.H1>Please select a child</T.H1>
      </Screen>
    );
  }

  const first = firstName(child.name);
  const mine = childSessions(sessions, child.id);
  const profile = attentionProfile(mine);
  const streak = dayStreak(mine);

  // Accurate stars & sessions count
  const stars = mine.reduce((acc, s) => acc + starsFor(sessionAccuracy(s)), 0);
  const sessionCount = mine.length;

  const st = childStats(child, sessions);
  const maxLevel = st?.level && !isNaN(st.level) ? st.level : null;

  // Weekly Goal calculation
  const weekStart = startOfWeek().getTime();
  const thisWeekSessions = mine.filter((s) => new Date(s.startedAt).getTime() >= weekStart).length;
  const weeklyGoal = Math.max(1, child.homeSessionsPerWeek || 3);
  const goalProgress = Math.min(1, thisWeekSessions / weeklyGoal);

  // Correct domain lookup: selective, sustained, workingMemory, inhibition
  const getDomainScore = (domainName: string) => {
    const found = profile.find((p) => p.domain === domainName);
    if (found && found.score !== null && found.blocks >= 2) return Math.round(found.score * 100);
    return null;
  };

  const domainScores = [
    { label: 'Sustained Attention', icon: '🎯', score: getDomainScore('sustained') },
    { label: 'Visual & Flanker Focus', icon: '👀', score: getDomainScore('selective') },
    { label: 'Working Memory & Grid', icon: '🧠', score: getDomainScore('workingMemory') },
    { label: 'Impulse Control & Stroop', icon: '🛑', score: getDomainScore('inhibition') },
  ];

  const themeEmojis: Record<string, string> = {
    stars: '⭐ Stars',
    animals: '🐶 Animals',
    vehicles: '🚗 Vehicles',
    nature: '🌸 Flowers',
    celebration: '🎉 Celebration',
  };

  return (
    <Screen scroll>
      {/* Top Child Header */}
      <View style={[styles.row, { gap: 14, marginBottom: 18 }]}>
        <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={50} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.medium, color: colors.inkSoft, fontSize: 14 }}>Good to see you,</Text>
          <Text style={{ fontFamily: font.bold, color: colors.ink, fontSize: 22 }}>{first}</Text>
        </View>
        <View style={styles.streakBadge}>
          <Feather name="zap" size={16} color="#EA580C" />
          <Text style={{ fontFamily: font.heavy, color: '#EA580C', fontSize: 14 }}>{streak}d</Text>
        </View>
      </View>

      {/* Hero: Today's Adaptive Session */}
      <View style={{ borderRadius: 26, overflow: 'hidden', marginBottom: 16 }}>
        <LinearGradient colors={['#2D5A43', '#1E3E2E']} style={{ padding: 22 }}>
          <View style={styles.heroTopTag}>
            <View style={styles.tagDot} />
            <Text style={styles.tagText}>ADAPTIVE SESSION READY</Text>
          </View>
          <Text style={{ fontFamily: font.bold, color: 'white', fontSize: 24, lineHeight: 30, marginBottom: 8, marginTop: 8 }}>
            Today’s Focus Workout
          </Text>
          <Text style={{ fontFamily: font.medium, color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 18, lineHeight: 18 }}>
            {child.currentMinutes} min session · dynamically adapts tasks to {first}'s performance
          </Text>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9 }]}
            onPress={() => nav.navigate('Session', { childId: child.id })}
          >
            <Text style={{ fontFamily: font.bold, color: '#1E3E2E', fontSize: 15 }}>Start practice</Text>
            <Feather name="arrow-right" size={17} color="#1E3E2E" />
          </Pressable>
        </LinearGradient>
      </View>

      {/* Key Numbers Grid */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <Card style={styles.statBox}>
          <Text style={{ fontSize: 20, marginBottom: 2 }}>⭐</Text>
          <Text style={styles.statNum}>{stars}</Text>
          <Text style={styles.statLabel}>Stars</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={{ fontSize: 20, marginBottom: 2 }}>🎯</Text>
          <Text style={styles.statNum}>{sessionCount}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={{ fontSize: 20, marginBottom: 2 }}>📈</Text>
          <Text style={styles.statNum}>{maxLevel ?? '—'}</Text>
          <Text style={styles.statLabel}>Level</Text>
        </Card>
      </View>

      {/* Weekly Practice Goal Banner */}
      <Card style={{ padding: 16, borderRadius: 20, marginBottom: 16 }}>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
          <View style={[styles.row, { gap: 8 }]}>
            <Feather name="calendar" size={16} color={colors.forest} />
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>Weekly Home Goal</Text>
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: thisWeekSessions >= weeklyGoal ? '#10B981' : colors.forest }}>
            {thisWeekSessions} of {weeklyGoal} sessions
          </Text>
        </View>
        <ProgressBar value={goalProgress} height={8} color={thisWeekSessions >= weeklyGoal ? '#10B981' : colors.forest} />
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 8 }}>
          {thisWeekSessions >= weeklyGoal
            ? `🎉 Fantastic! ${first} met the home practice target this week.`
            : `${weeklyGoal - thisWeekSessions} more ${weeklyGoal - thisWeekSessions === 1 ? 'session' : 'sessions'} to hit this week's target.`}
        </Text>
      </Card>

      {/* Therapist Guidance Note */}
      {child.homeNote ? (
        <Card style={styles.guidanceCard}>
          <View style={[styles.row, { gap: 10, marginBottom: 8 }]}>
            <View style={styles.guidanceIcon}>
              <Feather name="clipboard" size={16} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guidanceTitle}>From the Therapist</Text>
              <Text style={styles.guidanceSub}>Home program instructions</Text>
            </View>
          </View>
          <Text style={styles.guidanceText}>{child.homeNote}</Text>
          <Pressable
            style={[styles.row, { gap: 6, marginTop: 10, alignSelf: 'flex-start' }]}
            onPress={() => nav.navigate('Tabs', { screen: 'Notes' })}
          >
            <Feather name="message-square" size={14} color={colors.forest} />
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.forest }}>Reply in messages</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* Therapist-built activities, personalised with the child's favourite characters */}
      {(child.customActivities ?? []).length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
            <T.H2 style={{ fontSize: 19 }}>From your therapist</T.H2>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.inkSoft }}>Made for {first}</Text>
          </View>
          <View style={{ gap: 10 }}>
            {(child.customActivities ?? []).map((a) => {
              const g = TRAIN_BY_ID[a.taskId as TrainTaskId];
              const done = mine.filter((s) => new Date(s.startedAt).getTime() >= weekStart && s.blocks.some((b) => b.taskId === a.taskId)).length;
              const complete = done >= a.timesPerWeek;
              const support = SUPPORT_LEVELS.find((l) => l.value === a.supportLevel);
              return (
                <Card key={a.id} style={styles.customCard}>
                  <View style={[styles.row, { gap: 12 }]}>
                    <View style={[styles.customIcon, { backgroundColor: g?.tint ?? colors.sage }]}>
                      <Text style={{ fontSize: 26 }}>{a.hero?.emoji ?? g?.icon ?? '🌱'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customTitle}>{a.name}</Text>
                      <Text style={styles.customMeta}>
                        {g?.skill ?? 'Activity'} · {a.timesPerWeek === 7 ? 'daily' : `${a.timesPerWeek}× a week`}
                        {support ? ` · ${support.emoji} ${support.label}` : ''}
                      </Text>
                    </View>
                    {complete && <Text style={{ fontSize: 20 }}>🏅</Text>}
                  </View>
                  {!!a.instructions && <Text style={styles.customNote}>“{a.instructions}”</Text>}
                  <View style={[styles.row, { gap: 6, marginTop: 10 }]}>
                    {Array.from({ length: Math.min(a.timesPerWeek, 7) }).map((_, i) => (
                      <View key={i} style={[styles.dot, i < done && { backgroundColor: colors.leaf, borderColor: colors.leaf }]} />
                    ))}
                    <Text style={styles.customMeta}>
                      {' '}
                      {Math.min(done, a.timesPerWeek)}/{a.timesPerWeek} this week
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => nav.navigate('TrainGame', { childId: child.id, taskId: a.taskId, customId: a.id })}
                    style={[styles.customStart, { backgroundColor: g?.color ?? colors.forest }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${a.name}`}
                  >
                    <Feather name="play" size={16} color={colors.white} />
                    <Text style={styles.customStartText}>{complete ? 'Play again' : 'Start'}</Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        </View>
      )}

      {/* Solo Train Mode Shortcut */}
      <Card
        onPress={() => nav.navigate('Tabs', { screen: 'Train' })}
        style={{ padding: 16, borderRadius: 20, marginBottom: 16, backgroundColor: '#FAF9F5', borderColor: '#EAE6DB' }}
      >
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View style={[styles.row, { gap: 12 }]}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>🧠</Text>
            </View>
            <View>
              <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.ink }}>Solo Focus Library</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.inkSoft }}>{TRAIN_IDS.length} cognitive activities</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={colors.inkSoft} />
        </View>
      </Card>

      {/* Attention Profile Preview */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
        <T.H2 style={{ fontSize: 19 }}>Attention snapshot</T.H2>
        <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Progress' })}>
          <Text style={{ fontFamily: font.semibold, color: colors.forest, fontSize: 14 }}>Full analytics →</Text>
        </Pressable>
      </View>

      <Card style={{ padding: 18, borderRadius: 20, gap: 14, marginBottom: 16 }}>
        {domainScores.map((item) => (
          <View key={item.label} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.inkSoft }}>{item.label}</Text>
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink }}>
                {item.score === null ? 'Not enough data yet' : `${item.score}%`}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#F0ECE4', borderRadius: 4, overflow: 'hidden' }}>
              {item.score !== null && <View style={{ height: 8, width: `${item.score}%`, backgroundColor: '#2E694D', borderRadius: 4 }} />}
            </View>
          </View>
        ))}
      </Card>

      {/* Reward Theme & Motivation */}
      <Card style={{ padding: 14, borderRadius: 18, marginBottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={[styles.row, { gap: 10 }]}>
          <Feather name="award" size={18} color={colors.forest} />
          <View>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.ink }}>Active rewards</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: colors.inkMuted }}>
              Collecting {themeEmojis[child.rewardTheme] ?? '⭐ Stars'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Profile' })}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.forest }}>Change</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  heroTopTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86EFAC' },
  tagText: { fontFamily: font.bold, fontSize: 11, color: '#DCFCE7', letterSpacing: 0.8 },
  startBtn: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.15)',
    elevation: 3,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 18 },
  statNum: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  statLabel: { fontFamily: font.medium, fontSize: 12, color: colors.inkMuted },
  customCard: { padding: 14, borderRadius: 20 },
  customIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  customTitle: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  customMeta: { fontFamily: font.medium, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  customNote: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: 10, fontStyle: 'italic' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  customStart: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, marginTop: 12 },
  customStartText: { fontFamily: font.semibold, fontSize: 14.5, color: colors.white },
  guidanceCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#F3F8F4',
    borderColor: '#D4E6D9',
  },
  guidanceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2F0E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceTitle: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  guidanceSub: { fontFamily: font.regular, fontSize: 11, color: colors.inkMuted },
  guidanceText: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, lineHeight: 20, marginTop: 4 },
});
