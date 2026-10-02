export type Role = 'therapist' | 'parent';

export type Domain =
  | 'sustained'
  | 'selective'
  | 'auditory'
  | 'workingMemory'
  | 'inhibition'
  | 'instructions'
  | 'flexibility'
  | 'emotional';

export type TaskId =
  | 'starWatch'
  | 'findTarget'
  | 'flankerTask'
  | 'listenFor'
  | 'memoryEcho'
  | 'memoryMatrix'
  | 'speedMatch'
  | 'goNoGo'
  | 'colorClash'
  | 'followSteps'
  | 'switchSort'
  | 'countName'
  | 'dualTask'
  | 'puzzleMatch'
  | 'blockBuilder'
  | 'mazePath'
  | 'feelings';

/** The independent difficulty dimensions the adaptive engine can move. */
export type Dim = 'durationSec' | 'distractors' | 'speed' | 'memoryLoad' | 'instructionSteps';

export type Params = Record<Dim, number> & {
  /** Correct responses needed per reward. Thins out as the child becomes more persistent. */
  reinforceEvery: number;
};

export type RewardTheme = 'stars' | 'animals' | 'vehicles' | 'nature' | 'celebration';

export type Character = { name: string; emoji: string };
export type SensoryProfile = {
  loudSounds?: boolean;
  brightLights?: boolean;
  busyScreens?: boolean;
  tactileIssues?: boolean;
};
export type CommunicationStyle = 'verbal' | 'nonverbal' | 'augmentative' | 'mixed';

export type BlockMetrics = {
  trials: number;
  hits: number;
  misses: number;
  falseTaps: number;
  correctRejections: number;
  meanRtMs: number | null;
  /** Accuracy in the first and second half of the block, used to detect fatigue. */
  earlyAccuracy: number;
  lateAccuracy: number;
  activeSec: number;
  completed: boolean;
  /** Flags if rapid successive false taps (rage tapping) occurred. */
  frustrationDetected?: boolean;
};

export type Change = { dim: Dim | 'reinforceEvery'; from: number; to: number; reason: string };

export type BlockResult = {
  taskId: TaskId;
  params: Params;
  metrics: BlockMetrics;
  accuracy: number | null;
  changes: Change[];
  summary: string;
  levelBefore: number;
  levelAfter: number;
};

export type TaskState = {
  enabled: boolean;
  params: Params;
  locked: Dim[];
  /** Consecutive blocks at or above the step-up threshold. */
  streak: number;
};

export type Child = {
  id: string;
  name: string;
  age: number;
  focus: Domain;
  color: string;
  createdAt: string;
  /** Therapist-set maximum session length. */
  sessionMinutes: number;
  /** Adaptive session length: starts short and grows toward `sessionMinutes` as engagement holds. */
  currentMinutes: number;
  /** When the starting check placed this child; null until it has been done. */
  baselineAt: string | null;
  /** Code a parent enters to link to this child. */
  familyCode: string;
  rewardTheme: RewardTheme;
  /** Profile picture as a data URI (so it survives reloads on every platform). */
  photo?: string | null;
  /** Emoji avatar, used when there is no photo. */
  avatarEmoji?: string | null;
  homeSessionsPerWeek: number;
  homeNote: string;
  tasks: Record<TaskId, TaskState>;
  /** Optional estimated scaled score used only for developmental activity fit (40–160). */
  iqScore?: number | null;
  /** Developmental age estimate; falls back to chronological age when missing. */
  cognitiveAge?: number | null;
  /** Support profile labels the family reports; not a clinical diagnosis. */
  diagnosis?: string[];
  /** Characters / motivators the child loves — used to personalize activity suggestions. */
  favouriteCharacters?: Character[];
  /** Top interests / hobbies, e.g. "Dinosaurs", "Lego". */
  interests?: string[];
  /** Sensory flags the therapist uses to pace game feedback and screen intensity. */
  sensory?: SensoryProfile;
  /** How the child typically communicates. */
  communicationStyle?: CommunicationStyle;
  /** Additional support tags used for activity scaffolding. */
  supportNeeds?: string[];
  /** Therapist-built home activities. */
  customActivities?: CustomActivity[];
};

/** Game Studio: simple game types a therapist fills with their own words and pictures. */
export type StudioTemplate = 'puzzle' | 'wordsearch' | 'worksheet' | 'findit' | 'sequence' | 'listen';

/** A picture in a studio game: an emoji or a photo (data URI on web, file URI on phones). */
export type StudioPicture = { kind: 'emoji'; value: string } | { kind: 'image'; uri: string };

export type StudioContent =
  | { template: 'puzzle'; image: string }
  | { template: 'wordsearch'; words: string[] }
  | { template: 'worksheet'; image: string; task: string }
  | { template: 'findit'; targetName: string; target: StudioPicture; others: StudioPicture[] }
  | { template: 'sequence'; items: { label: string; emoji?: string }[] }
  | { template: 'listen'; target: string; others: string[] };

export type StudioGame = {
  content: StudioContent;
  /** 1 (easiest) – 5 (hardest). */
  level: number;
  /** Raise the level after two 3-star plays in a row; lower it after a 1-star play. */
  autoLevel: boolean;
  streak?: number;
};

