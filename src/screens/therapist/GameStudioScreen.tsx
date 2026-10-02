import { Feather } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Screen, T, TopBar } from '../../components/ui';
import { CHARACTER_PRESETS } from '../../engine/personalize';
import { TEMPLATE, levelName } from '../../engine/studio';
import type { RootProps } from '../../navigation/types';
import { postToConversation } from '../../services/messaging';
import { SUPPORT_LEVELS, type SupportLevel } from '../../services/noteCards';
import { uid } from '../../store/seed';
import { useChild, useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import type { Character, CustomActivity, StudioContent, StudioPicture, StudioTemplate } from '../../types';
import { firstName } from '../helpers';

const TEMPLATES: StudioTemplate[] = ['findit', 'sequence', 'listen', 'wordsearch', 'puzzle', 'worksheet'];
const INSTRUCTION_IDEAS = [
  'Try one round first, then take a short break.',
  'Celebrate every try, not just correct answers.',
  'Sit together and model the first round.',
  'Play after a snack, not before bed.',
];
const EMOJI_SUGGESTIONS = [
  '🐶','🐱','🦊','🐻','🦁','🐸','🦄','🐼','🐯','🐨','🐵','🐰','🐙','🐧',
  '🍎','🍌','🍕','🍓','🍰','🚗','🚀','⚽','🎈','🎁','🌟','🌈','❤️','🎵','🌻',
];

async function toDataUri(uri: string, maxW = 720): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: maxW });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read the image');
  return `data:image/jpeg;base64,${out.base64}`;
}

async function pickStudioImage(source: 'library' | 'camera'): Promise<string | null> {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert('Camera off', 'Turn camera access on in Settings.'); return null; }
    } else if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Photos off', 'Turn photo access on in Settings.'); return null; }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 0.85 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return null;
    return await toDataUri(res.assets[0].uri);
  } catch {
    Alert.alert('Could not use that picture', 'Please try another one.');
    return null;
  }
}

