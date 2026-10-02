import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORT_LEVELS, activityCompletion, gameInfo, isTrainId, pct } from '../services/noteCards';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { NoteCard, Role } from '../types';

/** Activity, game-result and weekly-progress cards shown inside a message bubble. */
export function NoteCardView({ card, childId, createdAt, viewer }: { card: NoteCard; childId: string; createdAt: string; viewer: Role }) {
  switch (card.type) {
    case 'activity':
      return <ActivityCard card={card} childId={childId} createdAt={createdAt} viewer={viewer} />;
    case 'result':
      return <ResultCard card={card} childId={childId} />;
    case 'progress':
      return <ProgressCard card={card} childId={childId} viewer={viewer} />;
    case 'routine':
      return <RoutineCard card={card} viewer={viewer} />;
    default:
      return null;
  }
}

function ActivityCard({
  card,
  childId,
  createdAt,
  viewer,
}: {
  card: Extract<NoteCard, { type: 'activity' }>;
  childId: string;
  createdAt: string;
  viewer: Role;
}) {
  const nav = useNavigation<any>();
  const sessions = useStore((s) => s.sessions);
  const g = gameInfo(card.taskId);
  const done = activityCompletion(sessions, childId, card.taskId, createdAt);
  const playable = isTrainId(card.taskId);
  const support = SUPPORT_LEVELS.find((s) => s.value === card.supportLevel);
  // A custom activity opens with the therapist's own settings, if it still exists on this device.
  const customExists = useStore((s) => !!card.customId && !!s.children.find((c) => c.id === childId)?.customActivities?.some((a) => a.id === card.customId));

  return (
    <View style={styles.card}>
      <View style={[styles.head, { backgroundColor: g.tint }]}>
        <Text style={styles.headEmoji}>{card.heroEmoji ?? g.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: g.color }]}>{card.customId ? 'CUSTOM ACTIVITY' : 'ASSIGNED ACTIVITY'}</Text>
          <Text style={styles.title}>{card.title ?? g.title}</Text>
          <Text style={styles.subtitle}>{g.skill}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.chips}>
          <Chip icon="bar-chart" label={`Level ${card.level}`} />
          <Chip icon="clock" label={`~${card.minutes} min`} />
          {!!card.frequency && <Chip icon="repeat" label={card.frequency} />}
        </View>
        {support && (
          <View style={[styles.supportRow, { backgroundColor: support.value === 'hands-on' ? colors.rose + '30' : colors.sage }]}>
            <Text style={styles.supportEmoji}>{support.emoji}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.supportLabel}>Support at home</Text>
              <Text style={styles.supportHint}>{support.hint}</Text>
            </View>
          </View>
        )}
        {viewer === 'parent' && !!g.tip && <Text style={styles.tip}>💡 {g.tip}</Text>}
        {!!card.rewardTip && (
          <View style={[styles.rewardRow]}>
            <Feather name="star" size={13} color="#E8B93A" />
            <Text style={styles.rewardText} numberOfLines={2}>
              {card.rewardTip}
            </Text>
          </View>
        )}
        {!!card.therapistNote && (
          <View style={styles.quote}>
            <Text style={styles.quoteMark}>“</Text>
            <Text style={styles.quoteText}>{card.therapistNote}</Text>
          </View>
        )}
        <View style={[styles.status, done ? styles.statusDone : styles.statusTodo]}>
          <Feather name={done ? 'check-circle' : 'circle'} size={15} color={done ? colors.forest : colors.inkMuted} />
          <Text style={[styles.statusText, done && { color: colors.forest }]}>
            {done
              ? `Done ${done.times === 1 ? 'once' : `${done.times}×`}${done.best !== null ? ` · best ${pct(done.best)}` : ''}`
              : 'Not played yet'}
          </Text>
        </View>
        {playable && (
          <CardButton
            icon={viewer === 'parent' ? 'play' : 'trending-up'}
            label={viewer === 'parent' ? (done ? 'Play again' : 'Start activity') : 'View skill progress'}
            color={g.color}
            filled={viewer === 'parent'}
            onPress={() =>
              viewer === 'parent'
                ? nav.navigate('TrainGame', { childId, taskId: card.taskId, ...(customExists ? { customId: card.customId } : {}) })
                : nav.navigate('SkillDetail', { childId, taskId: card.taskId })
            }
          />
        )}
      </View>
    </View>
  );
}

