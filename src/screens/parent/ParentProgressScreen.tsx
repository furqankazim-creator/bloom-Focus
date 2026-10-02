import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { LineChart, shortDate } from '../../components/LineChart';
import { PinGate } from '../../components/PinGate';
import { SampleBanner } from '../../components/SampleBanner';
import { Card, Screen, T } from '../../components/ui';
import { averageAccuracy, sessionAccuracy } from '../../engine/profile';
import { skillHistory } from '../../engine/skillHistory';
import { TRAIN_INFO, TrainTaskId, starsFor, taskDisplay } from '../../engine/trainTasks';
import { weeklySummary } from '../../engine/weekly';
import { shareWeeklyReport } from '../../services/weeklyReport';
import { progressCard } from '../../services/noteCards';
import { postToConversation } from '../../services/messaging';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import { firstName, useChildHistory } from '../helpers';

// Radar geometry: the four skills sit on the four points of a diamond.
const CX = 140;
const CY = 112;
const R = 72;
const AXES = [
  { dx: 0, dy: -1, label: 'Sustained', lx: 0, ly: -R - 10, anchor: 'middle' },
  { dx: 1, dy: 0, label: 'Visual', lx: R + 10, ly: 4, anchor: 'start' },
  { dx: 0, dy: 1, label: 'Memory', lx: 0, ly: R + 20, anchor: 'middle' },
  { dx: -1, dy: 0, label: 'Control', lx: -R - 10, ly: 4, anchor: 'end' },
] as const;
// Only these 4 IDs map to the 4 radar axes above (in order)
const RADAR_IDS: TrainTaskId[] = ['starWatch', 'findTarget', 'memoryEcho', 'goNoGo'];

