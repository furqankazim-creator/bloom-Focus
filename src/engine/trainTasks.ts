/**
 * The cognitive training games: metadata, per-game adaptation and scoring helpers.
 * Covers all core attention & cognitive neuroscience domains (including Lumosity & Peak paradigms).
 * Pure TypeScript (no React), so the demo generator, reports and tests can use it.
 */
import type { BlockMetrics, Dim, Params, TaskId, TaskState } from '../types';
import { AdaptResult, adapt } from './adaptive';
import { TASKS, TaskDef } from './tasks';

export type TrainTaskId =
  | 'starWatch'
  | 'speedMatch'
  | 'findTarget'
  | 'flankerTask'
  | 'memoryEcho'
  | 'memoryMatrix'
  | 'goNoGo'
  | 'colorClash'
  | 'switchSort'
  | 'listenFor'
  | 'followSteps'
  | 'dualTask'
  | 'puzzleMatch'
  | 'blockBuilder'
  | 'mazePath';

export const TRAIN_IDS: TrainTaskId[] = [
  'starWatch',
  'speedMatch',
  'findTarget',
  'flankerTask',
  'memoryEcho',
  'memoryMatrix',
  'goNoGo',
  'colorClash',
  'switchSort',
  'listenFor',
  'followSteps',
  'dualTask',
  'puzzleMatch',
  'blockBuilder',
  'mazePath',
];

export const isTrainTask = (id: TaskId): id is TrainTaskId => (TRAIN_IDS as TaskId[]).includes(id as TrainTaskId);

export type TrainInfo = {
  id: TrainTaskId;
  /** Skill name shown on the Train tab and the results card. */
  skill: string;
  category: 'attention' | 'memory' | 'speed' | 'inhibition' | 'flexibility';
  subtitle: string;
  /** Game name shown in the in-game header. */
  title: string;
  icon: string;
  color: string;
  tint: string;
  howTo: string[];
  /** The primary difficulty dimension this game grows as the child improves. */
  adapts: Dim;
  /** Offline practice idea shown to parents on the skill page. */
  tip: string;
};

