import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { TRAIN_BY_ID } from '../engine/trainTasks';
import type { WeeklySummary } from '../engine/weekly';
import type { Child } from '../types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

function delta(acc: number | null, prev: number | null): string {
  if (acc === null || prev === null) return '';
  const d = Math.round((acc - prev) * 100);
  if (d === 0) return '<span class="flat">= same</span>';
  return d > 0 ? `<span class="up">▲ ${d}</span>` : `<span class="down">▼ ${-d}</span>`;
}

export function buildWeeklyHtml(child: Child, w: WeeklySummary, goal: number): string {
  const rows = w.skills
    .map((s) => {
      const g = TRAIN_BY_ID[s.id];
      return `<tr><td>${g.icon} ${g.skill}</td><td class="num">${s.games}</td><td class="num">${pct(s.acc)}</td><td class="num">${delta(s.acc, s.prevAcc)}</td></tr>`;
    })
    .join('');
  const ups = w.levelUps.length
    ? `<ul>${w.levelUps.map((u) => `<li>${TRAIN_BY_ID[u.taskId as keyof typeof TRAIN_BY_ID]?.skill ?? u.taskId}: level ${u.from} → ${u.to}</li>`).join('')}</ul>`
    : '<p class="muted">No level changes this week.</p>';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1E3A2F; padding: 28px; font-size: 13px; }
    h1 { font-size: 24px; margin: 4px 0; } h2 { font-size: 15px; margin: 22px 0 8px; border-bottom: 1px solid #E6E4DC; padding-bottom: 4px; }
    .muted { color: #5E7268; } .stats { display: flex; gap: 10px; margin-top: 14px; }
    .stat { flex: 1; background: #DDEEDA; border-radius: 10px; padding: 10px; } .stat b { display: block; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; } td, th { padding: 6px; text-align: left; border-bottom: 1px solid #F0EFE9; }
    th { font-size: 11px; color: #5E7268; } .num { text-align: right; font-weight: 600; }
    .up { color: #138A5E; } .down { color: #B5533C; } .flat { color: #5E7268; }
    .summary { background: #F2F8F6; border-radius: 10px; padding: 12px; margin-top: 14px; }
    .note { margin-top: 24px; font-size: 11px; color: #5E7268; }
  </style></head><body>
    <div class="muted">BLOOM FOCUS · WEEKLY PRACTICE REPORT · ${today}</div>
    <h1>${esc(child.name)}</h1>
    <div class="muted">Age ${child.age}</div>
    <div class="stats">
      <div class="stat"><b>${w.sessions}/${goal}</b>games vs weekly goal</div>
      <div class="stat"><b>${w.minutes} min</b>practice time</div>
      <div class="stat"><b>${w.stars} ⭐</b>stars earned</div>
      <div class="stat"><b>${pct(w.best?.acc ?? null)}</b>best game</div>
    </div>
    <div class="summary">${esc(w.sentence)}</div>
    <h2>Skills this week (vs last week)</h2>
    <table><tr><th>Skill</th><th class="num">Games</th><th class="num">Accuracy</th><th class="num">Change</th></tr>${rows}</table>
    <h2>Level changes</h2>${ups}
    <div class="note">Practice summaries, not a clinical assessment. Accuracy is measured at ${esc(child.name.split(' ')[0])}’s own adaptive level.</div>
  </body></html>`;
}

/** Plain-text version for the therapist notes thread. */
export function weeklyText(child: Child, w: WeeklySummary, goal: number): string {
  const lines = w.skills
    .filter((s) => s.games > 0)
    .map((s) => `${TRAIN_BY_ID[s.id].skill}: ${pct(s.acc)} (${s.games} games)`);
  return [
    `📊 Weekly report: ${w.sessions}/${goal} games, ${w.minutes} min, ${w.stars} stars.`,
    ...lines,
    w.levelUps.length ? `Level-ups: ${w.levelUps.length}.` : '',
    w.sentence,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Opens the share sheet with a PDF on phones, or the print dialog (save as PDF) on web. */
export async function shareWeeklyReport(child: Child, w: WeeklySummary, goal: number) {
  const html = buildWeeklyHtml(child, w, goal);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `${child.name} weekly report` });
  }
}