export default function ParentProgressScreen() {
  const nav = useNavigation<any>();
  const { parentChildId, children } = useStore();
  const child = children.find((c) => c.id === parentChildId) || children[0];
  const { sessions: mine, isDemo } = useChildHistory(child);
  const [sharing, setSharing] = useState(false);
  const [sent, setSent] = useState(false);

  if (!child) return null;
  const first = firstName(child.name);

  // Per-skill score: mean of the last 6 games of that skill.
  const skillScores = TRAIN_INFO.map((g) => {
    const pts = skillHistory(mine, g.id).slice(-6);
    return { g, score: pts.length ? pts.reduce((n, p) => n + p.accuracy, 0) / pts.length : null };
  });

  // Radar chart uses exactly 4 skills (one per axis). Keep the axis mapping aligned to the 4 tracked skills only.
  const radarData = RADAR_IDS.map((id, index) => {
    const found = skillScores.find((s) => s.g.id === id);
    return {
      axis: AXES[index],
      score: found?.score ?? null,
      color: found?.g.color ?? colors.leaf,
    };
  });

  const avgAcc = averageAccuracy(mine);
  const starsTotal = mine.reduce((n, s) => n + starsFor(sessionAccuracy(s)), 0);

  const scored = mine.filter((s) => sessionAccuracy(s) !== null);
  const trend = scored
    .slice(0, 10)
    .reverse()
    .map((s) => ({ value: Math.round((sessionAccuracy(s) ?? 0) * 100), label: shortDate(s.startedAt) }));

  const week = weeklySummary(mine);
  const goal = Math.max(1, child.homeSessionsPerWeek || 3);

  const share = async () => {
    setSharing(true);
    try {
      await shareWeeklyReport(child, week, goal);
    } catch {
      // The share sheet was dismissed or printing is unavailable; nothing to do.
    } finally {
      setSharing(false);
    }
  };

  // Sends a live weekly-progress card (not plain text) into the private conversation.
  const sendToTherapist = async () => {
    try {
      await postToConversation(child.id, 'parent', { text: '', card: progressCard(child, mine) });
      setSent(true);
    } catch {
      setSent(false);
    }
  };

  const radarPts = radarData
    .map(({ axis, score }) => {
      const v = Math.max(0.08, score ?? 0);
      return `${CX + axis.dx * R * v},${CY + axis.dy * R * v}`;
    })
    .join(' ');

  return (
    <PinGate>
      <Screen scroll>
        <T.H1 style={{ fontSize: 32, marginBottom: 4, color: '#1B3B2B' }}>Progress</T.H1>
        <T.Body style={{ color: colors.inkSoft, fontSize: 15, marginBottom: 16 }}>{first}'s attention journey over time</T.Body>

        {isDemo && <SampleBanner name={first} />}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <Card style={styles.statBox}>
            <Text style={styles.statNum}>{mine.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </Card>
          <Card style={styles.statBox}>
            <Text style={styles.statNum}>{avgAcc === null ? '—' : `${Math.round(avgAcc * 100)}%`}</Text>
            <Text style={styles.statLabel}>Avg accuracy</Text>
          </Card>
          <Card style={styles.statBox}>
            <Text style={styles.statNum}>{starsTotal}</Text>
            <Text style={styles.statLabel}>Stars</Text>
          </Card>
        </View>

        {/* This week + report */}
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>This week</Text>
            <Text style={styles.weekBadge}>
              {week.sessions}/{goal} games
            </Text>
          </View>
          <View style={styles.weekStats}>
            <WeekStat value={`${week.minutes} min`} label="Practice" />
            <WeekStat value={`${week.stars} ⭐`} label="Stars" />
            <WeekStat value={String(week.levelUps.length)} label="Level-ups" />
          </View>
          <View style={{ gap: 6, marginTop: 4 }}>
            {week.skills.map((s) => {
              const g = TRAIN_INFO.find((x) => x.id === s.id)!;
              const d = s.acc !== null && s.prevAcc !== null ? Math.round((s.acc - s.prevAcc) * 100) : null;
              return (
                <View key={s.id} style={styles.weekRow}>
                  <Text style={{ fontSize: 15 }}>{g.icon}</Text>
                  <Text style={styles.weekSkill}>{g.skill}</Text>
                  <Text style={styles.weekAcc}>{s.acc === null ? '—' : `${Math.round(s.acc * 100)}%`}</Text>
                  <Text style={[styles.weekDelta, { color: d === null ? colors.inkMuted : d >= 0 ? '#138A5E' : '#B5533C' }]}>
                    {d === null ? '' : d === 0 ? '=' : d > 0 ? `▲${d}` : `▼${-d}`}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.weekSentence}>{week.sentence}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable style={[styles.btn, { backgroundColor: colors.forest }]} onPress={share} disabled={sharing}>
              {sharing ? <ActivityIndicator color={colors.white} /> : <Feather name="share" size={16} color={colors.white} />}
              <Text style={[styles.btnText, { color: colors.white }]}>Share report</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: '#EEF4EF' }]} onPress={sendToTherapist} disabled={sent}>
              <Feather name={sent ? 'check' : 'send'} size={16} color={colors.forest} />
              <Text style={[styles.btnText, { color: colors.forest }]}>{sent ? 'Sent' : 'Send to therapist'}</Text>
            </Pressable>
          </View>
        </Card>

        {/* Radar */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Attention profile</Text>
          <Text style={styles.caption}>Average of the last 6 games per skill. A snapshot, not a diagnosis.</Text>
          <View style={{ alignItems: 'center', marginVertical: 6 }}>
            <Svg width={280} height={225}>
              {[0.25, 0.5, 0.75, 1].map((k) => (
                <Polygon
                  key={k}
                  points={`${CX},${CY - R * k} ${CX + R * k},${CY} ${CX},${CY + R * k} ${CX - R * k},${CY}`}
                  fill="none"
                  stroke="#E6ECE3"
                  strokeWidth={1}
                />
              ))}
              <Line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#E6ECE3" strokeWidth={1} />
              <Line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#E6ECE3" strokeWidth={1} />
              <Polygon points={radarPts} fill="#2E694D30" stroke="#2E694D" strokeWidth={2} />
              {radarData.map(({ axis, score, color }, i) => (
                <Circle
                  key={i}
                  cx={CX + axis.dx * R * Math.max(0.08, score ?? 0)}
                  cy={CY + axis.dy * R * Math.max(0.08, score ?? 0)}
                  r={4}
                  fill={score === null ? '#fff' : color}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={score === null ? '2,2' : undefined}
                />
              ))}
              {AXES.map((a) => (
                <SvgText key={a.label} x={CX + a.lx} y={CY + a.ly} fontSize="12" fill="#58685C" textAnchor={a.anchor} fontWeight="bold">
                  {a.label}
                </SvgText>
              ))}
            </Svg>
          </View>
          <View style={styles.chips}>
            {skillScores.map(({ g, score }) => (
              <Pressable
                key={g.id}
                style={[styles.chip, { backgroundColor: g.tint }]}
                onPress={() => nav.navigate('SkillDetail', { childId: child.id, taskId: g.id })}
              >
                <Text style={styles.chipText}>
                  {g.icon} {score === null ? 'Not played' : `${Math.round(score * 100)}%`}
                </Text>
                <Feather name="chevron-right" size={14} color={colors.inkSoft} />
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Trend */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Accuracy trend</Text>
          <LineChart data={trend} max={100} ticks={[0, 25, 50, 75, 100]} height={150} />
        </Card>

        {/* Recent sessions */}
        <T.H3 style={{ fontSize: 20, color: '#1B3B2B', marginTop: 8, marginBottom: 12 }}>Recent sessions</T.H3>
        <View style={{ gap: 10, paddingBottom: 60 }}>
          {mine.slice(0, 12).map((s) => {
            const acc = sessionAccuracy(s);
            const single = s.blocks.length === 1 ? s.blocks[0] : null;
            const shown = single ? taskDisplay(single.taskId) : { title: 'Mixed session', icon: '🌱' };
            const stars = starsFor(acc);
            return (
              <Card
                key={s.id}
                onPress={() => nav.navigate('SessionDetail', { sessionId: s.id, childId: child.id })}
                style={[styles.row, { padding: 14, borderRadius: 20 }]}
              >
                <View style={styles.sessionIcon}>
                  <Text style={{ fontSize: 24 }}>{shown.icon}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.ink }}>{shown.title}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>
                    {shortDate(s.startedAt)} · {s.activeSec}s
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.ink }}>
                    {acc === null ? '—' : `${Math.round(acc * 100)}%`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                    {[1, 2, 3].map((i) => (
                      <Text key={i} style={{ fontSize: 12, opacity: i <= stars ? 1 : 0.2 }}>
                        ⭐
                      </Text>
                    ))}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </Screen>
    </PinGate>
  );
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.weekStat}>
      <Text style={styles.weekStatValue}>{value}</Text>
      <Text style={styles.weekStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20 },
  statNum: { fontFamily: font.bold, fontSize: 22, color: colors.ink, marginBottom: 2 },
  statLabel: { fontFamily: font.medium, fontSize: 12, color: colors.inkMuted },
  card: { padding: 18, borderRadius: 24, marginBottom: 16 },
  cardTitle: { fontFamily: font.bold, fontSize: 18, color: '#1B3B2B' },
  caption: { fontFamily: font.regular, fontSize: 13, color: colors.inkMuted, marginTop: 4 },
  weekBadge: { fontFamily: font.bold, fontSize: 13, color: colors.forest, backgroundColor: '#E4EDE0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  weekStats: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  weekStat: { flex: 1, backgroundColor: '#F6F5F1', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  weekStatValue: { fontFamily: font.heavy, fontSize: 16, color: colors.ink },
  weekStatLabel: { fontFamily: font.medium, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekSkill: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.inkSoft },
  weekAcc: { fontFamily: font.bold, fontSize: 14, color: colors.ink, minWidth: 40, textAlign: 'right' },
  weekDelta: { fontFamily: font.bold, fontSize: 12, minWidth: 34, textAlign: 'right' },
  weekSentence: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 12, lineHeight: 19 },
  btn: { flex: 1, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnText: { fontFamily: font.bold, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  sessionIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F8F6F2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
});
