import type { NoteDetails, NoteTag } from '../types';

/** Quick check-in fields a parent or therapist can add to any message. */
export const MOODS: { value: NonNullable<NoteDetails['mood']>; emoji: string; label: string }[] = [
  { value: 5, emoji: '😄', label: 'Great' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 2, emoji: '😕', label: 'Hard' },
  { value: 1, emoji: '😣', label: 'Very hard' },
];

export const SLEEP: { value: NonNullable<NoteDetails['sleep']>; label: string; short: string }[] = [
  { value: 'good', label: 'Slept well', short: 'Well' },
  { value: 'okay', label: 'Slept okay', short: 'Okay' },
  { value: 'poor', label: 'Slept poorly', short: 'Poorly' },
];

export const TAGS: { value: NoteTag; label: string }[] = [
  { value: 'win', label: 'Win' },
  { value: 'question', label: 'Question' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'home-practice', label: 'Home practice' },
  { value: 'school', label: 'School' },
  { value: 'routine', label: 'Routine' },
];

export const hasDetails = (d?: NoteDetails): d is NoteDetails =>
  !!d && (d.mood !== undefined || d.sleep !== undefined || !!d.tags?.length);

/** Short labels for chips and summaries, e.g. ["🙂 Good day", "Slept well", "Win"]. */
export function detailLabels(d?: NoteDetails): string[] {
  if (!hasDetails(d)) return [];
  const mood = MOODS.find((m) => m.value === d.mood);
  return [
    mood && `${mood.emoji} ${mood.label} day`,
    SLEEP.find((s) => s.value === d.sleep)?.label,
    ...(d.tags ?? []).map((t) => TAGS.find((x) => x.value === t)?.label),
  ].filter(Boolean) as string[];
}