function ResultCard({ card, childId }: { card: Extract<NoteCard, { type: 'result' }>; childId: string }) {
  const nav = useNavigation<any>();
  const hasSession = useStore((s) => s.sessions.some((x) => x.id === card.sessionId));
  const g = gameInfo(card.taskId);
  const levelUp = card.levelAfter > card.levelBefore;
  const mins = Math.floor(card.activeSec / 60);
  const secs = card.activeSec % 60;

  return (
    <View style={styles.card}>
      <View style={[styles.head, { backgroundColor: g.tint }]}>
        <Text style={styles.headEmoji}>{card.heroEmoji ?? g.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: g.color }]}>GAME RESULT</Text>
          <Text style={styles.title}>{card.title ?? g.title}</Text>
          <Text style={styles.subtitle}>{g.skill}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{pct(card.accuracy)}</Text>
          <Text style={styles.stars} accessibilityLabel={`${card.stars} of 3 stars`}>
            {'★'.repeat(card.stars)}
            <Text style={{ color: colors.border }}>{'★'.repeat(Math.max(0, 3 - card.stars))}</Text>
          </Text>
        </View>
        <View style={styles.chips}>
          <Chip
            icon={levelUp ? 'arrow-up-right' : 'minus'}
            label={levelUp ? `Level ${card.levelBefore} → ${card.levelAfter}` : `Level ${card.levelAfter}`}
            highlight={levelUp}
          />
          <Chip icon="clock" label={mins ? `${mins} min ${secs ? `${secs}s` : ''}`.trim() : `${secs}s`} />
        </View>
        <Text style={styles.encourage}>{encouragementFor(card.stars, card.accuracy, levelUp, card.activeSec)}</Text>
        {hasSession && (
          <CardButton icon="list" label="View session details" color={g.color} onPress={() => nav.navigate('SessionDetail', { sessionId: card.sessionId, childId })} />
        )}
      </View>
    </View>
  );
}

function ProgressCard({ card, childId, viewer }: { card: Extract<NoteCard, { type: 'progress' }>; childId: string; viewer: Role }) {
  const nav = useNavigation<any>();
  const goalShare = Math.min(1, card.sessions / Math.max(1, card.goal));
  const delta =
    card.avgAccuracy !== null && card.prevAvgAccuracy !== null ? Math.round((card.avgAccuracy - card.prevAvgAccuracy) * 100) : null;
  const week = new Date(`${card.weekOf}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });

  return (
    <View style={styles.card}>
      <View style={[styles.head, { backgroundColor: colors.sage }]}>
        <Text style={styles.headEmoji}>📈</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.forest }]}>WEEKLY PROGRESS</Text>
          <Text style={styles.title}>Week of {week}</Text>
          <Text style={styles.subtitle}>
            {card.sessions >= card.goal ? 'Home goal reached 🎉' : `${card.goal - card.sessions} more to reach the home goal`}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.milestones}>
          {milestonesFor(card).map((m, i) => (
            <View key={i} style={[styles.milestone, { backgroundColor: m.tint }]}>
              <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
              <Text style={[styles.milestoneText, { color: m.color }]}>{m.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.goalRow}>
          <Text style={styles.goalText}>
            {card.sessions} / {card.goal} sessions
          </Text>
          <Text style={styles.goalPrev}>last week {card.prevSessions}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${goalShare * 100}%` }]} />
        </View>
        <View style={styles.stats}>
          <Stat value={`${card.minutes}`} label="minutes" />
          <Stat value={`${card.stars}★`} label="stars" />
          <Stat
            value={pct(card.avgAccuracy)}
            label="accuracy"
            trend={delta === null || delta === 0 ? undefined : delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}
            up={(delta ?? 0) > 0}
          />
        </View>
        {card.strongest && <SkillLine label="Strongest" taskId={card.strongest.taskId} accuracy={card.strongest.accuracy} />}
        {card.practiceMore && <SkillLine label="Practise more" taskId={card.practiceMore.taskId} accuracy={card.practiceMore.accuracy} />}
        {card.levelUps > 0 && (
          <Text style={styles.levelUps}>
            ⬆ {card.levelUps} level-up{card.levelUps === 1 ? '' : 's'} this week
          </Text>
        )}
        <CardButton
          icon="bar-chart-2"
          label={viewer === 'parent' ? 'Open progress' : 'Open child profile'}
          color={colors.forest}
          onPress={() => (viewer === 'parent' ? nav.navigate('Tabs', { screen: 'Progress' }) : nav.navigate('ChildProfile', { childId }))}
        />
      </View>
    </View>
  );
}