/** One play of a studio game. Worksheet plays keep the child's drawing. */
export type StudioPlay = {
  id: string;
  childId: string;
  activityId: string;
  template: StudioTemplate;
  playedAt: string;
  activeSec: number;
  accuracy: number | null;
  stars: number;
  level: number;
  /** Worksheet drawing: strokes as normalised [x, y, x, y, …] points (0–1). */
  strokes?: { color: string; points: number[] }[];
};

/**
 * A home activity the therapist builds on top of one of the Train games: its own name,
 * a favourite-character hero, fixed or adaptive difficulty, and instructions for the family.
 */
export type CustomActivity = {
  id: string;
  /** The Train game it is built on (a TrainTaskId), or `studio-<template>` for a Game Studio game. */
  taskId: string;
  /** Set for games made in the Game Studio. */
  studio?: StudioGame;
  name: string;
  hero?: Character;
  /** Shown to the parent before starting. */
  instructions: string;
  supportLevel?: 'independent' | 'prompt' | 'hands-on';
  timesPerWeek: number;
  /** Adaptive: grows with the child like the normal game. Fixed: always plays at `params`. */
  adaptive: boolean;
  params: Params;
  createdAt: string;
};

export type Observation = 'stayed' | 'reminders' | 'pause';

export type Session = {
  id: string;
  childId: string;
  startedAt: string;
  activeSec: number;
  by: Role;
  blocks: BlockResult[];
  observation: Observation;
  note?: string;
  rewards: number;
  kind?: 'practice' | 'baseline';
  /** Times the child left the app or went idle mid-activity. */
  disengaged?: number;
  lengthChange?: { from: number; to: number; reason: string };
};

export type Reminder = { enabled: boolean; hour: number };

export type NoteAttachment = {
  id: string;
  kind: 'image' | 'audio' | 'file';
  mimeType: string;
  name: string;
  size: number;
  /** Voice notes only. */
  durationMs?: number;
  /** A file on this device (demo mode) or a short-lived server link. */
  url: string;
};

export type NoteTag = 'win' | 'question' | 'challenge' | 'home-practice' | 'school' | 'routine';

/** Optional structured check-in attached to a message. */
export type NoteDetails = {
  /** 1 (very hard day) to 5 (great day). */
  mood?: 1 | 2 | 3 | 4 | 5;
  sleep?: 'good' | 'okay' | 'poor';
  tags?: NoteTag[];
};

/**
 * Rich cards that tie a conversation to the child's activities and progress.
 * Game ids are kept as strings here so types.ts stays independent of the game engine.
 */
export type NoteCard =
  | {
      /** Therapist assigns or suggests an activity for home. */
      type: 'activity';
      taskId: string;
      level: number;
      minutes: number;
      /** How often, e.g. "3× this week". */
      frequency?: string;
      /** How much scaffolding the family should give — especially useful for special-needs support. */
      supportLevel?: 'independent' | 'prompt' | 'hands-on';
      /** Short suggestion for tying completion to the child's reward theme. */
      rewardTip?: string;
      /** One-line personalised guidance from the therapist. */
      therapistNote?: string;
      /** Set when the card points at a therapist-built custom activity. */
      customId?: string;
      title?: string;
      heroEmoji?: string;
      /** Game Studio type, when the activity is a studio game. */
      template?: StudioTemplate;
    }
  | {
      /** Parent shares a finished Game Studio game or worksheet. */
      type: 'studio';
      activityId: string;
      template: StudioTemplate;
      title: string;
      playId: string;
      accuracy: number | null;
      stars: number;
      activeSec: number;
      level: number;
    }
  | {
      /** Parent shares the result of a game the child just played. */
      type: 'result';
      taskId: string;
      sessionId: string;
      accuracy: number | null;
      stars: number;
      levelBefore: number;
      levelAfter: number;
      activeSec: number;
      /** Set when the game was a therapist-built custom activity. */
      title?: string;
      heroEmoji?: string;
    }
  | {
      /** Weekly progress snapshot, frozen at the time it was shared. */
      type: 'progress';
      weekOf: string;
      sessions: number;
      goal: number;
      minutes: number;
      stars: number;
      prevSessions: number;
      avgAccuracy: number | null;
      prevAvgAccuracy: number | null;
      levelUps: number;
      strongest?: { taskId: string; accuracy: number };
      practiceMore?: { taskId: string; accuracy: number };
    }
  | {
      /** Therapist assigns a structured daily/living routine the family checks off together. */
      type: 'routine';
      title: string;
      steps: string[];
      /** Suggested time of day the routine is practised, e.g. "Morning" or "After school". */
      timeOfDay?: string;
      supportLevel?: 'independent' | 'prompt' | 'hands-on';
      therapistNote?: string;
    };

export type Note = {
  id: string;
  childId: string;
  from: Role;
  /** May be empty when the note carries attachments. */
  text: string;
  createdAt: string;
  attachments?: NoteAttachment[];
  details?: NoteDetails;
  card?: NoteCard;
  /** When the other person's device received it. */
  deliveredAt?: string | null;
  /** When the other person opened the conversation and saw it. */
  readAt?: string | null;
};
