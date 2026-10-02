import { taskLevel } from '../engine/adaptive';
import { startOfWeek } from '../engine/profile';
import { TEMPLATE } from '../engine/studio';
import { BASE_PARAMS } from '../engine/tasks';
import { TRAIN_BY_ID, TRAIN_IDS, gameDurationSec, trainTaskDef, type TrainTaskId } from '../engine/trainTasks';
import { weeklySummary } from '../engine/weekly';
import type { BlockResult, Child, NoteCard, Session, StudioTemplate } from '../types';

export const isTrainId = (id: string): id is TrainTaskId => (TRAIN_IDS as string[]).includes(id);

/** Display labels + order for the scaffolding / support level on activities and routines. */
export const SUPPORT_LEVELS = [
  { value: 'independent' as const, label: 'Independent', emoji: '🌱', hint: 'Child tries on their own' },
  { value: 'prompt' as const, label: 'Gentle prompts', emoji: '💬', hint: 'Verbal or visual cues' },
  { value: 'hands-on' as const, label: 'Hands-on help', emoji: '🤝', hint: 'Sit together and guide' },
] as const;

export type SupportLevel = (typeof SUPPORT_LEVELS)[number]['value'];

export const TIME_OF_DAY = ['Morning', 'After school', 'Before dinner', 'Bedtime', 'Weekend'] as const;

/** Name, emoji and colours for a game id, with a safe fallback for unknown ids. */
export function gameInfo(taskId: string) {
  const g = isTrainId(taskId) ? TRAIN_BY_ID[taskId] : undefined;
  return {
    title: g?.title ?? 'Activity',
    skill: g?.skill ?? 'Practice',
    icon: g?.icon ?? '🌱',
    color: g?.color ?? '#2F5D46',
    tint: g?.tint ?? '#E6ECE2',
    tip: g?.tip,
  };
}

export const FREQUENCIES = ['Today', '3× this week', 'Daily', 'When calm'] as const;

type ActivityExtras = {
  supportLevel?: SupportLevel;
  rewardTip?: string;
  therapistNote?: string;
};

/** Therapist assigns an activity at the child's current level, optionally with family support details. */
export function activityCard(
  child: Child,
  taskId: TrainTaskId,
  frequency?: string,
  extras: ActivityExtras = {},
): Extract<NoteCard, { type: 'activity' }> {
  const params = child.tasks[taskId]?.params ?? BASE_PARAMS;
  return {
    type: 'activity',
    taskId,
    level: taskLevel(trainTaskDef(taskId), params),
    minutes: Math.max(1, Math.round(gameDurationSec(taskId, params) / 60)),
    ...(frequency ? { frequency } : {}),
    ...(extras.supportLevel ? { supportLevel: extras.supportLevel } : {}),
    ...(extras.rewardTip?.trim() ? { rewardTip: extras.rewardTip.trim().slice(0, 80) } : {}),
    ...(extras.therapistNote?.trim() ? { therapistNote: extras.therapistNote.trim().slice(0, 200) } : {}),
  };
}

/** Therapist assigns a structured daily routine the family can check off together. */
export function routineCard(
  title: string,
  steps: string[],
  extras: { timeOfDay?: (typeof TIME_OF_DAY)[number] | string; supportLevel?: SupportLevel; therapistNote?: string } = {},
): NoteCard {
  const clean = steps.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 8);
  return {
    type: 'routine',
    title: title.trim().slice(0, 60) || 'Routine',
    steps: clean.length ? clean : ['Complete the routine'],
    ...(extras.timeOfDay ? { timeOfDay: extras.timeOfDay } : {}),
    ...(extras.supportLevel ? { supportLevel: extras.supportLevel } : {}),
    ...(extras.therapistNote?.trim() ? { therapistNote: extras.therapistNote.trim().slice(0, 200) } : {}),
  };
}

