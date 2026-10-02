import type { Session } from '../types';
import { startOfWeek } from './profile';
import { TRAIN_IDS, TRAIN_BY_ID, TrainTaskId, starsFor } from './trainTasks';

export type SkillWeek = { id: TrainTaskId; acc: number | null; prevAcc: number | null; games: number };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** This week (Monday to now) against last week, for the parent's weekly report. */
export function weeklySummary(sessions: Session[], now = new Date()) {
  const start = startOfWeek(now).getTime();
  const prevStart = start - 7 * 86_400_000;
  const inRange = (s: Session, a: number, b: number) => {
    const t = new Date(s.startedAt).getTime();
    return t >= a && t < b;
  };
  const week = sessions.filter((s) => inRange(s, start, now.getTime() + 1));
  const prev = sessions.filter((s) => inRange(s, prevStart, start));

  const blocksOf = (ss: Session[], id: TrainTaskId) =>
    ss.flatMap((s) => s.blocks.filter((b) => b.taskId === id && b.accuracy !== null).map((b) => ({ s, b })));

  const skills: SkillWeek[] = TRAIN_IDS.map((id) => ({
    id,
    games: blocksOf(week, id).length,
    acc: mean(blocksOf(week, id).map(({ b }) => b.accuracy as number)),
    prevAcc: mean(blocksOf(prev, id).map(({ b }) => b.accuracy as number)),
  }));

  const levelUps = week.flatMap((s) =>
    s.blocks.filter((b) => b.levelAfter > b.levelBefore).map((b) => ({ taskId: b.taskId, from: b.levelBefore, to: b.levelAfter })),
  );

  let best: { session: Session; acc: number } | null = null;
  for (const s of week) {
    for (const b of s.blocks) {
      if (b.accuracy !== null && (!best || b.accuracy > best.acc)) best = { session: s, acc: b.accuracy };
    }
  }

  const played = skills.filter((x) => x.acc !== null);
  const strongest = played.length ? played.reduce((a, b) => ((a.acc ?? 0) >= (b.acc ?? 0) ? a : b)) : null;
  const weakest = played.length > 1 ? played.reduce((a, b) => ((a.acc ?? 1) <= (b.acc ?? 1) ? a : b)) : null;
  const notPlayed = skills.filter((x) => x.games === 0).map((x) => x.id);

  let sentence = 'No games yet this week. A few short games are all it takes.';
  if (strongest) {
    sentence = `Strongest this week: ${TRAIN_BY_ID[strongest.id].skill} (${Math.round((strongest.acc ?? 0) * 100)}%).`;
    if (weakest && weakest.id !== strongest.id) sentence += ` More practice will help ${TRAIN_BY_ID[weakest.id].skill}.`;
    if (notPlayed.length) sentence += ` Not tried yet: ${notPlayed.map((id) => TRAIN_BY_ID[id].skill).join(', ')}.`;
  }

  return {
    sessions: week.length,
    prevSessions: prev.length,
    minutes: Math.round(week.reduce((n, s) => n + s.activeSec, 0) / 60),
    stars: week.reduce((n, s) => n + starsFor(mean(s.blocks.filter((b) => b.accuracy !== null).map((b) => b.accuracy as number))), 0),
    skills,
    levelUps,
    best,
    sentence,
  };
}

export type WeeklySummary = ReturnType<typeof weeklySummary>;