export const TRAIN_INFO: TrainInfo[] = [
  {
    id: 'starWatch',
    skill: 'Sustained Attention',
    category: 'attention',
    subtitle: 'How long can you stay focused on the target?',
    title: 'Tap the Stars',
    icon: '🎯',
    color: '#1DB988',
    tint: '#E3F6EE',
    howTo: ['A star ⭐ pops up somewhere on the board.', 'Tap it before it fades away.', 'Stay alert until the timer runs out!'],
    adapts: 'durationSec',
    tip: 'Try “spot the red car” on a drive or walk: short, fun watching games build staying power.',
  },
  {
    id: 'speedMatch',
    skill: 'Processing Speed',
    category: 'speed',
    subtitle: 'Does this match the card before it? (Lumosity style)',
    title: 'Flash Match',
    icon: '⚡',
    color: '#F59E0B',
    tint: '#FEF3C7',
    howTo: [
      'A symbol appears on the card.',
      'Tap MATCH if it is the same as the card before it.',
      'Tap DIFFERENT if it changed. Be as fast and accurate as you can!',
    ],
    adapts: 'speed',
    tip: 'Play quick visual matching games with playing cards or picture cards.',
  },
  {
    id: 'findTarget',
    skill: 'Visual Attention',
    category: 'attention',
    subtitle: 'Find the target hidden among distractions.',
    title: 'Find the Blue',
    icon: '👀',
    color: '#4A90E2',
    tint: '#E6F0FB',
    howTo: ['Find the 🔵 blue circle on the board.', 'Tap it as fast as you can.', 'Watch out: other blue shapes and circles try to trick you!'],
    adapts: 'distractors',
    tip: 'Play “I spy” or hide-and-find picture books. Start with an easy page and make it busier over time.',
  },
  {
    id: 'flankerTask',
    skill: 'Flanker Attention',
    category: 'attention',
    subtitle: 'Focus on the center bird, tune out the flock.',
    title: 'Flock Focus',
    icon: '🦅',
    color: '#10B981',
    tint: '#E6F8F0',
    howTo: [
      'A flock of birds appears on screen.',
      'Look ONLY at the center bird and tap the direction it faces.',
      'Ignore the surrounding flock facing conflicting ways!',
    ],
    adapts: 'distractors',
    tip: 'Practice finding a specific person or object in a crowded photo or bustling playground.',
  },
  {
    id: 'memoryEcho',
    skill: 'Working Memory',
    category: 'memory',
    subtitle: 'Remember the sequence in order.',
    title: 'Memory Sequence',
    icon: '🧠',
    color: '#8E5CF7',
    tint: '#F0EAFE',
    howTo: ['Watch the numbers flash one by one.', 'When they disappear, tap them back in the same order.', 'Get two right in a row and the sequence grows!'],
    adapts: 'memoryLoad',
    tip: 'Give 2-step instructions at home, like “shoes on, then bag”, and add a third step when it’s easy.',
  },
  {
    id: 'memoryMatrix',
    skill: 'Spatial Memory',
    category: 'memory',
    subtitle: 'Remember the glowing pattern on the grid.',
    title: 'Spatial Grid',
    icon: '🧊',
    color: '#8B5CF6',
    tint: '#F3E8FF',
    howTo: [
      'Tiles flash bright green on the grid.',
      'When they turn blank, tap the exact positions you saw.',
      'The grid and pattern expand as your spatial memory grows!',
    ],
    adapts: 'memoryLoad',
    tip: 'Play memory grid games using coins or buttons placed on a checkerboard.',
  },
  {
    id: 'goNoGo',
    skill: 'Impulse Control',
    category: 'inhibition',
    subtitle: 'Tap green. Hold back on red.',
    title: 'Go / No-Go',
    icon: '🛑',
    color: '#F5A623',
    tint: '#FEF3E2',
    howTo: ['A circle appears in the middle.', '🟢 Green: tap it as fast as you can.', '🔴 Red: hold back and don’t tap!'],
    adapts: 'speed',
    tip: 'Play “Red light, green light” or “Simon says”: waiting for the right signal is the same skill.',
  },
  {
    id: 'colorClash',
    skill: 'Cognitive Inhibition',
    category: 'inhibition',
    subtitle: 'Match the ink color, resist reading the word.',
    title: 'Color Clash',
    icon: '🎨',
    color: '#EC4899',
    tint: '#FCE7F3',
    howTo: [
      'A color word appears written in colored ink.',
      'Tap MATCH if the ink color matches the word name.',
      'Tap CLASH if they don’t match. Resist the automatic urge to read!',
    ],
    adapts: 'distractors',
    tip: 'Play the Stroop naming game by pointing at items and naming their color instead of what they are.',
  },
  {
    id: 'switchSort',
    skill: 'Cognitive Flexibility',
    category: 'flexibility',
    subtitle: 'Switch between sorting by color and shape.',
    title: 'Switch Sort',
    icon: '🔀',
    color: '#3B82F6',
    tint: '#EFF6FF',
    howTo: [
      'Sort cards into matching bins.',
      'Watch the banner: it switches between COLOR and SHAPE.',
      'Flex your brain to adapt immediately when the rule flips!',
    ],
    adapts: 'distractors',
    tip: 'Sort laundry by color, then suddenly switch and sort by owner or clothing type.',
  },
  {
    id: 'listenFor',
    skill: 'Auditory Attention',
    category: 'attention',
    subtitle: 'Listen closely and tap only for target words.',
    title: 'Listen for Apple',
    icon: '👂',
    color: '#06B6D4',
    tint: '#ECFEFF',
    howTo: [
      'Words are spoken aloud through the speaker.',
      'Tap the button only when you hear the word “apple”.',
      'Tune out look-alike sounds and background speech!',
    ],
    adapts: 'distractors',
    tip: 'Play listening games where your child claps every time a secret word appears in a bedtime story.',
  },
  {
    id: 'followSteps',
    skill: 'Following Instructions',
    category: 'memory',
    subtitle: 'Remember and follow multi-step directions.',
    title: 'Follow the Path',
    icon: '🧭',
    color: '#F97316',
    tint: '#FFF7ED',
    howTo: [
      'An instruction like "tap red circle, then blue square" appears.',
      'Follow the steps in exact sequence.',
      'Steps increase and the instruction hides to test working memory!',
    ],
    adapts: 'instructionSteps',
    tip: 'Give 3-step fun challenges at home, e.g. "touch the door, grab a pencil, then sit down".',
  },
  {
    id: 'dualTask',
    skill: 'Divided Attention',
    category: 'attention',
    subtitle: 'Balance visual watching and auditory listening.',
    title: 'Multi-Modal Focus',
    icon: '🎧',
    color: '#6366F1',
    tint: '#EEF2FF',
    howTo: [
      'Watch the visual shapes on screen while listening for spoken sound cues.',
      'Tap Shape Match or Sound Match when targets arrive.',
      'Strengthens divided attention across both senses!',
    ],
    adapts: 'speed',
    tip: 'Practice having a light conversation while sorting puzzle pieces or coloring.',
  },
  {
    id: 'puzzleMatch',
    skill: 'Puzzle Matching',
    category: 'attention',
    subtitle: 'Match a puzzle piece by shape and color.',
    title: 'Puzzle Match',
    icon: '🧩',
    color: '#2FBF71',
    tint: '#EAFBF2',
    howTo: ['Study the target piece.', 'Find the choice with the same shape and color.', 'More similar choices appear as the challenge grows.'],
    adapts: 'distractors',
    tip: 'Match pieces from a jigsaw or pop-together puzzle at home to build visual comparison skills.',
  },
  {
    id: 'blockBuilder',
    skill: 'Block Building',
    category: 'memory',
    subtitle: 'Copy the sequence and rebuild the pattern.',
    title: 'Block Builder',
    icon: '🧱',
    color: '#F59E0B',
    tint: '#FEF3C7',
    howTo: ['A pattern of blocks lights up briefly.', 'Tap them back in the same order.', 'The pattern grows as the memory challenge gets stronger.'],
    adapts: 'memoryLoad',
    tip: 'Build towers with blocks or cups and copy a simple pattern before adding more pieces.',
  },
  {
    id: 'mazePath',
    skill: 'Maze Path',
    category: 'flexibility',
    subtitle: 'Remember and trace a route through the maze.',
    title: 'Maze Path',
    icon: '🧭',
    color: '#8B5CF6',
    tint: '#F3E8FF',
    howTo: ['Study the arrows showing the route.', 'Remember the sequence while it is hidden.', 'Trace the route through the maze without hitting walls.'],
    adapts: 'instructionSteps',
    tip: 'Use a simple floor maze or tape path. Give directions like “left, then straight, then stop.”',
  },
];