function RoutineCard({
  card,
  viewer,
}: {
  card: Extract<NoteCard, { type: 'routine' }>;
  viewer: Role;
}) {
  const total = card.steps.length;
  const support = SUPPORT_LEVELS.find((s) => s.value === card.supportLevel);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const n = checked.size;
  const allDone = n === total;

  const toggle = (i: number) => {
    if (viewer !== 'parent') return;
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <View style={styles.card}>
      <View style={[styles.head, { backgroundColor: colors.butter }]}>
        <Text style={styles.headEmoji}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: '#8A6218' }]}>
            {card.timeOfDay ? `${card.timeOfDay.toUpperCase()} ROUTINE` : 'DAILY ROUTINE'}
          </Text>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.subtitle}>
            {n}/{total} step{total === 1 ? '' : 's'} checked · {allDone ? 'All done, great job! 🎉' : 'Tap a step to check it off'}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        {support && (
          <View style={[styles.supportRow, { backgroundColor: support.value === 'hands-on' ? colors.rose + '30' : colors.sage }]}>
            <Text style={styles.supportEmoji}>{support.emoji}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.supportLabel}>How to support</Text>
              <Text style={styles.supportHint}>{support.label} · {support.hint}</Text>
            </View>
          </View>
        )}
        <View style={styles.stepsWrap}>
          {card.steps.map((step, i) => {
            const done = checked.has(i);
            return (
              <Pressable
                key={i}
                onPress={() => toggle(i)}
                style={({ pressed }) => [styles.stepRow, pressed && { opacity: 0.85 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                disabled={viewer !== 'parent'}
              >
                <View style={[styles.stepCheck, done && styles.stepCheckDone]}>
                  {done && <Feather name="check" size={13} color={colors.white} />}
                </View>
                <Text style={[styles.stepText, done && styles.stepTextDone]} numberOfLines={2}>
                  {step}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.progress, allDone && styles.progressAllDone]}>
          <View style={[styles.progressFill, { width: `${(n / Math.max(1, total)) * 100}%` }]} />
          <Text style={styles.progressText}>
            {viewer === 'parent'
              ? allDone
                ? 'Share this win with your therapist →'
                : n > 0
                  ? 'Send an update about this routine →'
                  : undefined
              : undefined}
          </Text>
        </View>
        {!!card.therapistNote && (
          <View style={styles.quote}>
            <Text style={styles.quoteMark}>“</Text>
            <Text style={styles.quoteText}>{card.therapistNote}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function encouragementFor(
  stars: number,
  accuracy: number | null,
  levelUp: boolean,
  activeSec: number,
): string {
  const acc = accuracy ?? 0;
  if (levelUp) return 'A new level unlocked — that’s focused practice paying off! 🌟';
  if (stars === 3) return 'Three stars today — such steady attention, well done! ⭐⭐⭐';
  if (acc >= 0.8) return 'Really crisp responses today, keep the energy going! 💪';
  if (activeSec >= 180) return 'A long, focused session — stamina builds a little every day 🌱';
  if (stars >= 1) return 'Nice effort! Even a short round keeps the attention muscles warm.';
  return 'Every turn counts. Try again when rested — it gets easier! 💛';
}

type Milestone = { emoji: string; label: string; color: string; tint: string };
function milestonesFor(card: Extract<NoteCard, { type: 'progress' }>): Milestone[] {
  const out: Milestone[] = [];
  if (card.sessions >= card.goal) {
    out.push({ emoji: '🎯', label: 'Goal met', color: '#6B4A12', tint: colors.butter });
  }
  const upFromLast = card.avgAccuracy !== null && card.prevAvgAccuracy !== null && card.avgAccuracy - card.prevAvgAccuracy >= 0.05;
  if (upFromLast) out.push({ emoji: '📈', label: 'Accuracy up', color: '#1F5E42', tint: colors.mint });
  if (card.levelUps >= 1) {
    out.push({
      emoji: '⬆️',
      label: `${card.levelUps} level-up${card.levelUps === 1 ? '' : 's'}`,
      color: '#2D4F73',
      tint: colors.sky,
    });
  }
  if (card.sessions > card.prevSessions && card.prevSessions > 0) {
    out.push({ emoji: '🔥', label: 'More sessions', color: '#7A3B27', tint: colors.peach });
  }
  if (card.stars >= 15) out.push({ emoji: '⭐', label: `${card.stars} stars`, color: '#6B4A12', tint: colors.butter });
  if (out.length === 0) out.push({ emoji: '🌱', label: 'Growing week by week', color: '#1F5E42', tint: colors.sage });
  return out.slice(0, 3);
}

function Chip({ icon, label, highlight }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.chip, highlight && styles.chipHighlight]}>
      <Feather name={icon} size={12} color={highlight ? colors.forest : colors.inkSoft} />
      <Text style={[styles.chipText, highlight && { color: colors.forest }]}>{label}</Text>
    </View>
  );
}

function Stat({ value, label, trend, up }: { value: string; label: string; trend?: string; up?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {!!trend && <Text style={[styles.trend, { color: up ? colors.forest : colors.danger }]}>{trend}</Text>}
    </View>
  );
}

function SkillLine({ label, taskId, accuracy }: { label: string; taskId: string; accuracy: number }) {
  const g = gameInfo(taskId);
  return (
    <View style={styles.skillLine}>
      <Text style={styles.skillLabel}>{label}</Text>
      <Text style={styles.skillName} numberOfLines={1}>
        {g.icon} {g.skill}
      </Text>
      <Text style={styles.skillPct}>{pct(accuracy)}</Text>
    </View>
  );
}

function CardButton({
  icon,
  label,
  color,
  filled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, filled ? { backgroundColor: color } : { borderColor: color, borderWidth: 1 }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={15} color={filled ? colors.white : color} />
      <Text style={[styles.buttonText, { color: filled ? colors.white : color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 262,
    maxWidth: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  headEmoji: { fontSize: 26 },
  kicker: { fontFamily: font.bold, fontSize: 10, letterSpacing: 0.8 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: 1 },
  subtitle: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  body: { padding: 12, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.bg },
  chipHighlight: { backgroundColor: colors.mint },
  chipText: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
  },
  supportEmoji: { fontSize: 18 },
  supportLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.ink },
  supportHint: { fontFamily: font.regular, fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  rewardText: { flex: 1, fontFamily: font.medium, fontSize: 12.5, color: '#7A6220' },
  quote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
  },
  quoteMark: {
    fontFamily: font.heavy,
    fontSize: 22,
    lineHeight: 22,
    color: colors.forest,
    marginTop: -4,
    marginHorizontal: 2,
  },
  quoteText: { flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: colors.inkSoft, fontStyle: 'italic' },
  encourage: {
    fontFamily: font.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.forest,
    backgroundColor: colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  milestones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  milestone: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  milestoneEmoji: { fontSize: 13, lineHeight: 14 },
  milestoneText: { fontFamily: font.semibold, fontSize: 11.5 },
  stepsWrap: { gap: 5, marginTop: 2 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  stepCheck: {
    marginTop: 1,
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepCheckDone: { backgroundColor: colors.forest, borderColor: colors.forest },
  stepText: { flex: 1, fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  stepTextDone: { textDecorationLine: 'line-through', color: colors.inkMuted },
  progress: {
    position: 'relative',
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressAllDone: { backgroundColor: colors.mint },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.leaf,
  },
  progressText: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.forest,
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  tip: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  statusDone: { backgroundColor: colors.mint },
  statusTodo: { backgroundColor: colors.bg },
  statusText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.inkSoft },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 11,
  },
  buttonText: { fontFamily: font.semibold, fontSize: 13.5 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  score: { fontFamily: font.heavy, fontSize: 30, color: colors.ink },
  stars: { fontSize: 20, color: '#E8B93A', letterSpacing: 2 },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  goalText: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  goalPrev: { fontFamily: font.regular, fontSize: 11.5, color: colors.inkMuted },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden', marginTop: -4 },
  fill: { height: 7, borderRadius: 4, backgroundColor: colors.leaf },
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg },
  statValue: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  statLabel: { fontFamily: font.regular, fontSize: 11, color: colors.inkMuted, marginTop: 1 },
  trend: { fontFamily: font.semibold, fontSize: 10.5, marginTop: 2 },
  skillLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillLabel: { width: 88, fontFamily: font.medium, fontSize: 12, color: colors.inkMuted },
  skillName: { flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.ink },
  skillPct: { fontFamily: font.bold, fontSize: 12.5, color: colors.ink },
  levelUps: { fontFamily: font.semibold, fontSize: 12.5, color: colors.forest },
});
