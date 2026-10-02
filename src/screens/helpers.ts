import { useMemo } from 'react';
import { STEP_UP_STREAK, taskLevel } from '../engine/adaptive';
import { generateTrainHistory } from '../engine/demo';
import { useStore } from '../store/useStore';
import { averageAccuracy, childSessions, startOfWeek } from '../engine/profile';
import { TASKS, TASK_ORDER, TaskDef } from '../engine/tasks';
import type { Child, Session } from '../types';

/** The task that best represents the child's practice focus. */
export function focusTask(child: Child): TaskDef {
  const scored = TASK_ORDER.map((id) => TASKS[id]).filter((t) => t.scored);
  return (
    scored.find((t) => t.domain === child.focus && child.tasks[t.id].enabled) ??
    scored.find((t) => child.tasks[t.id].enabled) ??
    TASKS.starWatch
  );
}

export function childStats(child: Child, all: Session[]) {
  const sessions = childSessions(all, child.id);
  const task = focusTask(child);
  const state = child.tasks[task.id];
  return {
    sessions,
    count: sessions.length,
    avg: averageAccuracy(sessions.slice(0, 5)),
    task,
    level: taskLevel(task, state.params),
    streak: state.streak,
    streakNeeded: STEP_UP_STREAK,
    last: sessions[0],
  };
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function longDate(d = new Date()) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function relativeDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return shortDate(iso);
}

export function thisWeek(sessions: Session[]) {
  const start = startOfWeek().toISOString();
  return sessions.filter((s) => s.startedAt >= start);
}

/** Count of completed sessions per weekday (Mon..Sun) of the current week. */
export function weekRhythm(sessions: Session[]): number[] {
  const start = startOfWeek();
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const i = Math.floor((d.getTime() - start.getTime()) / 86400000);
    if (i >= 0 && i < 7) counts[i]++;
  }
  return counts;
}

export function firstName(name: string) {
  return name.split(' ')[0];
}

/**
 * A child's sessions, newest first. A child with no games yet gets generated sample
 * history (flagged `isDemo`) so every chart has something to show until real play begins.
 */
export function useChildHistory(child: Child | undefined): { sessions: Session[]; isDemo: boolean } {
  const all = useStore((s) => s.sessions);
  const real = useMemo(() => (child ? childSessions(all, child.id) : []), [all, child?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const demo = useMemo(
    () => (child && real.length === 0 ? generateTrainHistory(child).sessions.reverse() : []),
    [child?.id, real.length === 0], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return real.length > 0 ? { sessions: real, isDemo: false } : { sessions: demo, isDemo: true };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Consecutive days with at least one session, counting back from today (or yesterday). */
export function dayStreak(sessions: Session[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const isToday = (iso: string, now = new Date()) => dayKey(new Date(iso)) === dayKey(now);
