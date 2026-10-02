import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REWARD_ICON, RewardBurst } from '../components/RewardBurst';
import { Avatar, Button, Card, ProgressBar, T, TaskIcon } from '../components/ui';
import { adapt, placeFromBaseline, taskLevel } from '../engine/adaptive';
import { adaptMinutes, planSession } from '../engine/scheduler';
import { TASKS } from '../engine/tasks';
import { GAMES } from '../games';
import { GameResult, useTicker } from '../games/common';
import type { RootProps } from '../navigation/types';
import { uid } from '../store/seed';
import { useChild, useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { BlockResult, Observation, TaskId, TaskState } from '../types';

/** No touches for this long during an activity counts as attention drifting. */
const IDLE_MS = 15_000;

export const OBSERVATIONS: { id: Observation; icon: React.ComponentProps<typeof Feather>['name']; title: string; sub: string }[] = [
  { id: 'stayed', icon: 'sun', title: 'Stayed with it', sub: 'Focused most of the time' },
  { id: 'reminders', icon: 'feather', title: 'A few reminders', sub: 'Needed some support' },
  { id: 'pause', icon: 'coffee', title: 'Needed a pause', sub: 'More breaks were helpful' },
];

type Phase = 'intro' | 'play' | 'observe';
type PauseReason = 'user' | 'away' | 'idle';

export default function SessionScreen({ route, navigation }: RootProps<'Session'>) {
  const child = useChild(route.params.childId);
  const role = useStore((s) => s.role) ?? 'therapist';
  const recordSession = useStore((s) => s.recordSession);
  const addNote = useStore((s) => s.addNote);
  const allSessions = useStore((s) => s.sessions);
  const baseline = route.params.mode === 'baseline';

  // Planned once when the session opens; the engine orders activities weakest area first.
  const queue = useMemo(() => (child ? planSession(child, allSessions, baseline ? 'baseline' : 'practice') : []), [child?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);
  const paused = pauseReason !== null;
  const setPaused = (p: boolean) => setPauseReason(p ? 'user' : null);
  const [disengaged, setDisengaged] = useState(0);
  const idleMs = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [states, setStates] = useState<Record<TaskId, TaskState> | null>(child?.tasks ?? null);
  const [blocks, setBlocks] = useState<BlockResult[]>([]);
  const [rewards, setRewards] = useState(0);
  const [correctInBlock, setCorrectInBlock] = useState(0);
  const [observation, setObservation] = useState<Observation>('stayed');
  const [note, setNote] = useState('');
  const blockKey = useRef(0);

  useTicker(paused || phase !== 'play', (dt) => {
    setElapsedMs((e) => e + dt);
    // The breathing check-in is meant to be hands-off, so it never counts as idle.
    if (queue[index] === 'feelings') return;
    idleMs.current += dt;
    if (idleMs.current >= IDLE_MS) {
      idleMs.current = 0;
      setDisengaged((d) => d + 1);
      setPauseReason('idle');
    }
  }, 1000);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'play') setPaused(true);
      return phase !== 'observe';
    });
    return () => sub.remove();
  }, [phase]);

  // Leaving the app mid-activity pauses it and counts as attention drifting.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && phase === 'play' && !paused) {
        setDisengaged((d) => d + 1);
        setPauseReason('away');
      }
    });
    return () => sub.remove();
  }, [phase, paused]);

  if (!child || !states) return null;
  const budgetMs = baseline ? Infinity : child.currentMinutes * 60_000;
  const taskId = queue[index];
  const task = taskId ? TASKS[taskId] : undefined;
  const params = taskId ? states[taskId].params : undefined;
  const Game = taskId ? GAMES[taskId] : undefined;
  const first = child.name.split(' ')[0];

  const onCorrect = () => {
    const next = correctInBlock + 1;
    setCorrectInBlock(next);
    if (params && next % params.reinforceEvery === 0) {
      setRewards((r) => r + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const finishBlock = (res: GameResult, completed: boolean) => {
    if (!taskId || !task) return;
    const state = states[taskId];
    const a = (baseline ? placeFromBaseline : adapt)(task, state, { ...res, completed });
    const nextStates = { ...states, [taskId]: a.next };
    const nextBlocks = [
      ...blocks,
      {
        taskId,
        params: state.params,
        metrics: { ...res, completed },
        accuracy: a.accuracy,
        changes: a.changes,
        summary: a.summary,
        levelBefore: taskLevel(task, state.params),
        levelAfter: taskLevel(task, a.next.params),
      },
    ];
    setStates(nextStates);
    setBlocks(nextBlocks);
    setCorrectInBlock(0);
    setPaused(false);
    idleMs.current = 0;
    blockKey.current++;
    const outOfTime = elapsedMs >= budgetMs;
    if (index + 1 >= queue.length || outOfTime) setPhase('observe');
    else {
      setIndex(index + 1);
      setPhase('intro');
    }
  };

  const skip = () =>
    finishBlock(
      { trials: 0, hits: 0, misses: 0, falseTaps: 0, correctRejections: 0, meanRtMs: null, earlyAccuracy: 0, lateAccuracy: 0, activeSec: 0 },
      false,
    );

  const endSession = () => {
    setPaused(false);
    if (blocks.length === 0) navigation.goBack();
    else setPhase('observe');
  };

  const save = () => {
    const id = uid();
    const changed: Partial<Record<TaskId, TaskState>> = {};
    for (const b of blocks) changed[b.taskId] = states[b.taskId];
    const accs = blocks.map((b) => b.accuracy).filter((a): a is number => a !== null);
    const accuracy = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
    const lengthChange = baseline
      ? null
      : adaptMinutes(child, { accuracy, completedAll: blocks.every((b) => b.metrics.completed), observation, disengaged });
    recordSession(
      {
        id,
        childId: child.id,
        startedAt: new Date(Date.now() - elapsedMs).toISOString(),
        activeSec: Math.round(elapsedMs / 1000),
        by: role,
        blocks,
        observation,
        note: note.trim() || undefined,
        rewards,
        kind: baseline ? 'baseline' : 'practice',
        disengaged,
        lengthChange: lengthChange ?? undefined,
      },
      changed,
      baseline ? { baselineAt: new Date().toISOString() } : lengthChange ? { currentMinutes: lengthChange.to } : undefined,
    );
    // Parent observations go to the shared notes so the therapist sees them.
    if (role === 'parent' && note.trim()) addNote(child.id, 'parent', note);
    navigation.replace('Summary', { sessionId: id, fresh: true });
  };

  const left = baseline ? elapsedMs : Math.max(0, budgetMs - elapsedMs);
  const mmss = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
  const reward = REWARD_ICON[child.rewardTheme];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.turn}>{first}’s turn</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {phase === 'observe' ? 'All done' : `${task?.name} · Level ${task && params ? taskLevel(task, params) : 1}`}
          </Text>
        </View>
        <View style={styles.rewardPill}>
          <MaterialCommunityIcons name={reward.icon} size={18} color={reward.color} />
          <Text style={styles.rewardText}>{rewards}</Text>
        </View>
        {phase !== 'observe' && (
          <Pressable onPress={() => setPaused(true)} hitSlop={10} accessibilityLabel="Pause">
            <Feather name="pause" size={28} color={colors.ink} />
          </Pressable>
        )}
      </View>

      <View style={styles.meta}>
        <T.Eyebrow style={{ marginBottom: 0 }}>
          {phase === 'observe' ? 'All rounds complete' : `${baseline ? 'Starting check · ' : ''}Activity ${index + 1} of ${queue.length}`}
        </T.Eyebrow>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.time}>{mmss}</Text>
          <Text style={styles.timeLabel}>{baseline ? 'ELAPSED' : 'TIME LEFT'}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <ProgressBar value={phase === 'observe' ? 1 : index / Math.max(1, queue.length)} height={6} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }}>
        {queue.length === 0 && (
          <Card>
            <T.H3>No activities in this plan yet</T.H3>
            <T.Body style={{ marginTop: 6, marginBottom: 16 }}>Turn on at least one activity in the activity plan.</T.Body>
            <Button label="Go back" onPress={() => navigation.goBack()} />
          </Card>
        )}

        {phase === 'intro' && task && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              {blocks.length > 0 && (
                <View style={styles.cheer}>
                  <MaterialCommunityIcons name={reward.icon} size={22} color={reward.color} />
                  <Text style={styles.cheerText}>Nice work! Next one…</Text>
                </View>
              )}
              <TaskIcon icon={task.icon} tint={task.tint} size={88} />
              <T.H1 style={{ marginTop: 18, textAlign: 'center' }}>{task.name}</T.H1>
              <T.Body style={{ marginTop: 6, textAlign: 'center', fontSize: 17 }}>{task.tagline}</T.Body>
              {baseline && blocks.length === 0 && (
                <T.Small style={{ marginTop: 12, textAlign: 'center' }}>
                  Starting check: one short round of each activity so Bloom Focus can find the right level. Just do your best!
                </T.Small>
              )}
              <Button label="I’m ready" icon="play" onPress={() => setPhase('play')} style={{ alignSelf: 'stretch', marginTop: 28 }} />
            </Card>
          </View>
        )}

        {phase === 'play' && Game && params && (
          <View style={{ flex: 1 }} onTouchStart={() => (idleMs.current = 0)}>
            <Game
              key={blockKey.current}
              params={params}
              paused={paused}
              onCorrect={onCorrect}
              onDone={(r) => finishBlock(r, true)}
            />
            <RewardBurst theme={child.rewardTheme} count={rewards} />
          </View>
        )}

        {phase === 'observe' && (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={styles.obsIcon}>
              <Feather name="message-circle" size={26} color={colors.forest} />
            </View>
            <T.Eyebrow style={{ marginTop: 14 }}>{role === 'parent' ? 'Parent-observed' : 'Therapist-observed'}</T.Eyebrow>
            <T.H1 style={{ fontSize: 26 }}>How did the practice feel?</T.H1>
            <T.Body style={{ marginTop: 6, marginBottom: 14 }}>
              Choose a simple observation. This is your view, not a sensor reading.
            </T.Body>
            {OBSERVATIONS.map((o) => (
              <Card
                key={o.id}
                selected={observation === o.id}
                onPress={() => setObservation(o.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10, paddingVertical: 14 }}
              >
                <Feather name={o.icon} size={22} color={colors.ink} />
                <View style={{ flex: 1 }}>
                  <T.H3>{o.title}</T.H3>
                  <T.Small>{o.sub}</T.Small>
                </View>
                {observation === o.id && <Feather name="check-circle" size={22} color={colors.forest} />}
              </Card>
            ))}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={role === 'parent' ? 'Anything the therapist should know? (optional)' : 'Session note (optional)'}
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
              multiline
            />
            <Button label="Save session summary" icon="check" onPress={save} style={{ marginTop: 12 }} />
          </Card>
          </ScrollView>
        )}
      </View>

      <Text style={styles.footer}>A practice activity, not a test. Pausing is always okay.</Text>

      {paused && (
        <View style={styles.overlay}>
          <Card style={{ width: '100%', padding: 24 }}>
            <T.H1 style={{ fontSize: 26 }}>
              {pauseReason === 'idle' ? 'Still with us?' : pauseReason === 'away' ? 'Welcome back!' : 'Taking a little break'}
            </T.H1>
            <T.Body style={{ marginTop: 6, marginBottom: 20 }}>
              {pauseReason === 'idle'
                ? 'It’s been quiet for a bit, so we paused. Ready when you are.'
                : pauseReason === 'away'
                  ? 'The app paused while you were away.'
                  : 'Pausing is always okay. The timer is stopped.'}
            </T.Body>
            <Button label="Keep going" icon="play" onPress={() => setPaused(false)} />
            <Button label="Skip this activity" icon="skip-forward" variant="soft" onPress={skip} style={{ marginTop: 10 }} />
            <Pressable onLongPress={endSession} delayLongPress={1200} style={styles.hold}>
              <Feather name="lock" size={16} color={colors.inkSoft} />
              <Text style={styles.holdText}>Grown-ups: press and hold to end</Text>
            </Pressable>
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 12 },
  turn: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 34,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rewardText: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 18, marginBottom: 10 },
  time: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
  timeLabel: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.5, color: colors.inkSoft },
  cheer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.mint, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 20 },
  cheerText: { fontFamily: font.semibold, fontSize: 15, color: colors.forest },
  obsIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  footer: { textAlign: 'center', fontFamily: font.regular, fontSize: 13, color: colors.inkMuted, paddingBottom: 8 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30,58,47,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  hold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, paddingVertical: 8 },
  holdText: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft },
});