export const TRAIN_BY_ID = Object.fromEntries(TRAIN_INFO.map((g) => [g.id, g])) as Record<TrainTaskId, TrainInfo>;

/** Longest sequence the working-memory game uses. */
export const MAX_SEQUENCE = 7;

/**
 * The task definition the adaptive engine sees for a Train game: only the game's own
 * dimension can move, so e.g. Tap-the-Star grows by getting longer, Find-the-Blue by adding distractors.
 */
export function trainTaskDef(id: TrainTaskId): TaskDef {
  return { ...TASKS[id], dims: [TRAIN_BY_ID[id]?.adapts ?? 'speed'] };
}

/** Runs the engine for one Train game, keeping memory games within bounds. */
export function adaptTrain(id: TrainTaskId, state: TaskState, m: BlockMetrics): AdaptResult {
  const a = adapt(trainTaskDef(id), state, m);
  if (id === 'memoryEcho' && a.next.params.memoryLoad > MAX_SEQUENCE) {
    a.next = { ...a.next, params: { ...a.next.params, memoryLoad: MAX_SEQUENCE } };
    a.changes = a.changes.filter((c) => c.dim !== 'memoryLoad' || c.to <= MAX_SEQUENCE);
  }
  if (id === 'memoryMatrix' && a.next.params.memoryLoad > MAX_SEQUENCE) {
    a.next = { ...a.next, params: { ...a.next.params, memoryLoad: MAX_SEQUENCE } };
    a.changes = a.changes.filter((c) => c.dim !== 'memoryLoad' || c.to <= MAX_SEQUENCE);
  }
  return a;
}

