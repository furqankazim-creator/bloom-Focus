import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { avatarColors } from '../theme';
import { MIN_MINUTES } from '../engine/scheduler';
import { nextLevel } from '../engine/studio';
import type { Child, CustomActivity, Dim, StudioPlay, Domain, Note, NoteAttachment, NoteCard, NoteDetails, Reminder, Role, Session, TaskId, TaskState } from '../types';
import { generateTrainHistory } from '../engine/demo';
import { buildSeed, enrichDemo, makeFamilyCode, makeTasks, uid } from './seed';

/** Storage key for the persisted store (localStorage on web). */
const STORE_KEY = 'bloom-focus-v1';

type NewChild = { name: string; age: number; focus: Domain; sessionMinutes: number };

type State = {
  role: Role | null;
  userName: string;
  /** Name of the child's therapist — surfaced in the parent UX. */
  therapistDisplayName: string | null;
  /** The child a parent account is linked to. */
  parentChildId: string | null;
  children: Child[];
  sessions: Session[];
  notes: Note[];
  /** Parent's daily home-practice reminder (local notification). */
  reminder: Reminder;
  /** 4-digit code that locks the parent's Progress and Profile tabs; null = no lock. */
  parentPin: string | null;
  /** Game sound effects. */
  soundOn: boolean;
  /** Gentler games: softer feedback, slower pace, no warning buzz. */
  calmMode: boolean;
  /** Games whose practice round has been played on this device. */
  practiced: TaskId[];
  /** Plays of therapist-made Game Studio games (kept apart from the adaptive engine's sessions). */
  studioPlays: StudioPlay[];

  signIn: (role: Role, userName: string, parentChildId?: string | null) => void;
  signOut: () => void;
  addChild: (c: NewChild) => string;
  updateChild: (id: string, patch: Partial<Omit<Child, 'id' | 'tasks'>>) => void;
  /** Adds or replaces a therapist-built activity (matched by id). */
  saveCustomActivity: (childId: string, activity: CustomActivity) => void;
  removeCustomActivity: (childId: string, activityId: string) => void;
  /** Records a studio game play and, when auto-adjust is on, moves that game's level. */
  recordStudioPlay: (play: StudioPlay) => { levelChange: -1 | 0 | 1 };
  removeChild: (id: string) => void;
  setTaskEnabled: (childId: string, taskId: TaskId, enabled: boolean) => void;
  setTaskParam: (childId: string, taskId: TaskId, dim: Dim | 'reinforceEvery', value: number) => void;
  toggleLock: (childId: string, taskId: TaskId, dim: Dim) => void;
  recordSession: (
    session: Session,
    taskStates: Partial<Record<TaskId, TaskState>>,
    childPatch?: Partial<Omit<Child, 'id' | 'tasks'>>,
  ) => void;
  setReminder: (r: Reminder) => void;
  setParentPin: (pin: string | null) => void;
  setPrefs: (p: Partial<Pick<State, 'soundOn' | 'calmMode'>>) => void;
  markPracticed: (id: TaskId) => void;
  addNote: (
    childId: string,
    from: Role,
    text: string,
    extra?: { attachments?: NoteAttachment[]; details?: NoteDetails; card?: NoteCard },
  ) => void;
  /** Demo mode: the reader opened the conversation, so the other side's messages become read. */
  markNotesRead: (childId: string, reader: Role) => void;
  setTherapistDisplayName: (name: string | null) => void;
  resetDemo: () => void;
};

const mapChild = (children: Child[], id: string, fn: (c: Child) => Child) =>
  children.map((c) => (c.id === id ? fn(c) : c));