export function resultCard(
  session: Session,
  block: BlockResult,
  stars: number,
  custom?: { title: string; heroEmoji?: string },
): NoteCard {
  return {
    type: 'result',
    taskId: block.taskId,
    sessionId: session.id,
    accuracy: block.accuracy,
    stars,
    levelBefore: block.levelBefore,
    levelAfter: block.levelAfter,
    activeSec: Math.round(session.activeSec),
    ...(custom ? { title: custom.title, ...(custom.heroEmoji ? { heroEmoji: custom.heroEmoji } : {}) } : {}),
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** This week against last week, frozen into a card so both sides see the same numbers. */
export function progressCard(child: Child, sessions: Session[], now = new Date()): NoteCard {
  const mine = sessions.filter((s) => s.childId === child.id);
  const w = weeklySummary(mine, now);
  const start = startOfWeek(now).getTime();
  const accuracies = (from: number, to: number) =>
    mine
      .filter((s) => {
        const t = Date.parse(s.startedAt);
        return t >= from && t < to;
      })
      .flatMap((s) => s.blocks.map((b) => b.accuracy).filter((a): a is number => a !== null));
  const played = w.skills.filter((s) => s.acc !== null);
  const strongest = played.length ? played.reduce((a, b) => ((a.acc ?? 0) >= (b.acc ?? 0) ? a : b)) : undefined;
  const weakest = played.length > 1 ? played.reduce((a, b) => ((a.acc ?? 1) <= (b.acc ?? 1) ? a : b)) : undefined;
  return {
    type: 'progress',
    weekOf: new Date(start).toISOString().slice(0, 10),
    sessions: w.sessions,
    goal: Math.max(1, child.homeSessionsPerWeek || 3),
    minutes: w.minutes,
    stars: w.stars,
    prevSessions: w.prevSessions,
    avgAccuracy: mean(accuracies(start, now.getTime() + 1)),
    prevAvgAccuracy: mean(accuracies(start - 7 * 86_400_000, start)),
    levelUps: w.levelUps.length,
    ...(strongest ? { strongest: { taskId: strongest.id, accuracy: strongest.acc ?? 0 } } : {}),
    ...(weakest && weakest.id !== strongest?.id ? { practiceMore: { taskId: weakest.id, accuracy: weakest.acc ?? 0 } } : {}),
  };
}

/** Did the child play this activity after it was assigned? Returns the best score if so. */
export function activityCompletion(sessions: Session[], childId: string, taskId: string, since: string) {
  const played = sessions.filter(
    (s) => s.childId === childId && s.startedAt > since && s.blocks.some((b) => b.taskId === taskId),
  );
  if (!played.length) return null;
  const scores = played.flatMap((s) => s.blocks.filter((b) => b.taskId === taskId && b.accuracy !== null).map((b) => b.accuracy as number));
  return { times: played.length, best: scores.length ? Math.max(...scores) : null };
}

export const pct = (x: number | null | undefined) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);

/** One line for chat lists, notifications and reports. */
export function cardSummary(card: NoteCard): string {
  switch (card.type) {
    case 'activity': {
      const g = gameInfo(card.taskId);
      return `Activity: ${card.title ?? g.title}${card.frequency ? ` · ${card.frequency}` : ''}`;
    }
    case 'result': {
      const g = gameInfo(card.taskId);
      return `Played ${card.title ?? g.title} · ${pct(card.accuracy)}${card.levelAfter > card.levelBefore ? ' · level up' : ''}`;
    }
    case 'progress':
      return `Weekly progress · ${card.sessions}/${card.goal} sessions`;
    case 'routine':
      return `Routine: ${card.title}${card.timeOfDay ? ` · ${card.timeOfDay}` : ''} · ${card.steps.length} steps`;
    case 'studio': {
      const t = TEMPLATE[card.template as StudioTemplate];
      return `Game Studio: ${card.title}${t ? ` · ${t.name}` : ''} · ${card.stars}/3 stars`;
    }
  }
}

type Reply = { label: string };

/** Context-aware one-tap replies for the latest message from the other person. */
export function quickReplies(card: NoteCard | undefined, tags: string[] | undefined, role: 'parent' | 'therapist'): Reply[] {
  if (role === 'parent') {
    if (card?.type === 'activity')
      return [{ label: 'We’ll try it today 👍' }, { label: 'Done! It went well 🎉' }, { label: 'Could you explain how?' }];
    if (card?.type === 'routine')
      return [
        { label: 'Completed all steps ✅' },
        { label: 'Needed a little support 💬' },
        { label: 'Skipped today — we’ll try again' },
      ];
    if (tags?.includes('question')) return [{ label: 'Yes 👍' }, { label: 'Not yet' }, { label: 'Can we talk at the next session?' }];
    return [];
  }
  if (card?.type === 'result') {
    return card.levelAfter > card.levelBefore
      ? [{ label: 'Level up — brilliant! 🎉' }, { label: 'Great focus, keep it short and fun' }, { label: 'Try it once more this week' }]
      : [{ label: 'Great effort! 👏' }, { label: 'Keep sessions short and positive' }, { label: 'Try it after a snack or a break' }];
  }
  if (card?.type === 'routine')
    return [
      { label: 'Well done on the routine! 🌟' },
      { label: 'Let’s aim for two steps tomorrow' },
      { label: 'I’ll simplify the steps for next time' },
    ];
  if (card?.type === 'progress') {
    return [{ label: 'Lovely progress this week 🌱' }, { label: 'Let’s keep the same plan' }, { label: 'I’ll adjust the plan for next week' }];
  }
  if (tags?.includes('question')) return [{ label: 'Yes, that’s fine 👍' }, { label: 'Keep it optional — no pressure' }, { label: 'Good question, let’s discuss next session' }];
  if (tags?.includes('challenge'))
    return [{ label: 'Thanks for telling me 💚' }, { label: 'Let’s make it shorter for now' }, { label: 'We’ll go over it next session' }];
  if (tags?.includes('win')) return [{ label: 'Wonderful! 🎉' }, { label: 'Please keep it up' }];
  return [];
}