/** Play length. Memory rounds are trial-based, so its length follows the sequence size instead. */
export function gameDurationSec(id: TrainTaskId, p: Params): number {
  if (id === 'memoryEcho') return 30 + Math.min(MAX_SEQUENCE, p.memoryLoad) * 8;
  if (id === 'memoryMatrix') return 30 + Math.min(MAX_SEQUENCE, p.memoryLoad) * 6;
  if (id === 'followSteps') return 30 + p.instructionSteps * 15;
  return p.durationSec;
}

/** One-line summary of the current difficulty. */
export function describeParams(id: TrainTaskId, p: Params): string {
  const dur = `${gameDurationSec(id, p)}s`;
  switch (id) {
    case 'starWatch':
      return `${dur} session · speed ${p.speed}`;
    case 'speedMatch':
      return `${dur} · card pace ${p.speed}/5`;
    case 'findTarget':
      return `${dur} · ${Math.min(12, 4 + p.distractors * 2) - 1} distractors`;
    case 'flankerTask':
      return `${dur} · clutter ${p.distractors}/5`;
    case 'memoryEcho':
      return `${dur} · ${Math.min(MAX_SEQUENCE, p.memoryLoad)}-digit sequence`;
    case 'memoryMatrix':
      return `${dur} · ${p.memoryLoad} glowing tiles`;
    case 'goNoGo':
      return `${dur} · speed ${p.speed}/5`;
    case 'colorClash':
      return `${dur} · trickiness ${p.distractors}/5`;
    case 'switchSort':
      return `${dur} · rule switches ${p.distractors}/5`;
    case 'listenFor':
      return `${dur} · distractor words ${p.distractors}/5`;
    case 'followSteps':
      return `${dur} · ${p.instructionSteps}-step instruction`;
    case 'dualTask':
      return `${dur} · dual modality`;
    case 'puzzleMatch':
      return `${dur} · matching pieces ${p.distractors}/5`;
    case 'blockBuilder':
      return `${dur} · ${Math.min(MAX_SEQUENCE, p.memoryLoad)} block pattern`;
    case 'mazePath':
      return `${dur} · ${p.instructionSteps}-step route`;
    default:
      return `${dur} session`;
  }
}

const ADJUST_UP: Record<Dim, string> = {
  durationSec: 'longer session',
  distractors: 'added distractions',
  speed: 'faster pace',
  memoryLoad: 'longer sequence / more tiles',
  instructionSteps: 'more steps',
};
const ADJUST_DOWN: Record<Dim, string> = {
  durationSec: 'shorter session',
  distractors: 'fewer distractions',
  speed: 'slower pace',
  memoryLoad: 'shorter sequence / fewer tiles',
  instructionSteps: 'fewer steps',
};

/** Plain-language note such as "Adjusted: added distractions." */
export function adjustmentNote(changes: { dim: string; from: number; to: number }[]): string | null {
  const parts = changes
    .filter((c): c is { dim: Dim; from: number; to: number } => c.dim !== 'reinforceEvery')
    .map((c) => (c.to > c.from ? ADJUST_UP : ADJUST_DOWN)[c.dim]);
  return parts.length ? `Adjusted: ${parts.join(', ')}.` : null;
}

const OTHER_ICONS: Partial<Record<TaskId, string>> = {
  listenFor: '👂',
  followSteps: '🧭',
  switchSort: '🔀',
  countName: '🔢',
  dualTask: '🎧',
  feelings: '💗',
  flankerTask: '🦅',
  memoryMatrix: '🧊',
  speedMatch: '⚡',
  colorClash: '🎨',
  puzzleMatch: '🧩',
  blockBuilder: '🧱',
  mazePath: '🧭',
};

/** Name and emoji used for a task in history lists and session details. */
export function taskDisplay(id: TaskId): { title: string; icon: string; color: string } {
  if (isTrainTask(id)) {
    const g = TRAIN_BY_ID[id];
    if (g) return { title: g.skill, icon: g.icon, color: g.color };
  }
  return { title: TASKS[id]?.name ?? 'Activity', icon: OTHER_ICONS[id] ?? '🌱', color: '#2F5D46' };
}

/** 1–3 stars for a scored game (0 when nothing was scored). Shared by results, history and totals. */
export function starsFor(acc: number | null): number {
  if (acc === null) return 0;
  return acc >= 0.85 ? 3 : acc >= 0.65 ? 2 : 1;
}
