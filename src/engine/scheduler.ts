/**
 * Session-level adaptation: which activities, in what order, and for how long.
 */
import type { Child, Observation, Session, TaskId } from '../types';
import { attentionProfile, childSessions } from './profile';
import { TASKS, TASK_ORDER, estimateBlockSec } from './tasks';

export const MIN_MINUTES = 5;
const MAX_BLOCKS = 10;

/**
 * Practice: the check-in first, then activities ordered weakest area first, cycling
 * until the adaptive time budget is used, so the weakest area gets the most turns.
 * Starting check: every enabled scored activity exactly once.
 */
export function planSession(child: Child, sessions: Session[], mode: 'practice' | 'baseline'): TaskId[] {
  const enabled = TASK_ORDER.filter((id) => child.tasks[id]?.enabled);
  const scored = enabled.filter((id) => TASKS[id].scored);
  if (mode === 'baseline') return scored;

  const profile = attentionProfile(childSessions(sessions, child.id));
  const score = (id: TaskId) => profile.find((p) => p.domain === TASKS[id].domain)?.score ?? -1; // unpractised first
  const ordered = [...scored].sort((a, b) => score(a) - score(b));

  const queue: TaskId[] = enabled.includes('feelings') ? ['feelings'] : [];
  if (ordered.length === 0) return queue;
  const budget = child.currentMinutes * 60;
  let est = queue.length * 40;
  for (let i = 0; queue.length < MAX_BLOCKS; i++) {
    const id = ordered[i % ordered.length];
    const e = estimateBlockSec(id, child.tasks[id].params);
    // Every enabled activity gets at least one turn; after that, stop at the time budget.
    if (i >= ordered.length && est + e > budget) break;
    queue.push(id);
    est += e;
  }
  return queue;
}

/**
 * Adaptive session length (brief §9): grow a minute at a time while the child stays engaged
 * and accurate; drop back a minute when performance or engagement slips. Never above the
 * therapist's maximum.
 */
export function adaptMinutes(
  child: Child,
  s: { accuracy: number | null; completedAll: boolean; observation: Observation; disengaged: number },
): { from: number; to: number; reason: string } | null {
  const from = child.currentMinutes;
  const cap = child.sessionMinutes;
  let to = from;
  let reason = '';
  if (!s.completedAll || s.observation === 'pause' || s.disengaged >= 2 || (s.accuracy !== null && s.accuracy < 0.6)) {
    to = Math.max(MIN_MINUTES, from - 1);
    reason = !s.completedAll
      ? 'Some activities ended early.'
      : s.observation === 'pause'
        ? 'The child needed more breaks.'
        : s.disengaged >= 2
          ? `Attention drifted ${s.disengaged} times.`
          : 'Accuracy dropped below 60%.';
  } else if (s.accuracy !== null && s.accuracy >= 0.8 && s.observation === 'stayed' && s.disengaged === 0) {
    to = Math.min(cap, from + 1);
    reason = 'Engaged and accurate all the way through.';
  }
  if (to > cap) {
    to = cap;
    reason = 'Kept within the therapist’s maximum.';
  }
  return to === from ? null : { from, to, reason };
}
