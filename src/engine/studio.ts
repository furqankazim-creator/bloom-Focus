import type { StudioGame, StudioTemplate } from '../types';

/** Fisher-Yates shuffle. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LEVEL_NAMES = ['Easy', 'Warm-up', 'Just right', 'Challenge', 'Stretch'];
export const levelName = (l: number) => LEVEL_NAMES[Math.max(0, Math.min(4, l - 1))] ?? 'Just right';

export function starsFromAccuracy(accuracy: number | null): number {
  if (accuracy == null) return 3;
  if (accuracy >= 0.88) return 3;
  if (accuracy >= 0.6) return 2;
  return 1;
}

/**
 * Auto-level a studio game after a play.
 * - Two consecutive 3-star plays → level up (unless already 5).
 * - A single 1-star play → level down (unless already 1).
 */
export function nextLevel(
  g: StudioGame,
  stars: number,
): { level: number; streak: number; changed: -1 | 0 | 1 } {
  if (!g.autoLevel) return { level: g.level, streak: g.streak ?? 0, changed: 0 };
  const prev = g.streak ?? 0;
  let streak = 0;
  let changed: -1 | 0 | 1 = 0;
  let level = g.level;
  if (stars === 3) {
    streak = prev + 1;
    if (streak >= 2 && level < 5) {
      level += 1;
      streak = 0;
      changed = 1;
    }
  } else if (stars === 1) {
    streak = 0;
    if (level > 1) {
      level -= 1;
      changed = -1;
    }
  }
  return { level, streak, changed };
}

/** Metadata + default instructions for every Game Studio template. */
export const TEMPLATE: Record<StudioTemplate, {
  name: string;
  icon: string;
  color: string;
  tint: string;
  skill: string;
  instructions: string;
  levelled: boolean;
  tip?: string;
}> = {
  puzzle: {
    name: 'Jigsaw puzzle',
    icon: '🧩',
    color: '#9B59B6',
    tint: '#F3E8F9',
    skill: 'Visual attention',
    levelled: true,
    instructions: 'Talk about what you see in the picture first. Put the pieces together one row at a time.',
    tip: 'Use a photo of the child, their family, or their favourite animal.',
  },
  wordsearch: {
    name: 'Word search',
    icon: '🔍',
    color: '#16A34A',
    tint: '#E8F7EE',
    skill: 'Reading focus',
    levelled: true,
    instructions: 'Find every word in the list. Go letter-by-letter if you get stuck.',
    tip: 'Use spelling words, family names, or the child’s current topic at school.',
  },
  worksheet: {
    name: 'Worksheet',
    icon: '✏️',
    color: '#DC2626',
    tint: '#FDE8E8',
    skill: 'Fine motor / Writing',
    levelled: false,
    instructions: 'Draw or write on top of the picture. There are no wrong answers — this is about trying.',
    tip: 'Share the drawing back to the therapist through Messages after playing.',
  },
  findit: {
    name: 'Find it',
    icon: '🎯',
    color: '#EA580C',
    tint: '#FFF0E5',
    skill: 'Selective attention',
    levelled: true,
    instructions: 'Tap every picture that matches. Leave the others alone.',
    tip: 'Use the child’s favourite characters and favourite foods as targets.',
  },
  sequence: {
    name: 'Memory sequence',
    icon: '🧠',
    color: '#0891B2',
    tint: '#E6F5F8',
    skill: 'Working memory',
    levelled: true,
    instructions: 'Watch the order. Then tap the same pictures back in the same order.',
    tip: 'Perfect for routines: “Brush teeth → get dressed → eat breakfast”.',
  },
  listen: {
    name: 'Listen for it',
    icon: '👂',
    color: '#4F46E5',
    tint: '#EEF0FF',
    skill: 'Auditory attention',
    levelled: true,
    instructions: 'Listen carefully. Tap the screen every time you hear the secret word.',
    tip: 'Great for classroom listening skills. Use their name or a keyword they know.',
  },
};

/* ─── Per-template level settings ─── */

export function findItSettings(level: number) {
  const presets = [
    { cells: 6,  roundSec: 0,  rounds: 2 },
    { cells: 9,  roundSec: 0,  rounds: 3 },
    { cells: 12, roundSec: 0,  rounds: 3 },
    { cells: 12, roundSec: 30, rounds: 4 },
    { cells: 15, roundSec: 25, rounds: 5 },
  ];
  return presets[Math.max(0, Math.min(4, level - 1))];
}

export function sequenceSettings(level: number) {
  const presets = [
    { length: 2, showMs: 1100, rounds: 3 },
    { length: 3, showMs: 1000, rounds: 3 },
    { length: 4, showMs: 900,  rounds: 4 },
    { length: 5, showMs: 800,  rounds: 4 },
    { length: 6, showMs: 700,  rounds: 5 },
  ];
  return presets[Math.max(0, Math.min(4, level - 1))];
}

/** Returns the pace + total count of spoken words for the Listen game. */
export function listenSettings(level: number) {
  const presets = [
    { gapMs: 2600, words: 8  },
    { gapMs: 2300, words: 10 },
    { gapMs: 2000, words: 12 },
    { gapMs: 1700, words: 14 },
    { gapMs: 1400, words: 16 },
  ];
  return presets[Math.max(0, Math.min(4, level - 1))];
}

export function puzzleSize(level: number) {
  return [3, 3, 4, 4, 5][Math.max(0, Math.min(4, level - 1))];
}
export function puzzleNumbers(level: number) {
  const s = puzzleSize(level);
  return s * s;
}

/* ─── Word search engine ─── */

const DIRS: [number, number][] = [
  [0, 1], [1, 0], [1, 1], [-1, 1],
];

type PlacedWord = { word: string; cells: number[] };

function rcToIndex(r: number, c: number, size: number) { return r * size + c; }

export function buildWordGrid(words: string[], level: number) {
  const size = [8, 9, 10, 11, 12][Math.max(0, Math.min(4, level - 1))];
  const cleaned = words
    .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 3 && w.length <= size)
    .slice(0, 10);

  const grid2d: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placed: PlacedWord[] = [];

  for (const word of cleaned) {
    let done = false;
    for (let attempt = 0; attempt < 120 && !done; attempt++) {
      const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const endR = r + dr * (word.length - 1);
      const endC = c + dc * (word.length - 1);
      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        if (grid2d[rr][cc] && grid2d[rr][cc] !== word[i]) { ok = false; break; }
      }
      if (!ok) continue;
      const cells: number[] = [];
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        grid2d[rr][cc] = word[i];
        cells.push(rcToIndex(rr, cc, size));
      }
      placed.push({ word, cells });
      done = true;
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letters: string[] = new Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const ch = grid2d[r][c] || alphabet[Math.floor(Math.random() * alphabet.length)];
      grid2d[r][c] = ch;
      letters[rcToIndex(r, c, size)] = ch;
    }
  }

  return { letters, placed, size };
}

/** Given two flat-cell indices and a grid size, return the list of flat-cell indices along the line (including endpoints), or null if not horizontal / vertical / 45° diagonal. */
export function lineBetween(a: number, b: number, size: number): number[] | null {
  if (a === b) return null;
  const ar = Math.floor(a / size), ac = a % size;
  const br = Math.floor(b / size), bc = b % size;
  const dr = br - ar, dc = bc - ac;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sdr = dr === 0 ? 0 : dr / Math.abs(dr);
  const sdc = dc === 0 ? 0 : dc / Math.abs(dc);
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) out.push(rcToIndex(ar + sdr * i, ac + sdc * i, size));
  return out;
}
