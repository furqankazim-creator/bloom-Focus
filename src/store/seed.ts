import { adapt, blockAccuracy, halves, taskLevel } from '../engine/adaptive';
import { generateTrainHistory } from '../engine/demo';
import { BASE_PARAMS, TASKS } from '../engine/tasks';
import { colors } from '../theme';
import type {
  BlockMetrics,
  BlockResult,
  Child,
  Domain,
  Note,
  Observation,
  Session,
  TaskId,
  TaskState,
} from '../types';

export const uid = () => Math.random().toString(36).slice(2, 10);

// No 0/O or 1/I, so codes read cleanly aloud and on paper.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeFamilyCode(taken: string[] = []): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!taken.includes(code)) return code;
  }
}

export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Tasks switched on for a new profile: always the check-in, the focus task and two broad tasks. */
export function makeTasks(age: number, focus: Domain): Record<TaskId, TaskState> {
  const focusTask = (Object.keys(TASKS) as TaskId[]).find((id) => TASKS[id].domain === focus);
  const on = new Set<TaskId>(['feelings', 'starWatch', 'findTarget']);
  if (focusTask) on.add(focusTask);
  const out = {} as Record<TaskId, TaskState>;
  for (const id of Object.keys(TASKS) as TaskId[]) {
    const t = TASKS[id];
    const params = { ...BASE_PARAMS, ...t.defaults };
    // Older children start one notch longer on timed tasks.
    if (age >= 10 && t.dims.includes('durationSec')) params.durationSec = Math.max(params.durationSec, 45);
    out[id] = {
      enabled: on.has(id) && age >= t.ages[0] - 1 && age <= t.ages[1] + 1,
      params,
      locked: [],
      streak: 0,
    };
  }
  return out;
}

// Deterministic pseudo-random so the demo looks the same on every install.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function simulateBlock(rand: () => number, ability: number, levelPos: number): BlockMetrics {
  const trials = 12;
  const p = Math.min(0.97, Math.max(0.35, 0.5 + ability * 0.45 - levelPos * 0.3 + (rand() - 0.5) * 0.12));
  const outcomes: boolean[] = [];
  let hits = 0, misses = 0, falseTaps = 0, cr = 0;
  for (let i = 0; i < trials; i++) {
    const tired = i >= trials / 2 && rand() < 0.1;
    const ok = rand() < (tired ? p - 0.15 : p);
    const isTarget = rand() < 0.65;
    outcomes.push(ok);
    if (isTarget) ok ? hits++ : misses++;
    else ok ? cr++ : falseTaps++;
  }
  return {
    trials,
    hits,
    misses,
    falseTaps,
    correctRejections: cr,
    meanRtMs: Math.round(650 + rand() * 500),
    ...halves(outcomes),
    activeSec: 0,
    completed: true,
  };
}

type SeedChild = {
  name: string;
  age: number;
  focus: Domain;
  color: string;
  ability: Partial<Record<Domain, number>>;
  sessions: number;
  theme: Child['rewardTheme'];
};

const SEED: SeedChild[] = [
  { name: 'Ali Ahmed', age: 8, focus: 'sustained', color: colors.peach, sessions: 9, theme: 'stars',
    ability: { sustained: 0.8, selective: 0.85, workingMemory: 0.6, auditory: 0.55, flexibility: 0.6 } },
  { name: 'Sarah Khan', age: 7, focus: 'workingMemory', color: colors.sky, sessions: 6, theme: 'animals',
    ability: { sustained: 0.6, selective: 0.75, workingMemory: 0.55 } },
  { name: 'Hassan Ali', age: 9, focus: 'emotional', color: colors.butter, sessions: 7, theme: 'vehicles',
    ability: { sustained: 0.85, selective: 0.8, inhibition: 0.7, flexibility: 0.75 } },
];

const SEED_CODES = ['AL8K2Q', 'SK7M4P', 'HA9R3T'];

