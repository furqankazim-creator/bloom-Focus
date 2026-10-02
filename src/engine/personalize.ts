/**
 * Turns a child's learning profile (developmental age, optional standard score, support profile,
 * communication style, sensory needs, favourite characters) into concrete, explainable plan suggestions.
 * Pure TypeScript so it can be unit-tested. Suggestions are a starting point for the therapist,
 * never an automatic clinical decision.
 */
import type { Character, Child, CommunicationStyle, Dim, Domain, Params, SensoryProfile } from '../types';
import { DIM_STEPS } from './tasks';
import { TRAIN_BY_ID, TRAIN_IDS, type TrainTaskId } from './trainTasks';

export const CHARACTER_PRESETS: Character[] = [
  { name: 'Dino', emoji: '🦖' },
  { name: 'Rocket', emoji: '🚀' },
  { name: 'Unicorn', emoji: '🦄' },
  { name: 'Superhero', emoji: '🦸' },
  { name: 'Kitty', emoji: '🐱' },
  { name: 'Puppy', emoji: '🐶' },
  { name: 'Race car', emoji: '🏎️' },
  { name: 'Football', emoji: '⚽' },
  { name: 'Robot', emoji: '🤖' },
  { name: 'Mermaid', emoji: '🧜‍♀️' },
  { name: 'Panda', emoji: '🐼' },
  { name: 'Lion', emoji: '🦁' },
  { name: 'Princess', emoji: '👑' },
  { name: 'Dragon', emoji: '🐉' },
  { name: 'Train', emoji: '🚂' },
  { name: 'Butterfly', emoji: '🦋' },
];

export const INTEREST_PRESETS = ['Dinosaurs', 'Space', 'Animals', 'Cars', 'Trains', 'Football', 'Drawing', 'Music', 'Lego', 'Cartoons', 'Nature', 'Superheroes'];

/** Family-reported support profile. Labels only — not a diagnosis. */
export const SUPPORT_PROFILES = [
  'ADHD',
  'Autism',
  'Learning difficulty',
  'Developmental delay',
  'Speech & language',
  'Dyslexia',
  'Anxiety',
  'Sensory processing',
] as const;

export const COMMUNICATION_STYLES: { value: CommunicationStyle; label: string; hint: string }[] = [
  { value: 'verbal', label: 'Speaks in sentences', hint: 'Follows spoken instructions' },
  { value: 'mixed', label: 'Some words & gestures', hint: 'Short phrases, pointing' },
  { value: 'augmentative', label: 'Uses AAC / pictures', hint: 'Symbol board or device' },
  { value: 'nonverbal', label: 'Non-speaking', hint: 'Visual and modelled prompts' },
];

export const SENSORY_FLAGS: { key: keyof SensoryProfile; label: string; emoji: string }[] = [
  { key: 'loudSounds', label: 'Loud sounds', emoji: '🔊' },
  { key: 'brightLights', label: 'Bright / flashing', emoji: '💡' },
  { key: 'busyScreens', label: 'Busy screens', emoji: '🌀' },
  { key: 'tactileIssues', label: 'Touch / textures', emoji: '✋' },
];

/** The hero shown in games: an activity's own hero first, then the child's top favourite. */
export function heroFor(child: Pick<Child, 'favouriteCharacters'> | undefined, activityHero?: Character): Character | null {
  return activityHero ?? child?.favouriteCharacters?.[0] ?? null;
}

export type FitBand = 'extra-support' | 'support' | 'typical' | 'stretch';

export const BAND_LABEL: Record<FitBand, string> = {
  'extra-support': 'Extra support',
  support: 'Supported',
  typical: 'Age-typical',
  stretch: 'Stretch',
};

const ORDER: FitBand[] = ['extra-support', 'support', 'typical', 'stretch'];
const moreSupportive = (a: FitBand, b: FitBand) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

/**
 * How hard to pitch activities. Uses the standard score band when given, the gap between
 * developmental and chronological age otherwise, and the more supportive of the two when both exist.
 */
export function fitBand(child: Pick<Child, 'age' | 'cognitiveAge' | 'iqScore'>): { band: FitBand; effectiveAge: number; reasons: string[] } {
  const effectiveAge = child.cognitiveAge ?? child.age;
  const reasons: string[] = [];
  let band: FitBand = 'typical';
  if (child.iqScore != null) {
    const s = child.iqScore;
    const fromScore: FitBand = s < 70 ? 'extra-support' : s < 85 ? 'support' : s > 115 ? 'stretch' : 'typical';
    reasons.push(`standard score ${s}`);
    band = fromScore;
  }
  if (child.cognitiveAge != null && child.cognitiveAge !== child.age) {
    const gap = child.cognitiveAge - child.age;
    const fromAge: FitBand = gap <= -3 ? 'extra-support' : gap <= -1.5 ? 'support' : gap >= 2 ? 'stretch' : 'typical';
    reasons.push(`working at about age ${child.cognitiveAge}`);
    band = child.iqScore != null ? moreSupportive(band, fromAge) : fromAge;
  }
  return { band, effectiveAge, reasons };
}

