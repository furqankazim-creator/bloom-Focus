import type { Child, Domain, Session } from '../types';
import { SCORED_DOMAINS, TASKS } from './tasks';

export type DomainScore = { domain: Domain; score: number | null; blocks: number };

/** Average accuracy per domain over a child's most recent blocks. Descriptive, not diagnostic. */
export function attentionProfile(sessions: Session[], recentBlocks = 6): DomainScore[] {
  const sorted = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return SCORED_DOMAINS.map((domain) => {
    const accs: number[] = [];
    for (const s of sorted) {
      for (const b of s.blocks) {
        if (TASKS[b.taskId].domain === domain && b.accuracy !== null && accs.length < recentBlocks)
          accs.push(b.accuracy);
      }
    }
    return {
      domain,
      score: accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null,
      blocks: accs.length,
    };
  });
}

export function sessionAccuracy(s: Session): number | null {
  const accs = s.blocks.map((b) => b.accuracy).filter((a): a is number => a !== null);
  return accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
}

export function averageAccuracy(sessions: Session[]): number | null {
  const accs = sessions.map(sessionAccuracy).filter((a): a is number => a !== null);
  return accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
}

/** Plain-language strongest / needs-practice sentence for parents. */
export function profileSentence(child: Child, profile: DomainScore[]): string {
  const scored = profile.filter((p) => p.score !== null && p.blocks >= 2) as {
    domain: Domain;
    score: number;
  }[];
  if (scored.length < 2) return `A few more sessions will show where ${child.name} shines.`;
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const label = (d: Domain) => DOMAIN_TEXT[d];
  return `${child.name}'s strongest area right now is ${label(sorted[0].domain)}. ${cap(
    label(sorted[sorted.length - 1].domain),
  )} could use a little more practice.`;
}

const DOMAIN_TEXT: Record<Domain, string> = {
  sustained: 'staying with one task',
  selective: 'finding things among distractions',
  auditory: 'listening for something specific',
  workingMemory: 'holding things in mind',
  inhibition: 'pausing before responding',
  instructions: 'following multi-step instructions',
  flexibility: 'switching between rules',
  emotional: 'naming feelings',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function childSessions(sessions: Session[], childId: string): Session[] {
  return sessions
    .filter((s) => s.childId === childId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