export function buildSeed(now = new Date()) {
  const rand = rng(42);
  const children: Child[] = [];
  const sessions: Session[] = [];

  SEED.forEach((sc, ci) => {
    const created = new Date(now);
    created.setDate(created.getDate() - 75 + ci * 5);
    const child: Child = {
      id: `seed-${ci}`,
      name: sc.name,
      age: sc.age,
      focus: sc.focus,
      color: sc.color,
      createdAt: created.toISOString(),
      sessionMinutes: 15,
      currentMinutes: 9 + ci,
      baselineAt: created.toISOString(),
      familyCode: SEED_CODES[ci],
      rewardTheme: sc.theme,
      homeSessionsPerWeek: 3,
      homeNote: '',
      tasks: makeTasks(sc.age, sc.focus),
    };
    if (sc.focus === 'emotional') child.tasks.goNoGo.enabled = true;
    if (sc.ability.flexibility !== undefined) child.tasks.switchSort.enabled = true;
    // Demo children have been practising for a while, so start them part-way up each ladder.
    for (const t of Object.values(child.tasks)) {
      t.params = { ...t.params, durationSec: 60, distractors: 2, speed: 2, memoryLoad: 3, instructionSteps: 2, reinforceEvery: 2 };
    }
    const scored = (Object.keys(child.tasks) as TaskId[]).filter(
      (id) => child.tasks[id].enabled && TASKS[id].scored,
    );

    for (let si = 0; si < sc.sessions; si++) {
      const date = new Date(now);
      date.setDate(date.getDate() - Math.round(((sc.sessions - si) * 13) / sc.sessions));
      date.setHours(9 + ((si * 3 + ci) % 8), 15, 0, 0);
      const blocks: BlockResult[] = [];
      for (const id of scored) {
        const task = TASKS[id];
        const state = child.tasks[id];
        const before = taskLevel(task, state.params);
        const levelPos = (before - 1) / 9;
        const m = simulateBlock(rand, sc.ability[task.domain] ?? 0.65, levelPos);
        m.activeSec = state.params.durationSec;
        const r = adapt(task, state, m);
        child.tasks[id] = r.next;
        blocks.push({
          taskId: id,
          params: state.params,
          metrics: m,
          accuracy: blockAccuracy(m),
          changes: r.changes,
          summary: r.summary,
          levelBefore: before,
          levelAfter: taskLevel(task, r.next.params),
        });
      }
      const obs: Observation[] = ['stayed', 'stayed', 'reminders', 'stayed', 'pause'];
      sessions.push({
        id: uid(),
        childId: child.id,
        startedAt: date.toISOString(),
        activeSec: blocks.reduce((s, b) => s + b.metrics.activeSec, 0) + 60,
        by: si % 3 === 2 ? 'parent' : 'therapist',
        blocks,
        observation: obs[(si + ci) % obs.length],
        kind: 'practice',
        disengaged: obs[(si + ci) % obs.length] === 'pause' ? 2 : 0,
        rewards: blocks.reduce((s, b) => s + b.metrics.hits, 0),
      });
    }
    // Recent home practice on the four Train games, continuing from where the therapist sessions left off.
    const home = generateTrainHistory(child, now);
    Object.assign(child.tasks, home.tasks);
    sessions.push(...home.sessions);
    children.push(child);
  });

  children[0].homeNote =
    'Two short Star Watch rounds after school, before screen time. Stop while it still feels fun.';
  children[1].homeNote = 'Memory Echo on a calm afternoon. Say the numbers out loud together first.';

  const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const notes: Note[] = [
    { id: uid(), childId: 'seed-0', from: 'therapist', createdAt: ago(50), deliveredAt: ago(50), readAt: ago(49),
      text: 'Ali is doing well with longer Star Watch blocks. Keep home sessions short and positive.' },
    { id: uid(), childId: 'seed-0', from: 'parent', createdAt: ago(20), deliveredAt: ago(20), readAt: ago(19.5),
      text: 'He asked to play Star Watch again after dinner. Seemed tired in the second round.' },
    { id: uid(), childId: 'seed-1', from: 'parent', createdAt: ago(30), deliveredAt: ago(30),
      text: 'Sarah liked the animal rewards. Memory Echo was frustrating at 4 numbers.' },
  ];
  notes.push(...enrichDemo(children, sessions, now));

  return { children, sessions, notes };
}