export default function GameStudioScreen({ route, navigation }: RootProps<'GameStudio'>) {
  const { childId, activityId } = route.params;
  const child = useChild(childId);
  const saveCustomActivity = useStore((s) => s.saveCustomActivity);
  const removeCustomActivity = useStore((s) => s.removeCustomActivity);
  const existing = child?.customActivities?.find((a) => a.id === activityId);
  const isStudioExisting = existing?.studio != null;
  const role = useStore((s) => s.role) ?? 'therapist';

  const [template, setTemplate] = useState<StudioTemplate>(
    (isStudioExisting ? existing!.studio!.content.template : undefined) ?? 'findit',
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [hero, setHero] = useState<Character | undefined>(existing?.hero ?? child?.favouriteCharacters?.[0]);
  const [level, setLevel] = useState<number>(existing?.studio?.level ?? 3);
  const [autoLevel, setAutoLevel] = useState<boolean>(existing?.studio?.autoLevel ?? true);
  const [support, setSupport] = useState<SupportLevel | undefined>(existing?.supportLevel);
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [perWeek, setPerWeek] = useState(existing?.timesPerWeek ?? 3);
  const [saving, setSaving] = useState(false);
  const [busyImg, setBusyImg] = useState(false);

  const [puzzleImage, setPuzzleImage] = useState<string>(
    isStudioExisting && existing!.studio!.content.template === 'puzzle' ? existing!.studio!.content.image : '',
  );
  const [wsImage, setWsImage] = useState<string>(
    isStudioExisting && existing!.studio!.content.template === 'worksheet' ? existing!.studio!.content.image : '',
  );
  const [wsTask, setWsTask] = useState<string>(
    isStudioExisting && existing!.studio!.content.template === 'worksheet' ? existing!.studio!.content.task : '',
  );
  const [wsWords, setWsWords] = useState<string[]>(
    isStudioExisting && existing!.studio!.content.template === 'wordsearch' ? existing!.studio!.content.words : [],
  );
  const [wsWordInput, setWsWordInput] = useState('');
  const [fiTargetName, setFiTargetName] = useState<string>(
    isStudioExisting && existing!.studio!.content.template === 'findit' ? existing!.studio!.content.targetName : '',
  );
  const [fiTarget, setFiTarget] = useState<StudioPicture | undefined>(
    isStudioExisting && existing!.studio!.content.template === 'findit' ? existing!.studio!.content.target : undefined,
  );
  const [fiOthers, setFiOthers] = useState<StudioPicture[]>(
    isStudioExisting && existing!.studio!.content.template === 'findit' ? existing!.studio!.content.others : [],
  );
  const [fiTargetInput, setFiTargetInput] = useState('');
  const [seqItems, setSeqItems] = useState<{ label: string; emoji?: string }[]>(
    isStudioExisting && existing!.studio!.content.template === 'sequence' ? existing!.studio!.content.items : [],
  );
  const [seqLabelInput, setSeqLabelInput] = useState('');
  const [seqEmojiInput, setSeqEmojiInput] = useState('');
  const [listenTarget, setListenTarget] = useState<string>(
    isStudioExisting && existing!.studio!.content.template === 'listen' ? existing!.studio!.content.target : '',
  );
  const [listenOthers, setListenOthers] = useState<string[]>(
    isStudioExisting && existing!.studio!.content.template === 'listen' ? existing!.studio!.content.others : [],
  );
  const [listenOtherInput, setListenOtherInput] = useState('');

  if (!child) return null;
  const first = firstName(child.name);
  const info = TEMPLATE[template];
  const autoName = `${hero ? `${hero.name}’s ` : ''}${info.name}`;
  const finalName = name.trim() || autoName;
  const heroes = [
    ...(child.favouriteCharacters ?? []),
    ...CHARACTER_PRESETS.filter((p) => !child.favouriteCharacters?.some((f) => f.emoji === p.emoji)),
  ];

  const contentValid = useMemo((): boolean => {
    switch (template) {
      case 'puzzle':     return puzzleImage.length > 0;
      case 'wordsearch': return wsWords.length >= 3;
      case 'worksheet':  return wsImage.length > 0;
      case 'findit':     return !!fiTarget && fiOthers.length >= 3;
      case 'sequence':   return seqItems.length >= 3;
      case 'listen':     return listenTarget.length > 0 && listenOthers.length >= 2;
    }
  }, [template, puzzleImage, wsWords, wsImage, fiTarget, fiOthers, seqItems, listenTarget, listenOthers]);

  function buildContent(): StudioContent | null {
    switch (template) {
      case 'puzzle':     return puzzleImage ? { template: 'puzzle', image: puzzleImage } : null;
      case 'wordsearch': return wsWords.length >= 3 ? { template: 'wordsearch', words: wsWords } : null;
      case 'worksheet':  return wsImage ? { template: 'worksheet', image: wsImage, task: wsTask.trim() } : null;
      case 'findit':     return fiTarget && fiOthers.length >= 3 ? { template: 'findit', targetName: fiTargetName.trim() || 'target', target: fiTarget, others: fiOthers } : null;
      case 'sequence':   return seqItems.length >= 3 ? { template: 'sequence', items: seqItems } : null;
      case 'listen':     return listenTarget && listenOthers.length >= 2 ? { template: 'listen', target: listenTarget.trim(), others: listenOthers } : null;
    }
  }

  const build = (): CustomActivity | null => {
    const content = buildContent();
    if (!content) return null;
    return {
      id: existing?.id ?? uid(),
      taskId: `studio-${template}`,
      studio: { content, level, autoLevel, streak: existing?.studio?.streak ?? 0 },
      name: finalName.slice(0, 40),
      ...(hero ? { hero } : {}),
      instructions: instructions.trim().slice(0, 300),
      ...(support ? { supportLevel: support } : {}),
      timesPerWeek: perWeek,
      adaptive: true,
      params: existing?.params ?? child.tasks.starWatch?.params ?? { durationSec: 180, distractors: 2, speed: 2, memoryLoad: 3, instructionSteps: 2, reinforceEvery: 3 },
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
  };

  const save = async (send: boolean) => {
    const activity = build();
    if (!activity) { Alert.alert('Not ready yet', 'Finish filling in the game content first.'); return; }
    saveCustomActivity(child.id, activity);
    if (send) {
      setSaving(true);
      try {
        await postToConversation(child.id, role, {
          text: activity.instructions,
          card: {
            type: 'activity',
            taskId: activity.taskId,
            level,
            minutes: Math.max(1, Math.round(TEMPLATE[template].levelled ? [4, 5, 6, 7, 8][level - 1] : 6)),
            frequency: `${perWeek}× a week`,
            ...(support ? { supportLevel: support } : {}),
            customId: activity.id,
            title: activity.name,
            ...(hero ? { heroEmoji: hero.emoji } : {}),
            template,
          },
        });
      } catch {
        Alert.alert('Saved, but not sent', 'The game is saved. Check your connection and send it from Messages.');
      } finally { setSaving(false); }
    }
    navigation.goBack();
  };

  const preview = () => {
    const activity = build();
    if (!activity) { Alert.alert('Not ready yet', 'Finish filling in the game content first.'); return; }
    saveCustomActivity(child.id, activity);
    navigation.navigate('StudioPlay', { childId: child.id, activityId: activity.id, preview: true });
  };

  const remove = () => {
    const doRemove = () => { if (existing) removeCustomActivity(child.id, existing.id); navigation.goBack(); };
    if (Platform.OS === 'web') return doRemove();
    Alert.alert('Delete this game?', 'The family will no longer see it on their Home screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doRemove },
    ]);
  };

  const emojiPic = (v: string): StudioPicture => ({ kind: 'emoji', value: v });
  const addWord = () => {
    const w = wsWordInput.trim();
    if (w.length >= 2) { setWsWords([...wsWords, w]); setWsWordInput(''); }
  };

  const pickImage = async (set: (u: string) => void, source: 'library' | 'camera') => {
    setBusyImg(true);
    try {
      const u = await pickStudioImage(source);
      if (u) set(u);
    } finally { setBusyImg(false); }
  };

  return (
    <Screen>
      <TopBar title={isStudioExisting ? 'Edit Game Studio' : 'Game Studio'} onBack={() => navigation.goBack()} />

      <View style={[styles.preview, { backgroundColor: info.tint }]}>
        <View style={styles.previewIcon}>
          <Text style={{ fontSize: 34 }}>{info.icon}</Text>
          {hero && (
            <View style={styles.previewHero}>
              <Text style={{ fontSize: 18 }}>{hero.emoji}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.previewKicker, { color: info.color }]}>FOR {first.toUpperCase()} · {info.skill.toUpperCase()}</Text>
          <Text style={styles.previewTitle} numberOfLines={2}>{finalName}</Text>
          <Text style={styles.previewMeta}>
            {info.levelled ? `${levelName(level)} (${level}/5)` : 'No level'} · ~5–10 min · {perWeek}× a week
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Section n={1} title="Choose a game type" hint="Pick the type of custom game you want to build for this child." />
        <View style={styles.games}>
          {TEMPLATES.map((t) => {
            const g = TEMPLATE[t];
            const active = t === template;
            return (
              <Pressable
                key={t}
                onPress={() => setTemplate(t)}
                style={[styles.game, active && { borderColor: g.color, backgroundColor: g.tint }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ fontSize: 24 }}>{g.icon}</Text>
                <Text style={styles.gameTitle} numberOfLines={1}>{g.name}</Text>
                <Text style={styles.gameSkill} numberOfLines={1}>{g.skill}</Text>
              </Pressable>
            );
          })}
        </View>

        <Section n={2} title="Hero character" hint={`${first}’s favourites come first.`} />
        <View style={styles.wrap}>
          <Pressable onPress={() => setHero(undefined)} style={[styles.hero, !hero && styles.selected]} accessibilityRole="button">
            <Text style={styles.heroEmoji}>✖️</Text>
            <Text style={styles.heroName}>None</Text>
          </Pressable>
          {heroes.map((h) => {
            const active = hero?.emoji === h.emoji;
            const fav = child.favouriteCharacters?.some((f) => f.emoji === h.emoji);
            return (
              <Pressable
                key={h.emoji + h.name}
                onPress={() => setHero(h)}
                style={[styles.hero, active && styles.selected]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.heroEmoji}>{h.emoji}</Text>
                <Text style={styles.heroName} numberOfLines={1}>{h.name}</Text>
                {fav && <Text style={styles.fav}>♥</Text>}
              </Pressable>
            );
          })}
        </View>

        <Section n={3} title="Name" />
        <TextInput value={name} onChangeText={setName} placeholder={autoName} placeholderTextColor={colors.inkMuted} style={styles.input} maxLength={40} />

        <Section n={4} title="Game content" hint={info.tip} />

        {template === 'puzzle' && (
          <View style={styles.card}>
            <T.Body>Upload a photo and it becomes a jigsaw. Bigger level = more pieces.</T.Body>
            <ImageButtons onLibrary={() => pickImage(setPuzzleImage, 'library')} onCamera={() => pickImage(setPuzzleImage, 'camera')} />
            {busyImg && <View style={{ alignItems: 'center', marginTop: 12 }}><ActivityIndicator color={colors.forest} /></View>}
            {puzzleImage && !busyImg && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Image source={{ uri: puzzleImage }} style={styles.sampleImage} resizeMode="cover" />
                <T.Small style={{ marginTop: 6 }}>Ready. Use the Preview button below to try the puzzle.</T.Small>
              </View>
            )}
          </View>
        )}

        {template === 'wordsearch' && (
          <View style={styles.card}>
            <T.Body>Add at least 3 words. Letters A–Z only.</T.Body>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput value={wsWordInput} onChangeText={setWsWordInput} placeholder="Type a word…"
                placeholderTextColor={colors.inkMuted} style={[styles.input, { flex: 1 }]}
                autoCapitalize="characters" onSubmitEditing={addWord} />
              <Button label="Add" icon="plus" variant="soft" onPress={addWord} />
            </View>
            <View style={[styles.wrap, { marginTop: 10 }]}>
              {wsWords.map((w, i) => (
                <Pressable key={w + i} onPress={() => setWsWords(wsWords.filter((_, j) => j !== i))} style={styles.wordPill}>
                  <Text style={styles.wordPillText}>{w}</Text>
                  <Feather name="x" size={12} color={colors.inkMuted} />
                </Pressable>
              ))}
            </View>
            <T.Small style={{ marginTop: 10 }}>{wsWords.length} word{wsWords.length === 1 ? '' : 's'} added.</T.Small>
          </View>
        )}

        {template === 'worksheet' && (
          <View style={styles.card}>
            <T.Body>Upload a worksheet photo, then describe what the child should do on it.</T.Body>
            <ImageButtons onLibrary={() => pickImage(setWsImage, 'library')} onCamera={() => pickImage(setWsImage, 'camera')} />
            {busyImg && <View style={{ alignItems: 'center', marginTop: 12 }}><ActivityIndicator color={colors.forest} /></View>}
            {wsImage && !busyImg && <Image source={{ uri: wsImage }} style={[styles.sampleImage, { marginTop: 12 }]} resizeMode="contain" />}
            <T.Body style={{ marginTop: 14 }}>What should {first} do on it?</T.Body>
            <TextInput value={wsTask} onChangeText={setWsTask} placeholder="e.g. Circle all the triangles."
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, styles.multiline, { marginTop: 10 }]} multiline maxLength={200} />
          </View>
        )}

        {template === 'findit' && (
          <View style={[styles.card, { gap: 14 }]}>
            <View>
              <T.Body style={{ marginBottom: 8 }}>Target — what {first} looks for</T.Body>
              <TextInput value={fiTargetName} onChangeText={setFiTargetName} placeholder="Name it (e.g. Cat)"
                placeholderTextColor={colors.inkMuted} style={styles.input} />
              <View style={[styles.wrap, { marginTop: 10 }]}>
                {EMOJI_SUGGESTIONS.map((e) => (
                  <Pressable key={`t-${e}`}
                    onPress={() => { setFiTarget(emojiPic(e)); setFiTargetName(fiTargetName.trim() || e); }}
                    style={[styles.emojiTile, fiTarget?.kind === 'emoji' && fiTarget.value === e && styles.selected]}
                    accessibilityRole="button">
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput value={fiTargetInput} onChangeText={setFiTargetInput} placeholder="Custom emoji"
                  placeholderTextColor={colors.inkMuted} style={[styles.input, { flex: 1 }]} maxLength={4} />
                <Button label="Use" variant="soft" onPress={() => {
                  if (fiTargetInput.trim()) { setFiTarget(emojiPic(fiTargetInput.trim())); setFiTargetName(fiTargetName.trim() || fiTargetInput.trim()); }
                }} />
              </View>
              <Pressable
                onPress={async () => {
                  const u = await pickStudioImage('library');
                  if (u) { setFiTarget({ kind: 'image', uri: u }); setFiTargetName(fiTargetName.trim() || 'Picture'); }
                }}
                style={[styles.secondaryBtn, { marginTop: 10 }]} accessibilityRole="button">
                <Feather name="image" size={16} color={colors.forest} />
                <Text style={styles.secondaryBtnText}>Use a photo as the target</Text>
              </Pressable>
              {fiTarget && (
                <View style={styles.pickedRow}>
                  {fiTarget.kind === 'emoji' ? <Text style={{ fontSize: 24 }}>{fiTarget.value}</Text> : <Image source={{ uri: fiTarget.uri }} style={{ width: 44, height: 44, borderRadius: 12 }} />}
                  <T.Body>Target set.</T.Body>
                </View>
              )}
            </View>
            <View>
              <T.Body style={{ marginBottom: 8 }}>Other pictures (distractors) — add at least 3</T.Body>
              <View style={[styles.wrap, { marginBottom: 4 }]}>
                {EMOJI_SUGGESTIONS.map((e) => (
                  <Pressable key={`o-${e}`} onPress={() => setFiOthers([...fiOthers, emojiPic(e)])}
                    style={styles.emojiTile} accessibilityRole="button">
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={async () => {
                  const u = await pickStudioImage('library');
                  if (u) setFiOthers([...fiOthers, { kind: 'image', uri: u }]);
                }}
                style={[styles.secondaryBtn, { marginBottom: 10 }]} accessibilityRole="button">
                <Feather name="image" size={16} color={colors.forest} />
                <Text style={styles.secondaryBtnText}>Add a photo distractor</Text>
              </Pressable>
              <View style={styles.wrap}>
                {fiOthers.map((p, i) => (
                  <Pressable key={i} onPress={() => setFiOthers(fiOthers.filter((_, j) => j !== i))} style={styles.emojiTileRemovable}>
                    {p.kind === 'emoji' ? <Text style={{ fontSize: 22 }}>{p.value}</Text> : <Image source={{ uri: p.uri }} style={{ width: 34, height: 34, borderRadius: 8 }} />}
                    <Feather name="x-circle" size={14} color={colors.inkMuted} style={{ position: 'absolute', top: -2, right: -2 }} />
                  </Pressable>
                ))}
              </View>
              <T.Small style={{ marginTop: 8 }}>{fiOthers.length} distractor{fiOthers.length === 1 ? '' : 's'} added.</T.Small>
            </View>
          </View>
        )}

        {template === 'sequence' && (
          <View style={styles.card}>
            <T.Body style={{ marginBottom: 8 }}>Routine or memory steps — add at least 3</T.Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={seqEmojiInput} onChangeText={setSeqEmojiInput} placeholder="🪥"
                placeholderTextColor={colors.inkMuted} style={[styles.input, { width: 70 }]} maxLength={4} />
              <TextInput value={seqLabelInput} onChangeText={setSeqLabelInput} placeholder="e.g. Brush teeth"
                placeholderTextColor={colors.inkMuted} style={[styles.input, { flex: 1 }]} />
              <Button label="Add" icon="plus" variant="soft" onPress={() => {
                if (seqLabelInput.trim()) {
                  setSeqItems([...seqItems, { label: seqLabelInput.trim(), emoji: seqEmojiInput.trim() || undefined }]);
                  setSeqLabelInput(''); setSeqEmojiInput('');
                }
              }} />
            </View>
            <View style={{ marginTop: 12, gap: 6 }}>
              {seqItems.map((it, i) => (
                <View key={i} style={styles.seqItem}>
                  <Text style={styles.seqNum}>{i + 1}</Text>
                  <Text style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{it.emoji ?? '⭐'}</Text>
                  <Text style={{ flex: 1, fontFamily: font.medium, color: colors.ink }}>{it.label}</Text>
                  <Pressable onPress={() => setSeqItems(seqItems.filter((_, j) => j !== i))} hitSlop={8}>
                    <Feather name="x" size={16} color={colors.inkMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {template === 'listen' && (
          <View style={styles.card}>
            <T.Body style={{ marginBottom: 8 }}>Secret word — what {first} listens for</T.Body>
            <TextInput value={listenTarget} onChangeText={setListenTarget} placeholder="e.g. banana"
              placeholderTextColor={colors.inkMuted} style={styles.input} autoCapitalize="none" />
            <T.Body style={{ marginTop: 14, marginBottom: 8 }}>Other words (distractors) — add at least 2</T.Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={listenOtherInput} onChangeText={setListenOtherInput} placeholder="e.g. apple"
                placeholderTextColor={colors.inkMuted} style={[styles.input, { flex: 1 }]} autoCapitalize="none"
                onSubmitEditing={() => { if (listenOtherInput.trim()) { setListenOthers([...listenOthers, listenOtherInput.trim()]); setListenOtherInput(''); } }} />
              <Button label="Add" icon="plus" variant="soft" onPress={() => {
                if (listenOtherInput.trim()) { setListenOthers([...listenOthers, listenOtherInput.trim()]); setListenOtherInput(''); }
              }} />
            </View>
            <View style={[styles.wrap, { marginTop: 10 }]}>
              {listenOthers.map((w, i) => (
                <Pressable key={w + i} onPress={() => setListenOthers(listenOthers.filter((_, j) => j !== i))} style={styles.wordPill}>
                  <Text style={styles.wordPillText}>{w}</Text>
                  <Feather name="x" size={12} color={colors.inkMuted} />
                </Pressable>
              ))}
            </View>
            <T.Small style={{ marginTop: 10 }}>🔊 Words are read aloud by the device’s text-to-speech engine.</T.Small>
          </View>
        )}

        {TEMPLATE[template].levelled && (
          <>
            <Section n={5} title="Difficulty level" hint="Level 1 is easiest. Auto-adjust levels it up after two 3-star plays and down after a 1-star play." />
            <View style={styles.wrap}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setLevel(n)}
                  style={[styles.levelPill, level === n && { backgroundColor: info.color, borderColor: info.color }]}
                  accessibilityRole="button">
                  <Text style={[styles.levelPillText, level === n && { color: colors.white }]}>{levelName(n)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segment, { marginTop: 10 }]}>
              {[
                { v: true,  label: 'Auto-adjust', hint: 'Grows with the child' },
                { v: false, label: 'Fixed level', hint: 'Always this level' },
              ].map((o) => (
                <Pressable key={o.label} onPress={() => setAutoLevel(o.v)}
                  style={[styles.segmentItem, autoLevel === o.v && styles.segmentActive]} accessibilityRole="button">
                  <Text style={[styles.segmentLabel, autoLevel === o.v && { color: info.color }]}>{o.label}</Text>
                  <Text style={styles.segmentHint}>{o.hint}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Section n={6} title="Support level" />
        <View style={{ gap: 8 }}>
          {SUPPORT_LEVELS.map((l) => (
            <Pressable key={l.value} onPress={() => setSupport(support === l.value ? undefined : l.value)}
              style={[styles.option, support === l.value && styles.selected]} accessibilityRole="button">
              <Text style={{ fontSize: 20 }}>{l.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{l.label}</Text>
                <Text style={styles.optionHint}>{l.hint}</Text>
              </View>
              {support === l.value && <Feather name="check-circle" size={18} color={colors.forest} />}
            </Pressable>
          ))}
        </View>

        <Section n={7} title="Instructions for the family" />
        <TextInput value={instructions} onChangeText={setInstructions} placeholder={info.instructions}
          placeholderTextColor={colors.inkMuted} style={[styles.input, styles.multiline]} multiline maxLength={300} />
        <View style={[styles.wrap, { marginTop: 8 }]}>
          {INSTRUCTION_IDEAS.map((idea) => (
            <Pressable key={idea} onPress={() => setInstructions((t) => (t.includes(idea) ? t : `${t.trim()} ${idea}`.trim()))}
              style={styles.idea} accessibilityRole="button">
              <Text style={styles.ideaText}>+ {idea}</Text>
            </Pressable>
          ))}
        </View>

        <Section n={8} title="Times per week" />
        <View style={styles.wrap}>
          {[1, 2, 3, 4, 5, 7].map((n) => (
            <Pressable key={n} onPress={() => setPerWeek(n)}
              style={[styles.pill, perWeek === n && styles.pillActive]} accessibilityRole="button">
              <Text style={[styles.pillText, perWeek === n && { color: colors.white }]}>{n === 7 ? 'Daily' : `${n}×`}</Text>
            </Pressable>
          ))}
        </View>

        <Button label="Preview game" icon="play" variant="soft" onPress={preview} style={{ marginTop: 28 }} disabled={!contentValid} />
        <Button label={saving ? 'Sending…' : 'Save & send to family'} icon="send" disabled={saving || !contentValid}
          onPress={() => void save(true)} style={{ marginTop: 10 }} />
        <Button label="Save only" icon="check" variant="soft" disabled={saving || !contentValid}
          onPress={() => void save(false)} style={{ marginTop: 10 }} />
        {existing && <Button label="Delete game" icon="trash-2" variant="danger" onPress={remove} style={{ marginTop: 10 }} />}
        <T.Small style={{ textAlign: 'center', marginTop: 14 }}>
          {contentValid ? 'The family sees this on their Home screen under “From your therapist”.' : 'Finish the game content above to enable save.'}
        </T.Small>
      </ScrollView>
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
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function ImageButtons({ onLibrary, onCamera }: { onLibrary: () => void; onCamera: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
      <Pressable style={styles.imgBtn} onPress={onLibrary} accessibilityRole="button">
        <Feather name="image" size={18} color={colors.forest} />
        <Text style={styles.imgBtnText}>Choose photo</Text>
      </Pressable>
      {Platform.OS !== 'web' ? (
        <Pressable style={styles.imgBtn} onPress={onCamera} accessibilityRole="button">
          <Feather name="camera" size={18} color={colors.forest} />
          <Text style={styles.imgBtnText}>Take photo</Text>
        </Pressable>
      ) : null}
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
  card: { marginTop: 10, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  optionTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  optionHint: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkSoft },
  idea: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.sage },
  ideaText: { fontFamily: font.medium, fontSize: 12, color: colors.forest },
  pill: { minWidth: 56, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.forest },
  pillText: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  levelPill: { paddingHorizontal: 14, height: 42, borderRadius: 21, backgroundColor: colors.sage, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  levelPillText: { fontFamily: font.semibold, fontSize: 13 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  segmentActive: { borderColor: colors.forest, backgroundColor: colors.mint },
  segmentLabel: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  segmentHint: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  emojiTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emojiTileRemovable: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: colors.mint },
  wordPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.sage },
  wordPillText: { fontFamily: font.medium, fontSize: 13, color: colors.ink },
  seqItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: colors.sage },
  seqNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.forest, color: colors.white, textAlign: 'center', lineHeight: 24, fontFamily: font.bold, fontSize: 12 },
  sampleImage: { width: '100%', height: 220, borderRadius: 16, backgroundColor: colors.white },
  imgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, backgroundColor: colors.mint },
  imgBtnText: { fontFamily: font.semibold, fontSize: 14, color: colors.forest },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.mint, alignSelf: 'flex-start' },
  secondaryBtnText: { fontFamily: font.medium, fontSize: 13, color: colors.forest },
});