const FOCUS_GAMES: Record<Domain, TrainTaskId[]> = {
  sustained: ['starWatch', 'mazePath'],
  selective: ['findTarget', 'flankerTask'],
  auditory: ['listenFor'],
  workingMemory: ['memoryEcho', 'memoryMatrix'],
  inhibition: ['goNoGo', 'colorClash'],
  instructions: ['followSteps', 'blockBuilder'],
  flexibility: ['switchSort', 'puzzleMatch'],
  emotional: ['puzzleMatch', 'mazePath'],
};

const PROFILE_GAMES: Record<string, { games: TrainTaskId[]; why: string }> = {
  ADHD: { games: ['starWatch', 'goNoGo', 'flankerTask'], why: 'short attention and stop-and-think games' },
  Autism: { games: ['switchSort', 'findTarget', 'memoryMatrix'], why: 'flexible thinking with predictable, visual games' },
  'Learning difficulty': { games: ['findTarget', 'memoryEcho', 'blockBuilder'], why: 'small, concrete steps' },
  'Developmental delay': { games: ['starWatch', 'findTarget', 'puzzleMatch'], why: 'simple one-rule games' },
  'Speech & language': { games: ['findTarget', 'memoryMatrix', 'puzzleMatch'], why: 'visual games that don’t rely on spoken instructions' },
  Dyslexia: { games: ['memoryEcho', 'speedMatch', 'memoryMatrix'], why: 'sequencing and quick visual matching' },
  Anxiety: { games: ['mazePath', 'puzzleMatch', 'blockBuilder'], why: 'calm, low-pressure games' },
  'Sensory processing': { games: ['puzzleMatch', 'mazePath', 'memoryMatrix'], why: 'quiet games with little on screen' },
};

const VERBAL_GAMES: TrainTaskId[] = ['listenFor', 'followSteps', 'dualTask'];

/** Highest allowed value for a dimension at each band (undefined = no cap). */
const CAPS: Partial<Record<FitBand, Partial<Record<Dim, number>>>> = {
  'extra-support': { speed: 1, distractors: 0, durationSec: 30, memoryLoad: 2, instructionSteps: 1 },
  support: { speed: 2, distractors: 1, durationSec: 45, memoryLoad: 3, instructionSteps: 2 },
};

/** Difficulty changes for one game: lower anything above the band's cap. */
export function paramsForBand(params: Params, band: FitBand, quiet: boolean): Partial<Params> {
  const caps: Partial<Record<Dim, number>> = { ...CAPS[band] };
  if (quiet) caps.distractors = Math.min(caps.distractors ?? 1, 1);
  const out: Partial<Params> = {};
  for (const [dim, cap] of Object.entries(caps) as [Dim, number][]) {
    if (params[dim] > cap) out[dim] = DIM_STEPS[dim].filter((v) => v <= cap).pop() ?? DIM_STEPS[dim][0];
  }
  return out;
}

export type PlanChange = {
  childPatch?: Partial<Pick<Child, 'sessionMinutes' | 'currentMinutes' | 'homeSessionsPerWeek'>>;
  params?: Partial<Record<TrainTaskId, Partial<Params>>>;
  calmMode?: boolean;
};

export type Suggestion = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  why: string;
  /** Present when the suggestion can be applied with one tap. */
  change?: PlanChange;
  games?: TrainTaskId[];
};

const unique = <T,>(xs: T[]) => [...new Set(xs)];
const listSkills = (ids: TrainTaskId[]) => ids.map((id) => `${TRAIN_BY_ID[id].icon} ${TRAIN_BY_ID[id].title}`).join(', ');

