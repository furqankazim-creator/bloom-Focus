import type { BlockResult, Change, Session } from '../types';
import { MAX_SEQUENCE, TrainTaskId, gameDurationSec } from './trainTasks';

export type SkillPoint = {
  sessionId: string;
  at: string;
  accuracy: number;
  block: BlockResult;
  /** The value of this skill's own "extra" metric (see SKILL_METRIC). */
  metric: number | null;
};

/** The second chart on each skill page: the number that best shows progress in that skill. */
export const SKILL_METRIC: Record<TrainTaskId, { title: string; unit: string; lowerIsBetter: boolean; explain: string }> = {
  starWatch: { title: 'Game length', unit: 's', lowerIsBetter: false, explain: 'This skill grows by staying focused for longer.' },
  speedMatch: { title: 'Response time', unit: 'ms', lowerIsBetter: true, explain: 'Faster accurate responses show rapid visual processing.' },
  findTarget: { title: 'Time to find the target', unit: 's', lowerIsBetter: true, explain: 'Faster finding means sharper visual attention.' },
  flankerTask: { title: 'Flanker interference control', unit: 'pts', lowerIsBetter: false, explain: 'Correct decisions while ignoring conflicting birds.' },
  memoryEcho: { title: 'Sequence length', unit: 'digits', lowerIsBetter: false, explain: 'How many digits were held in mind at once.' },
  memoryMatrix: { title: 'Tiles remembered', unit: 'tiles', lowerIsBetter: false, explain: 'Visuospatial pattern capacity held in working memory.' },
  goNoGo: { title: 'Red taps per game', unit: 'taps', lowerIsBetter: true, explain: 'Fewer taps on red means better impulse control.' },
  colorClash: { title: 'Impulsive reading taps', unit: 'taps', lowerIsBetter: true, explain: 'Fewer reading mistakes shows stronger cognitive inhibition.' },
  switchSort: { title: 'Rule switch accuracy', unit: '%', lowerIsBetter: false, explain: 'Higher accuracy after rule changes reflects cognitive flexibility.' },
  listenFor: { title: 'Target speech hits', unit: 'hits', lowerIsBetter: false, explain: 'Identifying spoken words through sound clutter.' },
  followSteps: { title: 'Instruction steps', unit: 'steps', lowerIsBetter: false, explain: 'Multi-step instructions successfully recalled and executed.' },
  dualTask: { title: 'Divided attention accuracy', unit: '%', lowerIsBetter: false, explain: 'Managing visual and auditory demands at the same time.' },
  puzzleMatch: { title: 'Puzzle matches', unit: 'items', lowerIsBetter: false, explain: 'Fast visual matching across similar puzzle targets.' },
  blockBuilder: { title: 'Pattern length', unit: 'blocks', lowerIsBetter: false, explain: 'How many tiles could be recalled and rebuilt in order.' },
  mazePath: { title: 'Route accuracy', unit: '%', lowerIsBetter: false, explain: 'Correct route choices while following multi-step directions.' },
};

function metricFor(id: TrainTaskId, b: BlockResult): number | null {
  switch (id) {
    case 'starWatch':
      return gameDurationSec(id, b.params);
    case 'speedMatch':
      return b.metrics.meanRtMs;
    case 'findTarget':
      return b.metrics.meanRtMs === null ? null : Math.round(b.metrics.meanRtMs / 100) / 10;
    case 'flankerTask':
      return b.metrics.hits;
    case 'memoryEcho':
      return Math.min(MAX_SEQUENCE, b.params.memoryLoad);
    case 'memoryMatrix':
      return Math.min(MAX_SEQUENCE, b.params.memoryLoad);
    case 'goNoGo':
      return b.metrics.falseTaps;
    case 'colorClash':
      return b.metrics.falseTaps;
    case 'switchSort':
      return b.accuracy !== null ? Math.round(b.accuracy * 100) : null;
    case 'listenFor':
      return b.metrics.hits;
    case 'followSteps':
      return b.params.instructionSteps;
    case 'dualTask':
      return b.accuracy !== null ? Math.round(b.accuracy * 100) : null;
    case 'puzzleMatch':
      return b.metrics.hits;
    case 'blockBuilder':
      return Math.min(MAX_SEQUENCE, b.params.memoryLoad);
    case 'mazePath':
      return b.accuracy !== null ? Math.round(b.accuracy * 100) : null;
    default:
      return b.metrics.hits;
  }
}

/** Every scored game of one skill, oldest first. */
export function skillHistory(sessions: Session[], id: TrainTaskId): SkillPoint[] {
  const out: SkillPoint[] = [];
  for (const s of sessions) {
    for (const b of s.blocks) {
      if (b.taskId !== id || b.accuracy === null) continue;
      out.push({ sessionId: s.id, at: s.startedAt, accuracy: b.accuracy, block: b, metric: metricFor(id, b) });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function skillSummary(points: SkillPoint[]) {
  const accs = points.map((p) => p.accuracy);
  const last5 = accs.slice(-5);
  const changes: { at: string; sessionId: string; change: Change; reason: string }[] = [];
  for (const p of points) {
    for (const c of p.block.changes) {
      if (c.dim !== 'reinforceEvery') changes.push({ at: p.at, sessionId: p.sessionId, change: c, reason: c.reason });
    }
  }
  return {
    played: points.length,
    best: accs.length ? Math.max(...accs) : null,
    avg5: last5.length ? last5.reduce((a, b) => a + b, 0) / last5.length : null,
    totalSec: points.reduce((n, p) => n + p.block.metrics.activeSec, 0),
    changes: changes.reverse(),
  };
}
