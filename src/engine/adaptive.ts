/**
 * The adaptive attention engine: Assess → Train → Adapt → Measure → Progress.
 *
 * Each task keeps its own vector of difficulty dimensions. After every block the
 * engine looks at *how* the child performed (not just the score) and moves the one
 * dimension that best explains it, so a child who tires late gets a shorter block
 * while their speed and distractor level stay where they are.
 */
import type { BlockMetrics, Change, Dim, Params, TaskState } from '../types';
import { DIM_LABEL, DIM_STEPS, TaskDef, dimLabel, formatDim } from './tasks';

export const STEP_UP_ACCURACY = 0.85;
export const STEP_DOWN_ACCURACY = 0.65;
/** Consecutive strong blocks needed before stepping up, so one lucky block doesn't jump levels. */
export const STEP_UP_STREAK = 2;

export function blockAccuracy(m: BlockMetrics): number | null {
  if (m.trials === 0) return null;
  return (m.hits + m.correctRejections) / m.trials;
}

function stepIndex(dim: Dim | 'reinforceEvery', value: number): number {
  const steps = DIM_STEPS[dim];
  let best = 0;
  for (let i = 0; i < steps.length; i++) if (steps[i] <= value) best = i;
  return best;
}

function position(dim: Dim, value: number): number {
  return stepIndex(dim, value) / (DIM_STEPS[dim].length - 1);
}

function move(dim: Dim | 'reinforceEvery', value: number, delta: number): number {
  const steps = DIM_STEPS[dim];
  const i = Math.max(0, Math.min(steps.length - 1, stepIndex(dim, value) + delta));
  return steps[i];
}

/** 1–10 practice level derived from how far along each of the task's dimensions the child is. */
export function taskLevel(task: TaskDef, params: Params): number {
  if (task.dims.length === 0) return 1;
  const avg = task.dims.reduce((s, d) => s + position(d, params[d]), 0) / task.dims.length;
  return 1 + Math.round(avg * 9);
}

export type AdaptResult = {
  next: TaskState;
  changes: Change[];
  accuracy: number | null;
  summary: string;
};

export function adapt(task: TaskDef, state: TaskState, m: BlockMetrics): AdaptResult {
  const accuracy = blockAccuracy(m);
  const params: Params = { ...state.params };
  const changes: Change[] = [];
  const free = task.dims.filter((d) => !state.locked.includes(d));

  const change = (dim: Dim | 'reinforceEvery', delta: number, reason: string) => {
    const from = params[dim];
    const to = move(dim, from, delta);
    if (to === from) return false;
    params[dim] = to;
    changes.push({ dim, from, to, reason });
    return true;
  };

  if (!task.scored || (accuracy === null && m.completed)) {
    return {
      next: state,
      changes,
      accuracy,
      summary: task.scored ? 'Too few responses to adjust. Settings kept the same.' : 'Unscored check-in.',
    };
  }

  let streak = state.streak;
  let summary: string;
  // Only an early-ended block can reach here without an accuracy.
  const score = accuracy ?? 0;

  if (!m.completed) {
    streak = 0;
    const shortened =
      free.includes('durationSec') &&
      change('durationSec', -1, 'The block ended early, so the next one will be a little shorter.');
    change('reinforceEvery', -1, 'More frequent rewards to help the child stay with it.');
    summary = shortened
      ? 'Ended early. Next time the activity is shorter, with rewards more often.'
      : 'Ended early. Rewards will come more often next time.';
  } else if (score >= STEP_UP_ACCURACY) {
    streak += 1;
    if (streak >= STEP_UP_STREAK) {
      streak = 0;
      // Grow the dimension the child is furthest behind on, so demand stays balanced.
      const candidates = free
        .filter((d) => stepIndex(d, params[d]) < DIM_STEPS[d].length - 1)
        .sort((a, b) => position(a, params[a]) - position(b, params[b]));
      const pick = candidates[0];
      if (pick) {
        change(pick, +1, `${pct(score)} accuracy on two blocks in a row.`);
        change('reinforceEvery', +1, 'Doing well, so rewards come a little less often.');
        summary = `Ready for a stretch: ${DIM_LABEL[pick].toLowerCase()} steps up.`;
      } else {
        summary = 'At the top of every unlocked setting. Keep practising or unlock a setting.';
      }
    } else {
      summary = `Strong block (${pct(score)}). One more like this moves the challenge up.`;
    }
  } else if (score < STEP_DOWN_ACCURACY) {
    streak = 0;
    summary = stepDown(m, free, params, change, score);
    change('reinforceEvery', -1, 'Rewards come more often while the task feels hard.');
  } else {
    streak = 0;
    summary = `Right in the growth zone (${pct(score)}). Everything stays the same.`;
  }

  return { next: { ...state, params, streak }, changes, accuracy, summary };
}

