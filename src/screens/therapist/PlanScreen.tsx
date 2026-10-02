import { Feather } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Button, Card, Screen, SectionHeader, T, TaskIcon } from '../../components/ui';
import { taskLevel } from '../../engine/adaptive';
import { BASE_PARAMS, DOMAIN_LABEL, TASKS, TASK_ORDER } from '../../engine/tasks';
import type { TabParamList } from '../../navigation/types';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import { firstName } from '../helpers';
import { BAND_LABEL, personalize, type Suggestion } from '../../engine/personalize';
import { TRAIN_BY_ID, type TrainTaskId } from '../../engine/trainTasks';
import { TEMPLATE } from '../../engine/studio';
import { uid } from '../../store/seed';
import type { CustomActivity, Dim } from '../../types';

export default function PlanScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<TabParamList, 'Plan'>>();
  const children = useStore((s) => s.children);
  const updateChild = useStore((s) => s.updateChild);
  const setTaskEnabled = useStore((s) => s.setTaskEnabled);
  const setTaskParam = useStore((s) => s.setTaskParam);
  const setPrefs = useStore((s) => s.setPrefs);
  const calmMode = useStore((s) => s.calmMode);
  const sessions = useStore((s) => s.sessions);
  const [applied, setApplied] = useState<string | null>(null);
  const [childId, setChildId] = useState(route.params?.childId ?? children[0]?.id);
  const child = children.find((c) => c.id === childId) ?? children[0];
  const [homeNote, setHomeNote] = useState(child?.homeNote ?? '');
  const saveCustomActivity = useStore((s) => s.saveCustomActivity);

  const copyActivity = (a: CustomActivity) => {
    const others = children.filter((c) => c.id !== child.id);
    if (others.length === 0) {
      Alert.alert('No other children', 'Add another child first to copy this activity to them.');
      return;
    }
    const doCopy = (targetId: string) => {
      const t = children.find((c) => c.id === targetId);
      if (!t) return;
      saveCustomActivity(t.id, {
        ...a,
        id: uid(),
        createdAt: new Date().toISOString(),
        ...(a.studio ? { studio: { ...a.studio, streak: 0 } } : {}),
      });
      setApplied(`Copied to ${firstName(t.name)}`);
      setTimeout(() => setApplied(null), 2200);
    };
    if (Platform.OS === 'web' && others.length >= 1) {
      doCopy(others[0].id);
      return;
    }
    const buttons = [
      { text: 'Cancel', style: 'cancel' as const },
      ...others.map((c) => ({
        text: firstName(c.name),
        onPress: () => doCopy(c.id),
      })),
    ];
    Alert.alert('Copy to which child?', '', buttons as any);
  };

  useEffect(() => {
    if (route.params?.childId) setChildId(route.params.childId);
  }, [route.params?.childId]);
  useEffect(() => setHomeNote(child?.homeNote ?? ''), [child?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!child) {
    return (
      <Screen>
        <T.Display>Activity plan</T.Display>
        <T.Body style={{ marginVertical: 12 }}>Add a child first, then shape their plan here.</T.Body>
        <Button label="Add a child" icon="plus" onPress={() => nav.navigate('EditChild', {})} />
      </Screen>
    );
  }

  const first = firstName(child.name);
  const plan = personalize(child, calmMode);
  const hasProfile = child.iqScore != null || child.cognitiveAge != null || !!child.diagnosis?.length || !!child.favouriteCharacters?.length || !!child.communicationStyle;
  const customs = child.customActivities ?? [];
  const weekStart = Date.now() - 7 * 86_400_000;
  const playedThisWeek = (taskId: string) =>
    sessions.filter((s) => s.childId === child.id && Date.parse(s.startedAt) > weekStart && s.blocks.some((b) => b.taskId === taskId)).length;

  const apply = (s: Suggestion) => {
    const c = s.change;
    if (!c) return;
    if (c.childPatch) updateChild(child.id, c.childPatch);
    if (c.calmMode) setPrefs({ calmMode: true });
    for (const [id, patch] of Object.entries(c.params ?? {}) as [TrainTaskId, Partial<Record<Dim, number>>][]) {
      for (const [dim, value] of Object.entries(patch) as [Dim, number][]) setTaskParam(child.id, id, dim, value);
    }
    setApplied(s.title);
    setTimeout(() => setApplied(null), 2500);
  };

  const enabledCount = TASK_ORDER.filter((id) => child.tasks[id]?.enabled && TASKS[id].scored).length;

  return (
    <Screen>
      <T.Eyebrow>A few good ways to grow</T.Eyebrow>
      <T.Display>Activity plan</T.Display>
      <T.Body style={{ marginTop: 6 }}>Choose a child, then shape a session that fits.</T.Body>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
        {children.map((c) => (
          <Card key={c.id} selected={c.id === child.id} onPress={() => setChildId(c.id)} style={styles.childChip}>
            <Avatar name={c.name} color={c.color} photo={c.photo} emoji={c.avatarEmoji} size={44} />
            <Text style={styles.childChipText}>{firstName(c.name)}</Text>
          </Card>
        ))}
      </ScrollView>

      {/* Personalised plan from the learning profile */}
      <View style={styles.personal}>
        <View style={[styles.row, { gap: 10 }]}>
          <Text style={{ fontSize: 22 }}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.personalTitle}>Personalised for {first}</Text>
            <Text style={styles.personalSub}>
              {BAND_LABEL[plan.band]} pitch · working age {plan.effectiveAge}
              {child.favouriteCharacters?.length ? ` · ${child.favouriteCharacters.map((c) => c.emoji).join(' ')}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => nav.navigate('EditChild', { childId: child.id })} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit learning profile">
            <Text style={styles.link}>{hasProfile ? 'Edit profile' : 'Add profile'}</Text>
          </Pressable>
        </View>
        {!hasProfile && (
          <Text style={styles.personalHint}>
            Add {first}’s developmental age, support profile, sensory needs and favourite characters to get tailored suggestions.
          </Text>
        )}
        {plan.suggestions.map((s) => (
          <View key={s.id} style={styles.suggestion}>
            <Text style={styles.suggestionIcon}>{s.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionTitle}>{s.title}</Text>
              <Text style={styles.suggestionDetail}>{s.detail}</Text>
              <Text style={styles.suggestionWhy}>{s.why}</Text>
            </View>
            {s.change ? (
              <Pressable onPress={() => apply(s)} style={styles.applyBtn} accessibilityRole="button" accessibilityLabel={`Apply: ${s.title}`}>
                <Text style={styles.applyText}>Apply</Text>
              </Pressable>
            ) : s.games ? (
              <Pressable
                onPress={() => nav.navigate('ActivityBuilder', { childId: child.id })}
                style={styles.applyBtn}
                accessibilityRole="button"
                accessibilityLabel="Create an activity from these games"
              >
                <Text style={styles.applyText}>Create</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {!!applied && (
          <View style={styles.toast}>
            <Feather name="check" size={14} color={colors.white} />
            <Text style={styles.toastText}>Applied: {applied}</Text>
          </View>
        )}
      </View>

      {/* Therapist-built home activities */}
      <SectionHeader title="Custom home activities" subtitle={`Built for ${first} with their favourite characters. Families see these first.`} />
      <View style={{ gap: 10 }}>
        {customs.map((a) => {
          const g = TRAIN_BY_ID[a.taskId as TrainTaskId];
          const done = playedThisWeek(a.taskId);
          const isStudio = !!a.studio;
          const meta = isStudio ? TEMPLATE[a.studio!.content.template] : null;
          const tint = meta?.tint ?? g?.tint ?? colors.sage;
          const icon = meta?.icon ?? g?.icon ?? '🌱';
          const skill = isStudio ? 'Game Studio' : (g?.skill ?? 'Activity');
          return (
            <Card
              key={a.id}
              onPress={() => {
                if (isStudio) nav.navigate('GameStudio', { childId: child.id, activityId: a.id });
                else nav.navigate('ActivityBuilder', { childId: child.id, activityId: a.id });
              }}
              style={[styles.row, { gap: 12 }]}
            >
              <View style={[styles.customIcon, { backgroundColor: tint }]}>
                <Text style={{ fontSize: 24 }}>{icon}</Text>
                {!!a.hero && (
                  <View style={styles.customHero}>
                    <Text style={{ fontSize: 13 }}>{a.hero.emoji}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <T.H3 style={{ fontSize: 16 }}>{a.name}</T.H3>
                <T.Small style={{ marginTop: 2 }}>
                  {skill} · {a.adaptive ? 'Adaptive' : 'Fixed level'} · {a.timesPerWeek === 7 ? 'Daily' : `${a.timesPerWeek}× a week`}
                </T.Small>
                <View style={styles.weekTrack}>
                  <View style={[styles.weekFill, { width: `${Math.min(1, done / Math.max(1, a.timesPerWeek)) * 100}%` }]} />
                </View>
                <T.Small style={{ marginTop: 4 }}>
                  {done >= a.timesPerWeek
                    ? `Goal met · played ${done}× in the last 7 days`
                    : `${done}/${a.timesPerWeek} played in the last 7 days`}
                </T.Small>
              </View>
              <Pressable
                onPress={(e) => { e.stopPropagation(); copyActivity(a); }}
                style={styles.copyBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Copy ${a.name} to another child`}
              >
                <Feather name="copy" size={15} color={colors.forest} />
              </Pressable>
              <Feather name="chevron-right" size={18} color={colors.inkMuted} />
            </Card>
          );
        })}
        <Button label="Create a custom activity" icon="plus" variant="soft" onPress={() => nav.navigate('ActivityBuilder', { childId: child.id })} />
        <Button label="Create a Game Studio game (with images)" icon="image" variant="soft" onPress={() => nav.navigate('GameStudio', { childId: child.id })} style={{ marginTop: 8 }} />
      </View>

      <View style={styles.dark}>
        <View style={[styles.row, { gap: 14 }]}>
          <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.darkEyebrow}>MAXIMUM SESSION LENGTH</Text>
            <Text style={styles.darkTitle}>{first}’s plan</Text>
          </View>
          <Feather name="clock" size={24} color={colors.lime} />
        </View>
        <View style={[styles.row, { gap: 10, marginTop: 18 }]}>
          {[10, 15, 20].map((m) => (
            <Pressable key={m} onPress={() => updateChild(child.id, { sessionMinutes: m, currentMinutes: Math.min(child.currentMinutes, m) })} style={[styles.len, child.sessionMinutes === m && { backgroundColor: colors.lime }]}>
              <Text style={[styles.lenText, child.sessionMinutes === m && { color: colors.forestDeep }]}>{m} min</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.darkNote}>
          Now {child.currentMinutes} min. Grows a minute at a time while {first} stays engaged and accurate; eases back when attention slips.
        </Text>
      </View>

      <SectionHeader title="Choose activities" subtitle={`${enabledCount} scored ${enabledCount === 1 ? 'activity' : 'activities'} in each session. The engine puts the weakest area first and gives it the most turns.`} />
      <View style={{ gap: 12 }}>
        {TASK_ORDER.map((id) => {
          const t = TASKS[id];
          const state = child.tasks[id] ?? { enabled: false, params: { ...BASE_PARAMS, ...t.defaults }, locked: [], streak: 0 };
          const on = state.enabled;
          const ageOk = child.age >= t.ages[0] && child.age <= t.ages[1];
          return (
            <Card key={id} selected={on} onPress={() => setTaskEnabled(child.id, id, !on)}>
              <View style={[styles.row, { gap: 14, alignItems: 'flex-start' }]}>
                <TaskIcon icon={t.icon} tint={t.tint} size={60} />
                <View style={{ flex: 1 }}>
                  <T.H3 style={{ fontSize: 19 }}>{t.name}</T.H3>
                  <T.Body style={{ marginTop: 2 }}>{t.tagline}</T.Body>
                  <T.Small style={{ marginTop: 6 }}>
                    {DOMAIN_LABEL[t.domain]}
                    {t.scored ? ` · Level ${taskLevel(t, state.params)}` : ' · not scored'}
                  </T.Small>
                </View>
                <View style={[styles.check, on && { backgroundColor: colors.forest, borderColor: colors.forest }]}>
                  {on && <Feather name="check" size={18} color={colors.white} />}
                </View>
              </View>
              <T.Body style={{ marginTop: 12, fontSize: 14 }}>{t.description}</T.Body>
              <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
                <View style={[styles.age, { backgroundColor: t.tint }]}>
                  <Text style={styles.ageText}>
                    Ages {t.ages[0]}–{t.ages[1]}
                  </Text>
                </View>
                {!ageOk && <T.Small>Outside the usual age range for {first}</T.Small>}
              </View>
            </Card>
          );
        })}
      </View>

      <Button label="Fine-tune adaptive settings" icon="sliders" variant="soft" onPress={() => nav.navigate('Tuning', { childId: child.id })} style={{ marginTop: 16 }} />

      <SectionHeader title="Home practice" subtitle="What parents see on their Home screen." />
      <Card>
        <T.H3>Sessions per week at home</T.H3>
        <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
          {[0, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => updateChild(child.id, { homeSessionsPerWeek: n })} style={[styles.pill, child.homeSessionsPerWeek === n && { backgroundColor: colors.forest }]}>
              <Text style={[styles.pillText, child.homeSessionsPerWeek === n && { color: colors.white }]}>{n === 0 ? 'Off' : n}</Text>
            </Pressable>
          ))}
        </View>
        <T.H3 style={{ marginTop: 20 }}>Guidance for parents</T.H3>
        <TextInput
          value={homeNote}
          onChangeText={setHomeNote}
          onEndEditing={() => updateChild(child.id, { homeNote: homeNote.trim() })}
          onBlur={() => updateChild(child.id, { homeNote: homeNote.trim() })}
          placeholder="e.g. Two short rounds after school, before screen time."
          placeholderTextColor={colors.inkMuted}
          multiline
          style={styles.input}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  childChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 22 },
  childChipText: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, marginRight: 6 },
  dark: { backgroundColor: colors.forestDeep, borderRadius: 30, padding: 20, marginTop: 18 },
  darkEyebrow: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.8, color: '#BFD0C3' },
  darkTitle: { fontFamily: font.bold, fontSize: 22, color: colors.white, marginTop: 4 },
  len: { flex: 1, height: 52, borderRadius: 18, backgroundColor: '#35574A', alignItems: 'center', justifyContent: 'center' },
  darkNote: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: '#C9D8CD', marginTop: 14 },
  lenText: { fontFamily: font.semibold, fontSize: 16, color: colors.white },
  check: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  age: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  ageText: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  personal: { marginTop: 18, padding: 16, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 12 },
  personalTitle: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  personalSub: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  personalHint: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  link: { fontFamily: font.semibold, fontSize: 13, color: colors.forest },
  suggestion: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  suggestionIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  suggestionTitle: { fontFamily: font.semibold, fontSize: 14.5, color: colors.ink },
  suggestionDetail: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: 2 },
  suggestionWhy: { fontFamily: font.medium, fontSize: 11.5, color: colors.inkMuted, marginTop: 4 },
  applyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.forest },
  applyText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },
  copyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.forest },
  toastText: { fontFamily: font.medium, fontSize: 12.5, color: colors.white },
  customIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  customHero: { position: 'absolute', right: -6, bottom: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  weekTrack: { height: 5, borderRadius: 3, backgroundColor: colors.sage, marginTop: 8, overflow: 'hidden' },
  weekFill: { height: 5, borderRadius: 3, backgroundColor: colors.leaf },
  pill: { minWidth: 52, height: 44, borderRadius: 22, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  pillText: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  input: {
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 10,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