/**
 * Sample learning profiles, a custom activity and a rich conversation (activity, result and
 * progress cards, check-in details, read ticks) so a demo shows every feature straight away.
 * Mutates the sample children and returns the extra notes. Safe to call on older saved data.
 */
export function enrichDemo(children: Child[], sessions: Session[], now = new Date()): Note[] {
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const ali = children.find((c) => c.id === 'seed-0');
  const sarah = children.find((c) => c.id === 'seed-1');
  const notes: Note[] = [];

  if (sarah && !sarah.favouriteCharacters?.length) {
    Object.assign(sarah, {
      cognitiveAge: 6,
      diagnosis: ['Speech & language'],
      communicationStyle: 'mixed',
      sensory: { loudSounds: true },
      interests: ['Animals', 'Drawing'],
      favouriteCharacters: [{ name: 'Kitty', emoji: '🐱' }, { name: 'Unicorn', emoji: '🦄' }],
    } satisfies Partial<Child>);
  }

  if (!ali || ali.customActivities?.length) return notes;
  Object.assign(ali, {
    diagnosis: ['ADHD'],
    communicationStyle: 'verbal',
    interests: ['Dinosaurs', 'Football', 'Lego'],
    favouriteCharacters: [{ name: 'Dino', emoji: '🦖' }, { name: 'Football', emoji: '⚽' }],
    customActivities: [
      {
        id: 'demo-dino-hunt',
        taskId: 'starWatch',
        name: 'Dino Star Hunt',
        hero: { name: 'Dino', emoji: '🦖' },
        instructions: 'Two rounds after school, before screen time. Stop while it still feels fun.',
        supportLevel: 'prompt',
        timesPerWeek: 3,
        adaptive: true,
        params: ali.tasks.starWatch?.params ?? BASE_PARAMS,
        createdAt: ago(26),
      },
    ],
  } satisfies Partial<Child>);

  const level = taskLevel(TASKS.starWatch, ali.tasks.starWatch?.params ?? BASE_PARAMS);
  notes.push({
    id: uid(), childId: 'seed-0', from: 'therapist', createdAt: ago(18), deliveredAt: ago(18), readAt: ago(17),
    text: 'Let’s turn Star Watch into a dino hunt — Ali loves dinosaurs, so Dino is the hero now.',
    card: {
      type: 'activity', taskId: 'starWatch', level, minutes: 1, frequency: '3× a week', supportLevel: 'prompt',
      customId: 'demo-dino-hunt', title: 'Dino Star Hunt', heroEmoji: '🦖',
      therapistNote: 'Sit with him for the first round, then let him lead.',
    },
  });

  // Share the latest scored Tap the Stars game as a result card.
  const played = sessions
    .filter((s) => s.childId === 'seed-0' && s.blocks.some((b) => b.taskId === 'starWatch' && b.accuracy !== null))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const block = played?.blocks.find((b) => b.taskId === 'starWatch' && b.accuracy !== null);
  if (played && block) {
    const acc = block.accuracy ?? 0;
    notes.push({
      id: uid(), childId: 'seed-0', from: 'parent', createdAt: ago(4), deliveredAt: ago(4),
      text: 'He found all the dinos and asked for one more round!',
      details: { mood: 4, sleep: 'okay', tags: ['win', 'home-practice'] },
      card: {
        type: 'result', taskId: 'starWatch', sessionId: played.id, accuracy: block.accuracy,
        stars: acc >= 0.85 ? 3 : acc >= 0.65 ? 2 : 1, levelBefore: block.levelBefore, levelAfter: block.levelAfter,
        activeSec: Math.round(block.metrics.activeSec),
      },
    });
  }
  notes.push({
    id: uid(), childId: 'seed-0', from: 'parent', createdAt: ago(3.9), deliveredAt: ago(3.9),
    text: 'Quick question: is it okay to do it on weekends too?',
    details: { tags: ['question'] },
  });
  return notes;
}