/** Work out which dimension explains the struggle, and ease only that one. */
function stepDown(
  m: BlockMetrics,
  free: Dim[],
  params: Params,
  change: (dim: Dim, delta: number, reason: string) => boolean,
  accuracy: number,
): string {
  const has = (d: Dim) => free.includes(d);
  const fatigue = m.earlyAccuracy - m.lateAccuracy >= 0.2;
  const impulsive = m.falseTaps >= 2 && m.falseTaps > m.misses;
  const missing = m.misses >= 2 && m.misses >= m.falseTaps;

  if (m.frustrationDetected) {
    let eased = false;
    for (const d of ['speed', 'distractors', 'durationSec', 'memoryLoad', 'instructionSteps'] as Dim[]) {
      if (has(d) && change(d, -1, 'Child showed signs of frustration (rapid tapping).')) eased = true;
    }
    if (eased) return 'Frustration detected. Dialing back all available settings to ease the pressure.';
    return 'Frustration detected, but settings are already at minimum.';
  }

  if (fatigue && has('durationSec')) {
    const a = pct(m.earlyAccuracy);
    const b = pct(m.lateAccuracy);
    if (change('durationSec', -1, `Accuracy dropped from ${a} to ${b} in the second half.`))
      return 'Strong start, tired finish. The block gets shorter; everything else stays.';
  }
  if (impulsive) {
    const why = `${m.falseTaps} taps came before or without a target, or went to the wrong choice.`;
    if (has('speed') && change('speed', -1, why))
      return 'Quick taps got ahead of the task. Things will appear more slowly.';
    // Already at the slowest pace: fewer lures (or, in Switch Sort, fewer rule switches) instead.
    if (has('distractors') && change('distractors', -1, why))
      return 'Wrong taps outnumbered misses. Fewer lures and switches next time.';
  }
  if (missing && has('distractors')) {
    if (change('distractors', -1, `${m.misses} targets were missed among the distractions.`))
      return 'Targets got lost in the busy screen. Fewer distractions next time.';
  }
  for (const d of ['memoryLoad', 'instructionSteps'] as Dim[]) {
    if (has(d) && change(d, -1, `${pct(accuracy)} accuracy at this load.`))
      return d === 'memoryLoad' ? 'One fewer item to remember next time.' : 'One fewer step next time.';
  }
  for (const d of ['speed', 'distractors', 'durationSec'] as Dim[]) {
    if (has(d) && change(d, -1, `${pct(accuracy)} accuracy.`))
      return `This felt hard. ${DIM_LABEL[d]} eases off next time.`;
  }
  return 'This felt hard, and every setting is already at its easiest or locked.';
}

export function describeChange(c: Change, task?: TaskDef): string {
  const dir = DIM_STEPS[c.dim].indexOf(c.to) > DIM_STEPS[c.dim].indexOf(c.from) ? '↑' : '↓';
  const label = task ? dimLabel(task, c.dim) : DIM_LABEL[c.dim];
  return `${label} ${dir} ${formatDim(c.dim, c.from)} → ${formatDim(c.dim, c.to)}`;
}

/**
 * Starting check: one probe block per activity places the child, moving further than a
 * normal session would (up to two steps) so practice starts near the right level.
 */
export function placeFromBaseline(task: TaskDef, state: TaskState, m: BlockMetrics): AdaptResult {
  const accuracy = blockAccuracy(m);
  if (!task.scored || accuracy === null || !m.completed) {
    return { next: state, changes: [], accuracy, summary: 'Not enough to place yet. Starting from the easiest settings.' };
  }
  const params: Params = { ...state.params };
  const changes: Change[] = [];
  const free = task.dims.filter((d) => !state.locked.includes(d));
  const change = (dim: Dim, delta: number, reason: string) => {
    const from = params[dim];
    const to = move(dim, from, delta);
    if (to === from) return false;
    params[dim] = to;
    changes.push({ dim, from, to, reason });
    return true;
  };
  const steps = accuracy >= 0.9 ? 2 : accuracy >= 0.75 ? 1 : 0;
  let summary: string;
  if (steps > 0) {
    // Raise the least-advanced dimensions first, one step each.
    const order = [...free].sort((a, b) => position(a, params[a]) - position(b, params[b]));
    let moved = 0;
    for (const d of order) {
      if (moved >= steps) break;
      if (change(d, +1, `Starting check: ${pct(accuracy)} accuracy.`)) moved++;
    }
    summary = moved ? `Placed ${moved === 2 ? 'two steps' : 'one step'} up from the start.` : 'Already placed at the top.';
  } else if (accuracy < 0.5) {
    summary = `Starting check: ${stepDown(m, free, params, change, accuracy)}`;
  } else {
    summary = `Starting check: ${pct(accuracy)} — the starting settings fit well.`;
  }
  return { next: { ...state, params, streak: 0 }, changes, accuracy, summary };
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Split an ordered list of trial outcomes into first/second half accuracy. */
export function halves(outcomes: boolean[]): { earlyAccuracy: number; lateAccuracy: number } {
  if (outcomes.length === 0) return { earlyAccuracy: 0, lateAccuracy: 0 };
  const mid = Math.ceil(outcomes.length / 2);
  const acc = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 0);
  const early = acc(outcomes.slice(0, mid));
  const late = outcomes.length > 1 ? acc(outcomes.slice(mid)) : early;
  return { earlyAccuracy: early, lateAccuracy: late };
}
