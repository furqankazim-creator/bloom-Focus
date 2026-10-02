import { describeChange, pct, taskLevel } from '../engine/adaptive';
import { attentionProfile, childSessions, profileSentence, sessionAccuracy } from '../engine/profile';
import { DOMAIN_LABEL, TASKS, TASK_ORDER, dimLabel, formatDim } from '../engine/tasks';
import type { Child, Note, Session } from '../types';
import { noteSummary } from './attachments';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const OBS: Record<Session['observation'], string> = {
  stayed: 'Stayed with it',
  reminders: 'A few reminders',
  pause: 'Needed a pause',
};

/** Printable progress report for parent meetings and case notes. */
export function buildReportHtml(child: Child, all: Session[], notes: Note[]): string {
  const sessions = childSessions(all, child.id);
  const profile = attentionProfile(sessions);
  const home = sessions.filter((s) => s.by === 'parent').length;
  const tasks = TASK_ORDER.filter((id) => TASKS[id].scored && child.tasks[id]?.enabled);
  const decisions = sessions
    .flatMap((s) => s.blocks.map((b) => ({ s, b })))
    .filter(({ b }) => b.changes.some((c) => c.dim !== 'reinforceEvery'))
    .slice(0, 8);

  const bars = profile
    .map(
      (p) => `<tr><td>${DOMAIN_LABEL[p.domain]}</td>
      <td class="barcell"><div class="bar"><div style="width:${Math.round((p.score ?? 0) * 100)}%"></div></div></td>
      <td class="num">${p.score === null ? '—' : pct(p.score)}</td></tr>`,
    )
    .join('');

  const levels = tasks
    .map((id) => {
      const t = TASKS[id];
      const p = child.tasks[id].params;
      const settings = t.dims.map((d) => `${dimLabel(t, d)}: ${formatDim(d, p[d])}`).join(', ');
      return `<tr><td>${t.name}</td><td class="num">${taskLevel(t, p)}/10</td><td class="small">${esc(settings)}</td></tr>`;
    })
    .join('');

  const rows = sessions
    .slice(0, 10)
    .map((s) => {
      const acc = sessionAccuracy(s);
      return `<tr><td>${date(s.startedAt)}</td><td>${s.kind === 'baseline' ? 'Starting check' : s.by === 'parent' ? 'Home' : 'Clinic'}</td>
      <td>${s.blocks.length}</td><td class="num">${acc === null ? '—' : pct(acc)}</td><td>${OBS[s.observation]}</td></tr>`;
    })
    .join('');

  const dec = decisions
    .map(({ s, b }) => {
      const t = TASKS[b.taskId];
      const c = b.changes.find((x) => x.dim !== 'reinforceEvery')!;
      return `<li><b>${date(s.startedAt)} · ${t.name}:</b> ${esc(describeChange(c, t))}. <span class="small">${esc(c.reason)}</span></li>`;
    })
    .join('');

  const recentNotes = notes
    .filter((n) => n.childId === child.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((n) => `<li><b>${n.from === 'therapist' ? 'Therapist' : 'Parent'}, ${date(n.createdAt)}:</b> ${esc(noteSummary(n))}</li>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1E3A2F; padding: 28px; font-size: 12px; }
    h1 { font-size: 24px; margin: 0; } h2 { font-size: 15px; margin: 22px 0 8px; border-bottom: 1px solid #E6E4DC; padding-bottom: 4px; }
    .muted { color: #5E7268; } .small { color: #5E7268; font-size: 11px; }
    .stats { display: flex; gap: 10px; margin-top: 14px; } .stat { flex: 1; background: #DDEEDA; border-radius: 10px; padding: 10px; }
    .stat b { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; } td, th { padding: 5px 6px; text-align: left; border-bottom: 1px solid #F0EFE9; }
    th { font-size: 11px; color: #5E7268; } .num { text-align: right; font-weight: 600; white-space: nowrap; }
    .barcell { width: 45%; } .bar { background: #ECEBE4; height: 8px; border-radius: 4px; overflow: hidden; } .bar div { background: #94BA6A; height: 8px; }
    ul { padding-left: 16px; margin: 0; } li { margin-bottom: 5px; }
    .note { margin-top: 24px; background: #F4F2EC; border-radius: 8px; padding: 10px; font-size: 11px; color: #5E7268; }
  </style></head><body>
    <div class="muted">BLOOM FOCUS · PRACTICE PROGRESS REPORT</div>
    <h1>${esc(child.name)}</h1>
    <div class="muted">${child.age} years · Focus: ${DOMAIN_LABEL[child.focus]} · Report date ${date(new Date().toISOString())}</div>
    <div class="stats">
      <div class="stat"><b>${sessions.length}</b>sessions (${home} at home)</div>
      <div class="stat"><b>${child.currentMinutes} min</b>current session length (max ${child.sessionMinutes})</div>
      <div class="stat"><b>${child.baselineAt ? date(child.baselineAt) : 'Not yet'}</b>starting check</div>
    </div>
    <h2>Attention profile</h2>
    <p>${esc(profileSentence(child, profile))}</p>
    <table>${bars}</table>
    <h2>Current activity levels</h2>
    <table><tr><th>Activity</th><th class="num">Level</th><th>Engine settings</th></tr>${levels}</table>
    <h2>Recent sessions</h2>
    <table><tr><th>Date</th><th>Where</th><th>Activities</th><th class="num">Accuracy</th><th>Observation</th></tr>${rows}</table>
    ${dec ? `<h2>Recent engine decisions</h2><ul>${dec}</ul>` : ''}
    ${recentNotes ? `<h2>Recent notes</h2><ul>${recentNotes}</ul>` : ''}
    <div class="note">These are practice-session summaries, not clinical measures or a diagnosis. No biometric data was collected.
    Accuracy reflects performance at the child's own adaptive difficulty, so it is not comparable between children.</div>
  </body></html>`;
}