const mapTask = (c: Child, taskId: TaskId, fn: (t: TaskState) => TaskState): Child => ({
  ...c,
  tasks: { ...c.tasks, [taskId]: fn(c.tasks[taskId]) },
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      role: null,
      userName: '',
      therapistDisplayName: null,
      parentChildId: null,
      reminder: { enabled: false, hour: 17 },
      parentPin: null,
      soundOn: true,
      calmMode: false,
      practiced: [],
      studioPlays: [],
      ...buildSeed(),

      signIn: (role, userName, parentChildId = null) => set({ role, userName, parentChildId }),
      signOut: () => set({ role: null, parentChildId: null, therapistDisplayName: null }),
      setTherapistDisplayName: (therapistDisplayName) => set({ therapistDisplayName }),

      addChild: (c) => {
        const id = uid();
        const child: Child = {
          id,
          name: c.name.trim(),
          age: c.age,
          focus: c.focus,
          color: avatarColors[get().children.length % avatarColors.length],
          createdAt: new Date().toISOString(),
          sessionMinutes: c.sessionMinutes,
          currentMinutes: Math.min(MIN_MINUTES, c.sessionMinutes),
          baselineAt: null,
          familyCode: makeFamilyCode(get().children.map((x) => x.familyCode)),
          rewardTheme: 'stars',
          homeSessionsPerWeek: 3,
          homeNote: '',
          tasks: makeTasks(c.age, c.focus),
          iqScore: null,
          cognitiveAge: null,
          diagnosis: [],
          favouriteCharacters: [],
          interests: [],
          sensory: {},
          communicationStyle: 'verbal',
          supportNeeds: [],
        };
        set({ children: [...get().children, child] });
        return id;
      },
      saveCustomActivity: (childId, activity) =>
        set({
          children: mapChild(get().children, childId, (c) => {
            const list = c.customActivities ?? [];
            const exists = list.some((a) => a.id === activity.id);
            return { ...c, customActivities: exists ? list.map((a) => (a.id === activity.id ? activity : a)) : [...list, activity] };
          }),
        }),
      recordStudioPlay: (play) => {
        let levelChange: -1 | 0 | 1 = 0;
        set({
          studioPlays: [...get().studioPlays, play],
          children: mapChild(get().children, play.childId, (c) => ({
            ...c,
            customActivities: (c.customActivities ?? []).map((a) => {
              if (a.id !== play.activityId || !a.studio) return a;
              const next = nextLevel(a.studio, play.stars);
              levelChange = next.changed;
              return { ...a, studio: { ...a.studio, level: next.level, streak: next.streak } };
            }),
          })),
        });
        return { levelChange };
      },
      removeCustomActivity: (childId, activityId) =>
        set({
          children: mapChild(get().children, childId, (c) => ({
            ...c,
            customActivities: (c.customActivities ?? []).filter((a) => a.id !== activityId),
          })),
        }),
      updateChild: (id, patch) =>
        set({ children: mapChild(get().children, id, (c) => ({ ...c, ...patch })) }),
      removeChild: (id) =>
        set({
          children: get().children.filter((c) => c.id !== id),
          sessions: get().sessions.filter((s) => s.childId !== id),
          notes: get().notes.filter((n) => n.childId !== id),
          parentChildId: get().parentChildId === id ? null : get().parentChildId,
        }),
      setTaskEnabled: (childId, taskId, enabled) =>
        set({
          children: mapChild(get().children, childId, (c) => mapTask(c, taskId, (t) => ({ ...t, enabled }))),
        }),
      setTaskParam: (childId, taskId, dim, value) =>
        set({
          children: mapChild(get().children, childId, (c) =>
            mapTask(c, taskId, (t) => ({ ...t, streak: 0, params: { ...t.params, [dim]: value } })),
          ),
        }),
      toggleLock: (childId, taskId, dim) =>
        set({
          children: mapChild(get().children, childId, (c) =>
            mapTask(c, taskId, (t) => ({
              ...t,
              locked: t.locked.includes(dim) ? t.locked.filter((d) => d !== dim) : [...t.locked, dim],
            })),
          ),
        }),
      recordSession: (session, taskStates, childPatch) =>
        set({
          sessions: [...get().sessions, session],
          children: mapChild(get().children, session.childId, (c) => ({
            ...c,
            ...childPatch,
            tasks: { ...c.tasks, ...taskStates },
          })),
        }),
      setReminder: (reminder) => set({ reminder }),
      setParentPin: (parentPin) => set({ parentPin }),
      setPrefs: (p) => set(p),
      markPracticed: (id) => set({ practiced: get().practiced.includes(id) ? get().practiced : [...get().practiced, id] }),
      addNote: (childId, from, text, extra = {}) => {
        const now = new Date().toISOString();
        set({
          notes: [
            ...get().notes,
            {
              id: uid(),
              childId,
              from,
              text: text.trim(),
              createdAt: now,
              // Both roles share this device in the demo, so a message is delivered as soon as it's saved.
              deliveredAt: now,
              readAt: null,
              ...(extra.attachments?.length ? { attachments: extra.attachments } : {}),
              ...(extra.details ? { details: extra.details } : {}),
              ...(extra.card ? { card: extra.card } : {}),
            },
          ],
        });
      },
      markNotesRead: (childId, reader) => {
        const notes = get().notes;
        if (!notes.some((n) => n.childId === childId && n.from !== reader && !n.readAt)) return;
        const now = new Date().toISOString();
        set({
          notes: notes.map((n) =>
            n.childId === childId && n.from !== reader && !n.readAt ? { ...n, deliveredAt: n.deliveredAt ?? now, readAt: now } : n,
          ),
        });
      },
      resetDemo: () => set({ ...buildSeed(), role: null, parentChildId: null, reminder: { enabled: false, hour: 17 }, parentPin: null, practiced: [], studioPlays: [] }),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 10,
      migrate: (persisted, version) => {
        const state = persisted as State;

        // v3 added adaptive session length, the starting check and family codes.
        if (version < 3 && state?.children) {
          const taken: string[] = [];
          state.children = state.children.map((c) => {
            const familyCode = c.familyCode ?? makeFamilyCode(taken);
            taken.push(familyCode);
            return {
              ...c,
              currentMinutes: c.currentMinutes ?? c.sessionMinutes,
              baselineAt: c.baselineAt === undefined ? c.createdAt : c.baselineAt,
              familyCode,
            };
          });
          state.reminder = state.reminder ?? { enabled: false, hour: 17 };
        }
        // Any task added since this data was saved starts initialized (v8 Lumosity/Peak additions).
        if (state?.children) {
          state.children = state.children.map((c) => {
            const defaults = makeTasks(c.age, c.focus);
            const tasks = { ...c.tasks };
            for (const id of Object.keys(defaults) as TaskId[]) {
              if (!tasks[id]) tasks[id] = { ...defaults[id], enabled: true };
            }
            return { ...c, tasks };
          });
        }
        // v5 added the parent PIN.
        if (state) {
          state.parentPin = state.parentPin ?? null;
          // v7 added sound, calm mode and practice-round tracking.
          state.soundOn = state.soundOn ?? true;
          state.calmMode = state.calmMode ?? false;
          state.practiced = state.practiced ?? [];
          state.studioPlays = (state as any).studioPlays ?? [];
          // v9 added therapistDisplayName & deep child customization.
          state.therapistDisplayName = (state as any).therapistDisplayName ?? null;
        }
        // v10 added learning profiles, custom activities and a richer sample conversation.
        if (version < 10 && state?.children && state.sessions) {
          state.notes = [...(state.notes ?? []), ...enrichDemo(state.children, state.sessions)];
        }
        // v6 added demo home-practice history for the Train games to the sample children.
        if (version < 6 && state?.children && state.sessions) {
          for (const c of state.children) {
            if (!c.id.startsWith('seed-') || state.sessions.some((s) => s.id.startsWith(`demo-${c.id}-`))) continue;
            const home = generateTrainHistory(c);
            c.tasks = { ...c.tasks, ...home.tasks };
            state.sessions = [...state.sessions, ...home.sessions];
          }
        }
        // v9: back-fill deep customization fields onto existing children (new optional fields, so empty/none defaults are safe).
        if (version < 9 && state?.children) {
          state.children = state.children.map((c) => ({
            iqScore: null,
            cognitiveAge: null,
            diagnosis: [],
            favouriteCharacters: [],
            interests: [],
            sensory: {},
            communicationStyle: 'verbal',
            supportNeeds: [],
            ...c,
          }));
        }
        return state;
      },
    },
  ),
);

export const useChild = (id: string | undefined) =>
  useStore((s) => s.children.find((c) => c.id === id));

/**
 * Web demo: the therapist and the parent are often open in two browser windows. Each window keeps
 * its own copy of the store, so pull in the other window's saves — new messages, read ticks and
 * plan changes then appear live without refreshing the page.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // Only shared data syncs; who is signed in (role, name, linked child) stays per window.
  const SHARED = ['children', 'sessions', 'notes', 'studioPlays'] as const;
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || !e.newValue) return;
    try {
      const incoming = JSON.parse(e.newValue)?.state as Partial<State> | undefined;
      if (!incoming) return;
      const current = useStore.getState();
      const patch: Partial<State> = {};
      for (const key of SHARED) {
        // Skip unchanged data so the two windows don't keep echoing writes back and forth.
        if (incoming[key] && JSON.stringify(incoming[key]) !== JSON.stringify(current[key])) (patch as any)[key] = incoming[key];
      }
      if (Object.keys(patch).length) useStore.setState(patch);
    } catch {
      // Ignore malformed or partial writes; the next save will sync.
    }
  });
}
