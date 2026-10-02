/**
 * Realistic demo history for the four Train games, so every chart, skill page and report
 * has something to show. Deterministic per child, so it looks the same on every render.
 */
import type { BlockMetrics, BlockResult, Child, Session, TaskState } from '../types';
import { blockAccuracy, halves, taskLevel } from './adaptive';
import { BASE_PARAMS, TASKS } from './tasks';
import { TRAIN_IDS, TrainTaskId, adaptTrain, gameDurationSec, starsFor, trainTaskDef } from './trainTasks';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Builds one game's metrics the way that game's own tally would count them. */
function simulateGame(id: TrainTaskId, rand: () => number, p: number, durationSec: number): BlockMetrics {
  const outcomes: boolean[] = [];
  let hits = 0;
  let misses = 0;
  let falseTaps = 0;
  let cr = 0;
  const rts: number[] = [];
  const rt = (lo: number, hi: number) => rts.push(Math.round(lo + rand() * (hi - lo)));
  // Late trials are a little harder: a mild fatigue effect for the early/late split.
  const pAt = (i: number, n: number) => (i > n / 2 && rand() < 0.15 ? p - 0.12 : p);

  if (id === 'starWatch') {
    const n = Math.round(durationSec / 1.4);
    for (let i = 0; i < n; i++) {
      const ok = rand() < pAt(i, n);
      outcomes.push(ok);
      if (ok) {
        hits++;
        rt(480, 900);
      } else misses++;
    }
    const f = Math.floor(rand() * (1 - p) * 8);
    for (let i = 0; i < f; i++) {
      falseTaps++;
      outcomes.splice(Math.floor(rand() * outcomes.length), 0, false);
    }
  } else if (id === 'findTarget') {
    const n = Math.round(durationSec / 2.6);
    for (let i = 0; i < n; i++) {
      if (rand() < pAt(i, n)) {
        hits++;
        outcomes.push(true);
        rt(1100, 2600);
      } else if (rand() < 0.5) {
        misses++;
        outcomes.push(false);
      } else {
        falseTaps++;
        outcomes.push(false);
        hits++;
        outcomes.push(true);
        rt(2200, 3600);
      }
    }
  } else if (id === 'memoryEcho') {
    const n = Math.round(durationSec / 7);
    for (let i = 0; i < n; i++) {
      const ok = rand() < pAt(i, n);
      outcomes.push(ok);
      if (ok) {
        hits++;
        rt(1800, 4200);
      } else misses++;
    }
    if (rand() < 0.3) {
      falseTaps++;
      outcomes.push(false);
    }
  } else {
    const n = Math.round(durationSec / 1.3);
    for (let i = 0; i < n; i++) {
      const go = rand() > 0.3;
      const ok = rand() < pAt(i, n);
      outcomes.push(ok);
      if (go) {
        if (ok) {
          hits++;
          rt(380, 720);
        } else misses++;
      } else if (ok) cr++;
      else falseTaps++;
    }
  }

  return {
    trials: outcomes.length,
    hits,
    misses,
    falseTaps,
    correctRejections: cr,
    meanRtMs: rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null,
    ...halves(outcomes),
    activeSec: durationSec,
    completed: true,
  };
}

/**
 * About two weeks of home practice ending today: most days 1–3 games, a few rest days,
 * skill improving over time. Returns the sessions (newest last) and the resulting task states.
 */
export function generateTrainHistory(
  child: Pick<Child, 'id' | 'age' | 'tasks'>,
  now = new Date(),
  days = 14,
): { sessions: Session[]; tasks: Record<TrainTaskId, TaskState> } {
  const seed = hashString(child.id);
  const rand = rng(seed);
  const tasks = {} as Record<TrainTaskId, TaskState>;
  for (const id of TRAIN_IDS) {
    tasks[id] = child.tasks?.[id]
      ? { ...child.tasks[id], params: { ...child.tasks[id].params } }
      : { enabled: true, params: { ...BASE_PARAMS, ...TASKS[id].defaults }, locked: [], streak: 0 };
  }
  // Each child has their own strengths.
  const ability: Record<TrainTaskId, number> = {
    starWatch: 0.55 + rand() * 0.35,
    speedMatch: 0.58 + rand() * 0.35,
    findTarget: 0.6 + rand() * 0.35,
    flankerTask: 0.62 + rand() * 0.35,
    memoryEcho: 0.45 + rand() * 0.35,
    memoryMatrix: 0.5 + rand() * 0.35,
    goNoGo: 0.5 + rand() * 0.35,
    colorClash: 0.52 + rand() * 0.35,
    switchSort: 0.48 + rand() * 0.35,
    listenFor: 0.6 + rand() * 0.35,
    followSteps: 0.55 + rand() * 0.35,
    dualTask: 0.45 + rand() * 0.35,
    puzzleMatch: 0.58 + rand() * 0.32,
    blockBuilder: 0.5 + rand() * 0.3,
    mazePath: 0.53 + rand() * 0.34,
  };

  const sessions: Session[] = [];
  let rot = Math.floor(rand() * TRAIN_IDS.length);
  for (let d = days - 1; d >= 0; d--) {
    // Rest days now and then, but always the last three days so the streak shows.
    if (d > 2 && rand() < 0.25) continue;
    const games = d === 0 ? 2 : 1 + Math.floor(rand() * 3);
    for (let g = 0; g < games; g++) {
      const id = TRAIN_IDS[rot++ % TRAIN_IDS.length];
      const state = tasks[id];
      const def = trainTaskDef(id);
      const levelBefore = taskLevel(def, state.params);
      const learning = (days - d) / days; // 0 → 1 across the fortnight
      const p = clamp(0.5 + ability[id] * 0.35 + learning * 0.12 - ((levelBefore - 1) / 9) * 0.3 + (rand() - 0.5) * 0.14, 0.3, 0.98);
      const durationSec = gameDurationSec(id, state.params);
      const m = simulateGame(id, rand, p, durationSec);
      const a = adaptTrain(id, state, m);
      tasks[id] = a.next;
      const block: BlockResult = {
        taskId: id,
        params: state.params,
        metrics: m,
        accuracy: blockAccuracy(m),
        changes: a.changes,
        summary: a.summary,
        levelBefore,
        levelAfter: taskLevel(def, a.next.params),
      };
      const at = new Date(now);
      at.setDate(at.getDate() - d);
      at.setHours(d === 0 ? Math.max(7, Math.min(now.getHours(), 16 + g)) : 16 + g, 10 + g * 7 + Math.floor(rand() * 5), 0, 0);
      if (at > now) at.setTime(now.getTime() - (games - g) * 600_000);
      sessions.push({
        id: `demo-${child.id}-${d}-${g}`,
        childId: child.id,
        startedAt: at.toISOString(),
        activeSec: m.activeSec,
        by: 'parent',
        blocks: [block],
        observation: 'stayed',
        rewards: starsFor(block.accuracy),
        kind: 'practice',
      });
    }
  }
  return { sessions, tasks };
}
