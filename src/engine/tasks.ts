import { colors } from '../theme';
import type { Dim, Domain, Params, TaskId } from '../types';

export type TaskDef = {
  id: TaskId;
  name: string;
  tagline: string;
  description: string;
  domain: Domain;
  ages: [number, number];
  icon: string;
  tint: string;
  /** Dimensions this task responds to, in the order the engine prefers to grow them. */
  dims: Dim[];
  defaults: Partial<Params>;
  scored: boolean;
  /** What a generic dimension means in this task, when it differs from DIM_LABEL. */
  dimLabels?: Partial<Record<Dim, string>>;
};

export const dimLabel = (task: TaskDef, dim: Dim | 'reinforceEvery') =>
  (dim !== 'reinforceEvery' && task.dimLabels?.[dim]) || DIM_LABEL[dim];

export const DOMAIN_LABEL: Record<Domain, string> = {
  sustained: 'Sustained attention',
  selective: 'Visual attention',
  auditory: 'Auditory attention',
  workingMemory: 'Working memory',
  inhibition: 'Impulse control',
  instructions: 'Following instructions',
  flexibility: 'Cognitive flexibility',
  emotional: 'Emotional awareness',
};

export const SCORED_DOMAINS: Domain[] = [
  'sustained',
  'selective',
  'auditory',
  'workingMemory',
  'inhibition',
  'instructions',
  'flexibility',
];

export const DIM_LABEL: Record<Dim | 'reinforceEvery', string> = {
  durationSec: 'Duration',
  distractors: 'Distractions',
  speed: 'Presentation speed',
  memoryLoad: 'Memory load',
  instructionSteps: 'Instruction steps',
  reinforceEvery: 'Reward spacing',
};

/** The ladder each dimension moves along. One engine step = one index. */
export const DIM_STEPS: Record<Dim | 'reinforceEvery', number[]> = {
  durationSec: [20, 30, 45, 60, 90, 120, 150, 180],
  distractors: [0, 1, 2, 3, 4, 5],
  speed: [1, 2, 3, 4, 5],
  memoryLoad: [2, 3, 4, 5, 6, 7, 8],
  instructionSteps: [1, 2, 3],
  reinforceEvery: [1, 2, 3, 4, 5],
};

export function formatDim(dim: Dim | 'reinforceEvery', value: number): string {
  switch (dim) {
    case 'durationSec':
      return value >= 60 ? `${+(value / 60).toFixed(1)} min` : `${value} sec`;
    case 'distractors':
      return `${value}/5`;
    case 'speed':
      return `${value}/5`;
    case 'memoryLoad':
      return `${value} items`;
    case 'instructionSteps':
      return `${value}-step`;
    case 'reinforceEvery':
      return value === 1 ? 'every correct' : `every ${value} correct`;
  }
}

export const BASE_PARAMS: Params = {
  durationSec: 30,
  distractors: 0,
  speed: 1,
  memoryLoad: 2,
  instructionSteps: 1,
  reinforceEvery: 1,
};

