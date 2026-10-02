import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Screen, T, TopBar } from '../../components/ui';
import { taskLevel } from '../../engine/adaptive';
import { CHARACTER_PRESETS, fitBand, paramsForBand, BAND_LABEL } from '../../engine/personalize';
import { BASE_PARAMS, DIM_LABEL, DIM_STEPS, TASKS, formatDim } from '../../engine/tasks';
import { gameDurationSec, trainTaskDef, type TrainTaskId } from '../../engine/trainTasks';
import { TRAIN_GAMES, TRAIN_GAME } from '../../games/train/meta';
import type { RootProps } from '../../navigation/types';
import { postToConversation } from '../../services/messaging';
import { SUPPORT_LEVELS, type SupportLevel } from '../../services/noteCards';
import { uid } from '../../store/seed';
import { useChild, useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import type { Character, CustomActivity, Dim, Params } from '../../types';
import { firstName } from '../helpers';

const INSTRUCTION_IDEAS = [
  'Sit together for the first round.',
  'Stop while it still feels fun.',
  'Celebrate every try, not just wins.',
  'Play after a snack, not before bed.',
];

/** Therapist builds a personalised home activity on top of a Train game. */
export default function ActivityBuilderScreen({ route, navigation }: RootProps<'ActivityBuilder'>) {
  const { childId, activityId } = route.params;
  const child = useChild(childId);
  const saveCustomActivity = useStore((s) => s.saveCustomActivity);
  const removeCustomActivity = useStore((s) => s.removeCustomActivity);
  const existing = child?.customActivities?.find((a) => a.id === activityId);

  const [taskId, setTaskId] = useState<TrainTaskId>((existing?.taskId as TrainTaskId) ?? 'starWatch');
  const [name, setName] = useState(existing?.name ?? '');
  const [hero, setHero] = useState<Character | undefined>(existing?.hero ?? child?.favouriteCharacters?.[0]);
  const [adaptive, setAdaptive] = useState(existing?.adaptive ?? true);
  const [params, setParams] = useState<Params>(existing?.params ?? child?.tasks[taskId]?.params ?? BASE_PARAMS);
  const [support, setSupport] = useState<SupportLevel | undefined>(existing?.supportLevel);
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [perWeek, setPerWeek] = useState(existing?.timesPerWeek ?? 3);
  const [saving, setSaving] = useState(false);

  const fit = useMemo(() => (child ? fitBand(child) : null), [child]);
  if (!child) return null;
  const first = firstName(child.name);
  const game = TRAIN_GAME[taskId];
  const autoName = `${hero ? `${hero.name}’s ` : ''}${game.title}`;
  const finalName = name.trim() || autoName;
  const dims = (TASKS[taskId].dims as Dim[]).filter((d) => !(d === 'durationSec' && ['memoryEcho', 'memoryMatrix', 'followSteps'].includes(taskId)));
  const level = taskLevel(trainTaskDef(taskId), adaptive ? child.tasks[taskId]?.params ?? BASE_PARAMS : params);
  const minutes = Math.max(1, Math.round(gameDurationSec(taskId, adaptive ? child.tasks[taskId]?.params ?? BASE_PARAMS : params) / 60));
  const heroes = [...(child.favouriteCharacters ?? []), ...CHARACTER_PRESETS.filter((p) => !child.favouriteCharacters?.some((f) => f.emoji === p.emoji))];

  const pickGame = (id: TrainTaskId) => {
    setTaskId(id);
    setParams(child.tasks[id]?.params ?? BASE_PARAMS);
  };

  const step = (dim: Dim, dir: 1 | -1) => {
    const ladder = DIM_STEPS[dim];
    const i = Math.max(0, ladder.indexOf(params[dim]));
    const next = ladder[Math.min(ladder.length - 1, Math.max(0, i + dir))];
    setParams({ ...params, [dim]: next });
  };

  const usePersonalised = () => {
    if (!fit) return;
    const band = fit.band === 'typical' || fit.band === 'stretch' ? 'typical' : fit.band;
    setParams({ ...params, ...(band === 'typical' ? {} : paramsForBand(params, band, !!child.sensory?.busyScreens)) });
  };

  const build = (): CustomActivity => ({
    id: existing?.id ?? uid(),
    taskId,
    name: finalName.slice(0, 40),
    ...(hero ? { hero } : {}),
    instructions: instructions.trim().slice(0, 300),
    ...(support ? { supportLevel: support } : {}),
    timesPerWeek: perWeek,
    adaptive,
    params,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });

  const save = async (send: boolean) => {
    const activity = build();
    saveCustomActivity(child.id, activity);
    if (send) {
      setSaving(true);
      try {
        await postToConversation(child.id, 'therapist', {
          text: activity.instructions,
          card: {
            type: 'activity',
            taskId,
            level,
            minutes,
            frequency: `${perWeek}× a week`,
            ...(support ? { supportLevel: support } : {}),
            customId: activity.id,
            title: activity.name,
            ...(hero ? { heroEmoji: hero.emoji } : {}),
          },
        });
      } catch {
        Alert.alert('Saved, but not sent', 'The activity is saved. Check your connection and send it from Messages.');
      } finally {
        setSaving(false);
      }
    }
    navigation.goBack();
  };

  const remove = () => {
    const doRemove = () => {
      if (existing) removeCustomActivity(child.id, existing.id);
      navigation.goBack();
    };
    if (Platform.OS === 'web') return doRemove();
    Alert.alert('Delete this activity?', 'The family will no longer see it on their Home screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doRemove },
    ]);
  };

  return (
    <Screen>
      <TopBar title={existing ? 'Edit activity' : 'Create activity'} onBack={() => navigation.goBack()} />

      {/* Live preview — what the family will see */}
      <View style={[styles.preview, { backgroundColor: game.tint }]}>
        <View style={styles.previewIcon}>
          <Text style={{ fontSize: 34 }}>{game.icon}</Text>
          {!!hero && (
            <View style={styles.previewHero}>
              <Text style={{ fontSize: 18 }}>{hero.emoji}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.previewKicker, { color: game.color }]}>FOR {first.toUpperCase()} · {game.skill.toUpperCase()}</Text>
          <Text style={styles.previewTitle} numberOfLines={2}>
            {finalName}
          </Text>
          <Text style={styles.previewMeta}>
            Level {level} · ~{minutes} min · {perWeek}× a week · {adaptive ? 'Adaptive' : 'Fixed level'}
          </Text>
        </View>
      </View>

      <Section n={1} title="Choose a game" />
      <View style={styles.games}>
        {TRAIN_GAMES.map((g) => {
          const active = g.id === taskId;
          return (
            <Pressable
              key={g.id}
              onPress={() => pickGame(g.id)}
              style={[styles.game, active && { borderColor: g.color, backgroundColor: g.tint }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ fontSize: 24 }}>{g.icon}</Text>
              <Text style={styles.gameTitle} numberOfLines={1}>
                {g.title}
              </Text>
              <Text style={styles.gameSkill} numberOfLines={1}>
                {g.skill}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Section n={2} title="Hero character" hint={`${first}’s favourites come first. The hero appears in the game and cheers them on.`} />
      <View style={styles.wrap}>
        <Pressable onPress={() => setHero(undefined)} style={[styles.hero, !hero && styles.selected]} accessibilityRole="button">
          <Text style={styles.heroEmoji}>✖️</Text>
          <Text style={styles.heroName}>None</Text>
        </Pressable>
        {heroes.map((h) => {
          const active = hero?.emoji === h.emoji;
          const fav = child.favouriteCharacters?.some((f) => f.emoji === h.emoji);
          return (
            <Pressable key={h.emoji + h.name} onPress={() => setHero(h)} style={[styles.hero, active && styles.selected]} accessibilityRole="button" accessibilityState={{ selected: active }}>
              <Text style={styles.heroEmoji}>{h.emoji}</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {h.name}
              </Text>
              {fav && <Text style={styles.fav}>♥</Text>}
            </Pressable>
          );
        })}
      </View>

      <Section n={3} title="Name" />
      <TextInput value={name} onChangeText={setName} placeholder={autoName} placeholderTextColor={colors.inkMuted} style={styles.input} maxLength={40} />

      <Section n={4} title="Difficulty" />
      <View style={styles.segment}>
        {[
          { v: true, label: 'Adaptive', hint: 'Grows with the child' },
          { v: false, label: 'Fixed', hint: 'Always this level' },
        ].map((o) => (
          <Pressable key={o.label} onPress={() => setAdaptive(o.v)} style={[styles.segmentItem, adaptive === o.v && styles.segmentActive]} accessibilityRole="button">
            <Text style={[styles.segmentLabel, adaptive === o.v && { color: colors.forest }]}>{o.label}</Text>
            <Text style={styles.segmentHint}>{o.hint}</Text>
          </Pressable>
        ))}
      </View>
      {!adaptive && (
        <View style={styles.card}>
          {dims.map((d) => (
            <View key={d} style={styles.dimRow}>
              <Text style={styles.dimLabel}>{TASKS[taskId].dimLabels?.[d] ?? DIM_LABEL[d]}</Text>
              <Pressable onPress={() => step(d, -1)} style={styles.stepBtn} accessibilityLabel={`Lower ${DIM_LABEL[d]}`}>
                <Feather name="minus" size={16} color={colors.forest} />
              </Pressable>
              <Text style={styles.dimValue}>{formatDim(d, params[d])}</Text>
              <Pressable onPress={() => step(d, 1)} style={styles.stepBtn} accessibilityLabel={`Raise ${DIM_LABEL[d]}`}>
                <Feather name="plus" size={16} color={colors.forest} />
              </Pressable>
            </View>
          ))}
          {fit && (fit.band === 'extra-support' || fit.band === 'support') && (
            <Pressable onPress={usePersonalised} style={styles.personal} accessibilityRole="button">
              <Feather name="user-check" size={15} color={colors.forest} />
              <Text style={styles.personalText}>Use {BAND_LABEL[fit.band].toLowerCase()} level from {first}’s profile</Text>
            </Pressable>
          )}
        </View>
      )}

      <Section n={5} title="Support level" />
      <View style={{ gap: 8 }}>
        {SUPPORT_LEVELS.map((l) => (
          <Pressable key={l.value} onPress={() => setSupport(support === l.value ? undefined : l.value)} style={[styles.option, support === l.value && styles.selected]} accessibilityRole="button">
            <Text style={{ fontSize: 20 }}>{l.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{l.label}</Text>
              <Text style={styles.optionHint}>{l.hint}</Text>
            </View>
            {support === l.value && <Feather name="check-circle" size={18} color={colors.forest} />}
          </Pressable>
        ))}
      </View>

      <Section n={6} title="Instructions for the family" />
      <TextInput
        value={instructions}
        onChangeText={setInstructions}
        placeholder={game.tip ?? 'How should the family set this up?'}
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, styles.multiline]}
        multiline
        maxLength={300}
      />
      <View style={[styles.wrap, { marginTop: 8 }]}>
        {INSTRUCTION_IDEAS.map((idea) => (
          <Pressable key={idea} onPress={() => setInstructions((t) => (t.includes(idea) ? t : `${t.trim()} ${idea}`.trim()))} style={styles.idea} accessibilityRole="button">
            <Text style={styles.ideaText}>+ {idea}</Text>
          </Pressable>
        ))}
      </View>

      <Section n={7} title="Times per week" />
      <View style={styles.wrap}>
        {[1, 2, 3, 4, 5, 7].map((n) => (
          <Pressable key={n} onPress={() => setPerWeek(n)} style={[styles.pill, perWeek === n && styles.pillActive]} accessibilityRole="button">
            <Text style={[styles.pillText, perWeek === n && { color: colors.white }]}>{n === 7 ? 'Daily' : `${n}×`}</Text>
          </Pressable>
        ))}
      </View>

      <Button label={saving ? 'Sending…' : 'Save & send to family'} icon="send" disabled={saving} onPress={() => void save(true)} style={{ marginTop: 28 }} />
      <Button label="Save only" icon="check" variant="soft" disabled={saving} onPress={() => void save(false)} style={{ marginTop: 10 }} />
      {existing && <Button label="Delete activity" icon="trash-2" variant="danger" onPress={remove} style={{ marginTop: 10 }} />}
      <T.Small style={{ textAlign: 'center', marginTop: 14 }}>The family sees this on their Home screen under “From your therapist”.</T.Small>
    </Screen>
  );
}

function Section({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <View style={{ marginTop: 26, marginBottom: 10 }}>
      <View style={styles.sectionRow}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumText}>{n}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {!!hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, marginTop: 8 },
  previewIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  previewHero: { position: 'absolute', right: -8, bottom: -8, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  previewKicker: { fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.8 },
  previewTitle: { fontFamily: font.heavy, fontSize: 19, color: colors.ink, marginTop: 2 },
  previewMeta: { fontFamily: font.medium, fontSize: 12.5, color: colors.inkSoft, marginTop: 3 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: font.bold, fontSize: 12, color: colors.white },
  sectionTitle: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  sectionHint: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 4, marginLeft: 34 },
  games: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  game: { width: '31.5%', padding: 10, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', gap: 2 },
  gameTitle: { fontFamily: font.semibold, fontSize: 12, color: colors.ink, marginTop: 4 },
  gameSkill: { fontFamily: font.regular, fontSize: 10.5, color: colors.inkMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hero: { width: 70, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  heroEmoji: { fontSize: 26 },
  heroName: { fontFamily: font.medium, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  fav: { position: 'absolute', top: 3, right: 6, fontSize: 11, color: colors.danger },
  selected: { borderColor: colors.forest, backgroundColor: colors.mint },
  input: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 12, fontFamily: font.regular, fontSize: 16, color: colors.ink },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  segmentActive: { borderColor: colors.forest, backgroundColor: colors.mint },
  segmentLabel: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  segmentHint: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  card: { marginTop: 10, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 12 },
  dimRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dimLabel: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.ink },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dimValue: { width: 72, textAlign: 'center', fontFamily: font.bold, fontSize: 14, color: colors.ink },
  personal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  personalText: { fontFamily: font.semibold, fontSize: 13, color: colors.forest },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  optionTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  optionHint: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkSoft },
  idea: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.sage },
  ideaText: { fontFamily: font.medium, fontSize: 12, color: colors.forest },
  pill: { minWidth: 56, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.forest },
  pillText: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
});
