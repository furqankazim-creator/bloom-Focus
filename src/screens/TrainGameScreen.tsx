import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ProgressBar } from '../components/ui';
import { blockAccuracy, taskLevel } from '../engine/adaptive';
import { BASE_PARAMS } from '../engine/tasks';
import { GameResult, useTicker } from '../games/common';
import { BlockResultCard } from '../components/BlockResultCard';
import { GameEnvContext } from '../games/train/shared';
import { heroFor } from '../engine/personalize';
import { SUPPORT_LEVELS, resultCard } from '../services/noteCards';
import { postToConversation } from '../services/messaging';
import { TRAIN_GAME, adaptTrain, gameDurationSec, starsFor, trainTaskDef } from '../games/train/meta';
import type { RootProps } from '../navigation/types';
import { uid } from '../store/seed';
import { useChild, useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { BlockResult } from '../types';
import { firstName } from './helpers';

type Phase = 'intro' | 'countdown' | 'play' | 'result';

export const headline = (stars: number) => ['Good try!', 'Nice effort!', 'Great job!', 'Amazing!'][stars];
export const cheerEmoji = (stars: number) => ['💪', '💪', '🌟', '🎉'][stars];

export default function TrainGameScreen({ route, navigation }: RootProps<'TrainGame'>) {
  const { childId, taskId, customId } = route.params;
  const child = useChild(childId);
  const role = useStore((s) => s.role) ?? 'parent';
  const calmMode = useStore((s) => s.calmMode);
  const custom = customId ? child?.customActivities?.find((a) => a.id === customId) : undefined;
  // A fixed custom activity always plays at the therapist's settings; adaptive ones grow with the child.
  const fixed = !!custom && !custom.adaptive;
  const hero = heroFor(child, custom?.hero);
  const [shared, setShared] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const recordSession = useStore((s) => s.recordSession);
  const meta = TRAIN_GAME[taskId];
  const task = trainTaskDef(taskId);

  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ block: BlockResult; stars: number } | null>(null);
  const startedAt = useRef(Date.now());
  const lastSession = useRef<string | null>(null);

  // Params are captured when a round starts so a mid-game store update can't change the difficulty.
  const paramsNow = () => (fixed && custom ? custom.params : child?.tasks?.[taskId]?.params ?? BASE_PARAMS);
  const [params, setParams] = useState(paramsNow);
  const durationSec = params ? gameDurationSec(taskId, params) : 30;

  useTicker(paused || phase !== 'play', (dt) => setElapsedMs((e) => e + dt), 200);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      const t = setTimeout(() => setPhase('play'), 550);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'play') {
        setPaused(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && phase === 'play') setPaused(true);
    });
    return () => sub.remove();
  }, [phase]);

  if (!child || !params || !meta) return null;
  const first = firstName(child.name);

  const start = () => {
    setParams(paramsNow());
    setShared('idle');
    setElapsedMs(0);
    setCount(3);
    setPaused(false);
    setResult(null);
    setRound((n) => n + 1);
    startedAt.current = Date.now();
    setPhase('countdown');
  };

  const finish = (res: GameResult) => {
    const saved = child.tasks[taskId] ?? { enabled: true, params: BASE_PARAMS, locked: [], streak: 0 };
    const state = fixed ? { ...saved, params } : saved;
    const metrics = { ...res, completed: true };
    const a = adaptTrain(taskId, state, metrics);
    const block: BlockResult = {
      taskId,
      params: state.params,
      metrics,
      accuracy: a.accuracy,
      // Fixed activities don't move the difficulty, so report no changes.
      changes: fixed ? [] : a.changes,
      summary: a.summary,
      levelBefore: taskLevel(task, state.params),
      levelAfter: fixed ? taskLevel(task, state.params) : taskLevel(task, a.next.params),
    };
    const stars = starsFor(blockAccuracy(metrics));
    const sessionId = uid();
    recordSession(
      {
        id: sessionId,
        childId: child.id,
        startedAt: new Date(startedAt.current).toISOString(),
        activeSec: res.activeSec,
        by: role,
        blocks: [block],
        observation: 'stayed',
        rewards: stars,
        kind: 'practice',
      },
      fixed ? {} : { [taskId]: a.next },
    );
    lastSession.current = sessionId;
    setResult({ block, stars });
    setPhase('result');
  };

  const quit = () => navigation.goBack();
  const left = Math.max(0, Math.ceil(durationSec - elapsedMs / 1000));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {phase !== 'result' && (
        <>
          <View style={styles.header}>
            <Pressable
              onPress={() => (phase === 'play' ? setPaused(true) : quit())}
              style={styles.close}
              hitSlop={8}
              accessibilityLabel={phase === 'play' ? 'Pause' : 'Close'}
            >
              <Feather name="x" size={20} color={colors.inkSoft} />
            </Pressable>
            <Text style={styles.headerIcon}>{custom?.hero?.emoji ?? meta.icon}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {custom?.name ?? meta.title}
            </Text>
            <Text style={styles.timer}>{phase === 'play' ? `${left}s` : `${durationSec}s`}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <ProgressBar value={phase === 'play' ? Math.min(1, elapsedMs / (durationSec * 1000)) : 0} color={meta.color} height={5} />
          </View>
        </>
      )}

      {phase === 'intro' && (
        <View style={styles.center}>
          <View style={[styles.introIcon, { backgroundColor: meta.tint }]}>
            <Text style={{ fontSize: 52, lineHeight: 64 }}>{meta.icon}</Text>
            {!!hero && (
              <View style={styles.heroBadge}>
                <Text style={{ fontSize: 26, lineHeight: 32 }}>{hero.emoji}</Text>
              </View>
            )}
          </View>
          <Text style={styles.introSkill}>{custom ? 'FROM YOUR THERAPIST' : meta.skill.toUpperCase()}</Text>
          <Text style={styles.introTitle}>{custom?.name ?? meta.title}</Text>
          {!!hero && (
            <Text style={styles.heroLine}>
              {hero.emoji} {hero.name} is playing with {first} today!
            </Text>
          )}
          {!!custom?.instructions && (
            <View style={[styles.howCard, styles.therapistCard]}>
              <Text style={styles.therapistLabel}>
                Therapist’s note{custom.supportLevel ? ` · ${SUPPORT_LEVELS.find((l) => l.value === custom.supportLevel)?.emoji} ${SUPPORT_LEVELS.find((l) => l.value === custom.supportLevel)?.label}` : ''}
              </Text>
              <Text style={styles.howText}>{custom.instructions}</Text>
            </View>
          )}
          <View style={styles.howCard}>
            {meta.howTo.map((raw, i) => {
              // Tap the Stars uses the hero as its target, so the how-to should say so.
              const line = hero && taskId === 'starWatch' ? raw.replace(/a star ⭐/i, `${hero.name} ${hero.emoji}`) : raw;
              return (
                <View key={i} style={styles.howRow}>
                  <View style={[styles.howNum, { backgroundColor: meta.tint }]}>
                    <Text style={[styles.howNumText, { color: meta.color }]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.howText}>{line}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.introMeta}>
            Level {taskLevel(task, params)} · {durationSec} seconds
          </Text>
          <Pressable onPress={start} style={[styles.startBtn, { backgroundColor: meta.color }]} accessibilityRole="button">
            <Feather name="play" size={20} color={colors.white} />
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        </View>
      )}

      {phase === 'countdown' && (
        <View style={styles.center}>
          <Text style={styles.countLabel}>Get ready, {first}!{hero ? ` ${hero.emoji}` : ''}</Text>
          <Text key={count} style={[styles.count, { color: meta.color }]}>
            {count === 0 ? 'Go!' : count}
          </Text>
        </View>
      )}

      {phase === 'play' && (
        <View style={styles.gameWrap}>
          <GameEnvContext.Provider value={{ calm: calmMode, young: child.age <= 6, onFrustrated: () => {}, hero }}>
            <meta.Game
              key={round}
              params={params}
              durationSec={durationSec}
              paused={paused}
              onCorrect={() => {}}
              onDone={finish}
            />
          </GameEnvContext.Provider>
        </View>
      )}

      {phase === 'result' && result && (
        <Results
          name={first}
          color={meta.color}
          block={result.block}
          stars={result.stars}
          hero={hero}
          shareState={role === 'parent' ? shared : undefined}
          onShare={async () => {
            const session = useStore.getState().sessions.find((x) => x.id === lastSession.current);
            if (!session) return;
            setShared('sending');
            try {
              await postToConversation(child.id, role, { text: '', card: resultCard(session, result.block, result.stars, custom ? { title: custom.name, heroEmoji: custom.hero?.emoji } : undefined) });
              setShared('sent');
            } catch {
              setShared('error');
            }
          }}
          onProgress={() => navigation.navigate('Tabs', { screen: 'Progress' })}
          onAgain={start}
          onBack={quit}
        />
      )}

      {paused && phase === 'play' && (
        <View style={styles.overlay}>
          <View style={styles.pauseCard}>
            <Text style={{ fontSize: 40, lineHeight: 50 }}>⏸️</Text>
            <Text style={styles.pauseTitle}>Paused</Text>
            <Text style={styles.pauseSub}>Take a breath. The timer is stopped.</Text>
            <Button label="Keep playing" icon="play" onPress={() => setPaused(false)} style={{ alignSelf: 'stretch', marginTop: 18 }} />
            <Button label="Quit game" icon="x" variant="soft" onPress={quit} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Results({
  name,
  color,
  block,
  stars,
  hero,
  shareState,
  onShare,
  onProgress,
  onAgain,
  onBack,
}: {
  name: string;
  color: string;
  block: BlockResult;
  stars: number;
  hero: { name: string; emoji: string } | null;
  /** Parents only: state of "Share with therapist". */
  shareState?: 'idle' | 'sending' | 'sent' | 'error';
  onShare: () => void;
  onProgress: () => void;
  onAgain: () => void;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 56, lineHeight: 68 }}>{hero ? hero.emoji : cheerEmoji(stars)}</Text>
      <Text style={styles.resEyebrow}>Session complete</Text>
      <Text style={styles.resTitle}>{headline(stars)}</Text>
      <View style={styles.starsRow}>
        {[0, 1, 2].map((i) => (
          <Text key={i} style={[styles.star, i >= stars && { opacity: 0.2 }]}>
            ⭐
          </Text>
        ))}
      </View>
      <Text style={styles.resSub}>
        {hero ? `${hero.name} says: ` : ''}
        {name} earned {stars} star{stars === 1 ? '' : 's'}
      </Text>

      <View style={{ alignSelf: 'stretch', marginTop: 28 }}>
        <BlockResultCard block={block} />
      </View>

      <Pressable onPress={onAgain} style={[styles.primary, { backgroundColor: color }]} accessibilityRole="button">
        <Feather name="rotate-ccw" size={18} color={colors.white} />
        <Text style={styles.primaryText}>Play again</Text>
      </Pressable>
      {shareState && (
        <Pressable
          onPress={onShare}
          disabled={shareState === 'sending' || shareState === 'sent'}
          style={[styles.primary, styles.share, shareState === 'sent' && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Feather name={shareState === 'sent' ? 'check' : 'send'} size={18} color={colors.forest} />
          <Text style={[styles.primaryText, { color: colors.forest }]}>
            {shareState === 'sent' ? 'Shared with therapist' : shareState === 'sending' ? 'Sharing…' : shareState === 'error' ? 'Try sharing again' : 'Share with therapist'}
          </Text>
        </Pressable>
      )}
      <Pressable onPress={onProgress} style={[styles.primary, { backgroundColor: colors.forest, marginTop: 10 }]} accessibilityRole="button">
        <Text style={styles.primaryText}>See progress</Text>
        <Feather name="arrow-right" size={18} color={colors.white} />
      </Pressable>
      <Pressable onPress={onBack} style={{ paddingVertical: 14 }} accessibilityRole="button">
        <Text style={styles.backText}>Back to training</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBFAF7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEECE6', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 18, lineHeight: 24 },
  title: { flex: 1, fontFamily: font.heavy, fontSize: 17, color: colors.ink },
  timer: { fontFamily: font.semibold, fontSize: 14, color: colors.inkMuted, minWidth: 32, textAlign: 'right' },
  gameWrap: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  introIcon: { width: 104, height: 104, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroBadge: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLine: { marginTop: 8, fontFamily: font.semibold, fontSize: 15, color: colors.forest },
  therapistCard: { backgroundColor: colors.mint, borderColor: colors.mint, gap: 6, marginTop: 14 },
  therapistLabel: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8, color: colors.forest },
  share: { marginTop: 10, backgroundColor: colors.mint },
  introSkill: { marginTop: 18, fontFamily: font.bold, fontSize: 12, letterSpacing: 1.6, color: colors.inkMuted },
  introTitle: { marginTop: 4, fontFamily: font.heavy, fontSize: 28, color: colors.ink },
  howCard: {
    alignSelf: 'stretch',
    marginTop: 22,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  howNumText: { fontFamily: font.heavy, fontSize: 14 },
  howText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.ink, lineHeight: 21 },
  introMeta: { marginTop: 16, fontFamily: font.medium, fontSize: 13, color: colors.inkMuted },
  startBtn: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startText: { fontFamily: font.bold, fontSize: 18, color: colors.white },
  countLabel: { fontFamily: font.semibold, fontSize: 18, color: colors.inkSoft },
  count: { fontFamily: font.heavy, fontSize: 96, lineHeight: 116, marginTop: 8 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30,58,47,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pauseCard: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: 24, padding: 24, alignItems: 'center' },
  pauseTitle: { fontFamily: font.heavy, fontSize: 24, color: colors.ink, marginTop: 6 },
  pauseSub: { fontFamily: font.regular, fontSize: 15, color: colors.inkSoft, marginTop: 4, textAlign: 'center' },
  results: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 36, paddingBottom: 24 },
  resEyebrow: { marginTop: 10, fontFamily: font.medium, fontSize: 14, color: colors.inkSoft },
  resTitle: { fontFamily: font.heavy, fontSize: 28, color: colors.ink, marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  star: { fontSize: 30, lineHeight: 38 },
  resSub: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 6 },
  primary: {
    alignSelf: 'stretch',
    marginTop: 20,
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: font.bold, fontSize: 16, color: colors.white },
  backText: { fontFamily: font.semibold, fontSize: 15, color: colors.inkSoft },
});