export const TASKS: Record<TaskId, TaskDef> = {
  starWatch: {
    id: 'starWatch',
    name: 'Star Watch',
    tagline: 'Wait, watch, tap the star',
    description:
      'Shapes appear one at a time. Tap only when the star shows up. Later come look-alikes, drifting shapes, then background voices, some saying "star".',
    domain: 'sustained',
    ages: [4, 14],
    icon: 'star-four-points-outline',
    tint: colors.butter,
    dims: ['durationSec', 'distractors', 'speed'],
    defaults: { durationSec: 30 },
    scored: true,
  },
  findTarget: {
    id: 'findTarget',
    name: 'Pattern Garden',
    tagline: 'Find the one that matches',
    description:
      'Find the target shape hidden among others. More look-alikes appear, then the board moves, then voices name the wrong colours and shapes.',
    domain: 'selective',
    ages: [4, 12],
    icon: 'flower-outline',
    tint: colors.mint,
    dims: ['distractors', 'durationSec', 'speed'],
    defaults: { durationSec: 45 },
    scored: true,
  },
  listenFor: {
    id: 'listenFor',
    name: 'Listen for Apple',
    tagline: 'Tap when you hear it',
    description:
      'Words are spoken aloud. Tap only for the target word. Later, the other words sound more alike and pictures move around on screen.',
    domain: 'auditory',
    ages: [5, 12],
    icon: 'ear-hearing',
    tint: colors.sky,
    dims: ['durationSec', 'distractors', 'speed'],
    defaults: { durationSec: 30 },
    scored: true,
  },
  memoryEcho: {
    id: 'memoryEcho',
    name: 'Memory Echo',
    tagline: 'Look, remember, repeat',
    description:
      'A short number sequence is shown one digit at a time, then hidden while the child taps it back in order. Later, a short wait comes before answering.',
    domain: 'workingMemory',
    ages: [6, 14],
    icon: 'numeric',
    tint: colors.peach,
    dims: ['memoryLoad', 'speed', 'distractors'],
    dimLabels: { distractors: 'Recall delay' },
    defaults: { memoryLoad: 2 },
    scored: true,
  },
  goNoGo: {
    id: 'goNoGo',
    name: 'Pause Power',
    tagline: 'Green go, red stop',
    description:
      'Tap for green, hold back for red. Red appears more often, circles arrive faster, and later voices call "go!". No pressure to be fast.',
    domain: 'inhibition',
    ages: [5, 14],
    icon: 'hand-back-right-outline',
    tint: colors.butter,
    dims: ['distractors', 'durationSec', 'speed'],
    defaults: { durationSec: 30 },
    scored: true,
  },
  followSteps: {
    id: 'followSteps',
    name: 'Follow the Path',
    tagline: 'First this, then that',
    description:
      'Short instructions like "tap the red circle, then the star". Steps are added, the board gets busier, and later the instruction hides.',
    domain: 'instructions',
    ages: [5, 14],
    icon: 'map-marker-path',
    tint: colors.rose,
    dims: ['instructionSteps', 'distractors', 'speed'],
    defaults: { instructionSteps: 1 },
    scored: true,
  },
  switchSort: {
    id: 'switchSort',
    name: 'Switch Sort',
    tagline: 'Colour or shape? Watch the sign',
    description:
      'Sort each card by colour or by shape, whichever the sign says. The rule switches more often, and the sign gets subtler, as flexibility grows.',
    domain: 'flexibility',
    ages: [6, 14],
    icon: 'swap-horizontal-bold',
    tint: colors.sky,
    dims: ['distractors', 'speed', 'durationSec'],
    dimLabels: { distractors: 'Rule switching' },
    defaults: { durationSec: 45 },
    scored: true,
  },
  countName: {
    id: 'countName',
    name: 'Count or Name',
    tagline: 'How many, or which number?',
    description:
      'A few copies of one number appear, like 5 5 5. The sign says whether to count them (3) or name the number (5). The rule switches more often as flexibility grows.',
    domain: 'flexibility',
    ages: [6, 14],
    icon: 'counter',
    tint: colors.butter,
    dims: ['distractors', 'speed', 'durationSec'],
    dimLabels: { distractors: 'Rule switching' },
    defaults: { durationSec: 45 },
    scored: true,
  },
  puzzleMatch: {
    id: 'puzzleMatch',
    name: 'Puzzle Match',
    tagline: 'Match the piece by shape and color',
    description:
      'Study a target piece, then find the choice with the same shape and color among similar pieces. More choices appear as the therapist increases the matching challenge.',
    domain: 'selective',
    ages: [6, 14],
    icon: 'puzzle-outline',
    tint: colors.mint,
    dims: ['distractors', 'speed', 'durationSec'],
    defaults: { durationSec: 35 },
    scored: true,
  },
  blockBuilder: {
    id: 'blockBuilder',
    name: 'Block Builder',
    tagline: 'Build the pattern block by block',
    description:
      'A pattern flashes on a grid. Rebuild it from memory by tapping the correct blocks in order. This strengthens visual memory and spatial planning.',
    domain: 'workingMemory',
    ages: [6, 14],
    icon: 'cube-outline',
    tint: colors.peach,
    dims: ['memoryLoad', 'speed', 'distractors'],
    defaults: { memoryLoad: 3 },
    scored: true,
  },
  mazePath: {
    id: 'mazePath',
    name: 'Maze Path',
    tagline: 'Remember and trace the route',
    description:
      'Study a route of direction cues, then trace it from memory through a small maze. Therapist-set instruction difficulty changes the route pattern and maze walls.',
    domain: 'instructions',
    ages: [6, 14],
    icon: 'map-outline',
    tint: colors.rose,
    dims: ['instructionSteps', 'distractors', 'speed'],
    defaults: { instructionSteps: 1 },
    scored: true,
  },
  feelings: {
    id: 'feelings',
    name: 'Feelings Check-in',
    tagline: 'Name what is happening',
    description:
      'A private, no-wrong-answer check-in with a short breathing moment. Feelings are not scored or stored.',
    domain: 'emotional',
    ages: [4, 17],
    icon: 'heart-outline',
    tint: colors.rose,
    dims: [],
    defaults: {},
    scored: false,
  },
  dualTask: {
    id: 'dualTask',
    name: 'Multi-Modal Focus',
    tagline: 'Watch and listen at the same time',
    description:
      'An advanced task that trains divided attention. Track visual targets and auditory targets simultaneously.',
    domain: 'workingMemory', // Uses working memory + divided attention
    ages: [8, 17],
    icon: 'brain',
    tint: colors.peach,
    dims: ['distractors', 'speed', 'durationSec'],
    dimLabels: { distractors: 'Modalities' },
    defaults: { durationSec: 45 },
    scored: true,
  },
  flankerTask: {
    id: 'flankerTask',
    name: 'Flock Focus',
    tagline: 'Which way is the center bird flying?',
    description:
      'A flock appears. Tap the direction the center bird is pointing, tuning out the surrounding birds facing conflicting directions (inspired by Lumosity’s Lost in Migration).',
    domain: 'selective',
    ages: [5, 17],
    icon: 'feather',
    tint: colors.mint,
    dims: ['distractors', 'speed', 'durationSec'],
    dimLabels: { distractors: 'Flanker clutter' },
    defaults: { durationSec: 40 },
    scored: true,
  },
  memoryMatrix: {
    id: 'memoryMatrix',
    name: 'Spatial Grid',
    tagline: 'Remember the pattern, tap the tiles',
    description:
      'Glowing tiles illuminate on a grid and disappear. Tap the exact positions from memory as the board expands (inspired by Lumosity’s Memory Matrix & Peak’s Perilous Path).',
    domain: 'workingMemory',
    ages: [5, 17],
    icon: 'grid',
    tint: colors.peach,
    dims: ['memoryLoad', 'speed', 'distractors'],
    dimLabels: { memoryLoad: 'Target tiles', distractors: 'Recall delay' },
    defaults: { memoryLoad: 3 },
    scored: true,
  },
  speedMatch: {
    id: 'speedMatch',
    name: 'Flash Match',
    tagline: 'Does it match the one before?',
    description:
      'Cards appear rapidly. Decide on the spot if the current symbol matches the one shown immediately prior (1-back continuous test, inspired by Lumosity’s Speed Match & Peak’s Rush Back).',
    domain: 'sustained',
    ages: [6, 17],
    icon: 'flash-outline',
    tint: colors.butter,
    dims: ['speed', 'durationSec', 'distractors'],
    dimLabels: { speed: 'Card pace', distractors: 'Lure symbols' },
    defaults: { durationSec: 35, speed: 2 },
    scored: true,
  },
  colorClash: {
    id: 'colorClash',
    name: 'Color Clash',
    tagline: 'Match the ink, not the word',
    description:
      'Color words appear written in colored ink. Responding to the real color requires resisting the urge to read the word (Stroop interference task, inspired by Lumosity’s Color Match & Peak’s True Color).',
    domain: 'inhibition',
    ages: [6, 17],
    icon: 'palette-outline',
    tint: colors.rose,
    dims: ['distractors', 'speed', 'durationSec'],
    dimLabels: { distractors: 'Clash trickiness' },
    defaults: { durationSec: 40 },
    scored: true,
  },
};

export const TASK_ORDER: TaskId[] = [
  'feelings',
  'starWatch',
  'speedMatch',
  'findTarget',
  'flankerTask',
  'listenFor',
  'memoryEcho',
  'memoryMatrix',
  'goNoGo',
  'colorClash',
  'followSteps',
  'switchSort',
  'countName',
  'dualTask',
  'puzzleMatch',
  'blockBuilder',
  'mazePath',
];

/** Rough block length used to fit a session into the planned minutes. */
export function estimateBlockSec(taskId: TaskId, p: Params): number {
  switch (taskId) {
    case 'memoryEcho':
      return 30 + p.memoryLoad * 8;
    case 'memoryMatrix':
      return 30 + p.memoryLoad * 6;
    case 'followSteps':
      return 30 + p.instructionSteps * 15;
    case 'feelings':
      return 40;
    default:
      return p.durationSec + 10;
  }
}