export function personalize(child: Child, calmModeOn = false): { band: FitBand; effectiveAge: number; suggestions: Suggestion[] } {
  const { band, effectiveAge, reasons } = fitBand(child);
  const profiles = child.diagnosis ?? [];
  const sensory = child.sensory ?? {};
  const quiet = !!(sensory.loudSounds || sensory.busyScreens || sensory.brightLights || profiles.includes('Anxiety') || profiles.includes('Sensory processing'));
  const nonVerbal = child.communicationStyle === 'nonverbal' || child.communicationStyle === 'augmentative';
  const suggestions: Suggestion[] = [];

  // 1. Which games to focus on.
  const fromProfiles = profiles.flatMap((p) => PROFILE_GAMES[p]?.games ?? []);
  let games = unique([...fromProfiles, ...FOCUS_GAMES[child.focus]]).filter((id) => TRAIN_IDS.includes(id));
  if (nonVerbal) games = games.filter((id) => !VERBAL_GAMES.includes(id));
  games = games.slice(0, 4);
  if (games.length) {
    const whys = profiles.map((p) => PROFILE_GAMES[p]?.why).filter(Boolean);
    suggestions.push({
      id: 'games',
      icon: '🎯',
      title: 'Focus games',
      detail: listSkills(games),
      why: whys.length ? `Chosen for ${whys.join('; ')}.` : `Matches the practice focus.`,
      games,
    });
  }

  // 2. Difficulty pitch.
  if (band === 'extra-support' || band === 'support' || quiet) {
    const params: PlanChange['params'] = {};
    for (const id of TRAIN_IDS) {
      const current = child.tasks[id]?.params;
      if (!current) continue;
      const patch = paramsForBand(current, band === 'typical' || band === 'stretch' ? 'support' : band, quiet);
      if (band === 'typical' || band === 'stretch') {
        // Only the quiet-screen cap applies for age-typical children.
        delete patch.speed;
        delete patch.durationSec;
        delete patch.memoryLoad;
        delete patch.instructionSteps;
      }
      if (Object.keys(patch).length) params[id] = patch;
    }
    if (Object.keys(params).length) {
      suggestions.push({
        id: 'difficulty',
        icon: band === 'extra-support' ? '🌱' : '🪜',
        title: band === 'extra-support' ? 'Start gently' : band === 'support' ? 'Start a step lower' : 'Quieter screens',
        detail:
          band === 'extra-support'
            ? 'Slowest speed, no distractions, short 30-second rounds. The engine still steps up as success builds.'
            : band === 'support'
              ? 'Slower pace, at most one distraction and rounds up to 45 seconds.'
              : 'At most one distraction on screen in every game.',
        why: reasons.length ? `Based on ${reasons.join(' and ')}.` : 'Based on sensory needs.',
        change: { params },
      });
    }
  } else if (band === 'stretch') {
    suggestions.push({
      id: 'difficulty',
      icon: '🚀',
      title: 'Ready for a stretch',
      detail: 'Keep adaptive mode on — the engine will climb quickly. Consider 20-minute sessions.',
      why: `Based on ${reasons.join(' and ')}.`,
      change: child.sessionMinutes < 20 ? { childPatch: { sessionMinutes: 20 } } : undefined,
    });
  }

  // 3. Session length.
  const shortSessions = effectiveAge < 6 || band === 'extra-support' || profiles.includes('ADHD');
  if (shortSessions && child.sessionMinutes > 10) {
    suggestions.push({
      id: 'session',
      icon: '⏱️',
      title: 'Shorter sessions',
      detail: '10-minute sessions, ending while it still feels fun.',
      why: profiles.includes('ADHD') ? 'Short, frequent practice works best for attention.' : `Suits a developmental age of about ${effectiveAge}.`,
      change: { childPatch: { sessionMinutes: 10, currentMinutes: Math.min(child.currentMinutes, 10) } },
    });
  }

  // 4. Calm mode for sensory needs.
  if (quiet && !calmModeOn) {
    const flags = SENSORY_FLAGS.filter((f) => sensory[f.key]).map((f) => f.label.toLowerCase());
    suggestions.push({
      id: 'calm',
      icon: '🫧',
      title: 'Turn on calm mode',
      detail: 'Softer sounds, slower feedback and no warning buzz.',
      why: flags.length ? `Sensitive to ${flags.join(', ')}.` : 'Helps with anxiety and sensory load.',
      change: { calmMode: true },
    });
  }

  // 5. Communication.
  if (nonVerbal) {
    suggestions.push({
      id: 'communication',
      icon: '🖼️',
      title: 'Show, don’t tell',
      detail: 'Model the first round yourself and point to the target. Listen For and Follow Steps are skipped.',
      why: 'These games rely on spoken instructions.',
    });
  }

  // 6. Motivation.
  const hero = heroFor(child);
  suggestions.push(
    hero
      ? {
          id: 'hero',
          icon: hero.emoji,
          title: `${hero.name} is the game hero`,
          detail: `${hero.name} ${hero.emoji} appears as the target in Tap the Stars and cheers at the start and end of every game.`,
          why: 'Favourite characters keep motivation high.',
        }
      : {
          id: 'hero',
          icon: '⭐',
          title: 'Add a favourite character',
          detail: 'Pick a character the child loves in the profile to make games feel like theirs.',
          why: 'Personal heroes boost engagement.',
        },
  );

  return { band, effectiveAge, suggestions };
}
