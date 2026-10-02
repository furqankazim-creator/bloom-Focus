import { Feather } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  formatDuration,
  pickDocuments,
  pickImages,
  voiceNote,
  type PendingAttachment,
} from '../services/attachments';
import {
  FREQUENCIES,
  SUPPORT_LEVELS,
  TIME_OF_DAY,
  activityCard,
  gameInfo,
  progressCard,
  resultCard,
  routineCard,
  type SupportLevel,
} from '../services/noteCards';
import { TEMPLATE } from '../engine/studio';
import { MOODS, SLEEP, TAGS, detailLabels, hasDetails } from '../services/noteDetails';
import { TRAIN_GAMES } from '../games/train/meta';
import { taskLevel } from '../engine/adaptive';
import { BASE_PARAMS } from '../engine/tasks';
import { trainTaskDef, starsFor, type TrainTaskId } from '../engine/trainTasks';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { NoteCard, NoteDetails, NoteTag, Role } from '../types';

const MAX_RECORDING_MS = 5 * 60 * 1000;
const MIN_RECORDING_MS = 700;
const MAX_CHARS = 4000;
const INPUT_MIN = 40;
const INPUT_MAX = 128;

export type OutgoingMessage = { text: string; attachments: PendingAttachment[]; details?: NoteDetails; card?: NoteCard };

/**
 * Message box with photo/screenshot, camera, document and voice-note attachments,
 * plus an optional check-in (mood, sleep, topic tags).
 * `onSend` resolves true when the message was sent, so the composer can clear.
 */
export function NoteComposer({
  childId,
  role,
  placeholder,
  disabled,
  quickReplies = [],
  onSend,
}: {
  childId: string;
  role: Role;
  placeholder: string;
  disabled: boolean;
  /** One-tap replies suggested by the last message from the other person. */
  quickReplies?: string[];
  onSend: (message: OutgoingMessage) => Promise<boolean>;
}) {
  const nav = useNavigation<any>();
  const child = useStore((s) => s.children.find((c) => c.id === childId));
  const sessions = useStore((s) => s.sessions);
  const [card, setCard] = useState<NoteCard | null>(null);
  const [activityId, setActivityId] = useState<TrainTaskId | null>(null);
  const [frequency, setFrequency] = useState<string>(FREQUENCIES[1]);
  const [activitySupport, setActivitySupport] = useState<SupportLevel | null>(null);
  const [activityRewardTip, setActivityRewardTip] = useState('');
  const [activityTherapistNote, setActivityTherapistNote] = useState('');
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineSteps, setRoutineSteps] = useState<string[]>(['', '']);
  const [routineTimeOfDay, setRoutineTimeOfDay] = useState<(typeof TIME_OF_DAY)[number] | ''>('');
  const [routineSupport, setRoutineSupport] = useState<SupportLevel | null>(null);
  const [routineNote, setRoutineNote] = useState('');
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(INPUT_MIN);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [details, setDetails] = useState<NoteDetails>({});
  const [panel, setPanel] = useState<'none' | 'attach' | 'details' | 'activity' | 'routine'>('none');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const remaining = MAX_ATTACHMENTS - pending.length;
  const busy = disabled || sending;
  const withDetails = hasDetails(details);
  const hasContent = !!text.trim() || pending.length > 0 || withDetails || !!card;
  const canSend = !busy && !recording && hasContent;

  // Latest game this child played, for the parent's "Share result" option.
  const latest = sessions
    .filter((x) => x.childId === childId && x.blocks.some((b) => b.accuracy !== null))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

  const attachCard = (kind: 'progress' | 'result') => {
    setPanel('none');
    setError('');
    if (!child) return;
    if (kind === 'progress') return setCard(progressCard(child, sessions));
    if (!latest) return setError('No games played yet. Play one from the Train tab first.');
    const block = latest.blocks.find((b) => b.accuracy !== null)!;
    setCard(resultCard(latest, block, starsFor(block.accuracy)));
  };

  const togglePanel = (next: 'attach' | 'details' | 'activity') => {
    setError('');
    setPanel((p) => (p === next ? 'none' : next));
  };

  const add = (items: PendingAttachment[]) => {
    const tooBig = items.find((p) => p.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) setError(`“${tooBig.name}” is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
    setPending((prev) => [...prev, ...items.filter((p) => p.size <= MAX_ATTACHMENT_BYTES)].slice(0, MAX_ATTACHMENTS));
  };

  const attach = async (source: 'library' | 'camera' | 'document') => {
    setPanel('none');
    setError('');
    if (remaining <= 0) return setError(`You can attach up to ${MAX_ATTACHMENTS} items per message.`);
    try {
      add(source === 'document' ? await pickDocuments(remaining) : await pickImages(source, remaining));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that attachment.');
    }
  };

  const startRecording = async () => {
    setError('');
    setPanel('none');
    if (remaining <= 0) return setError(`You can attach up to ${MAX_ATTACHMENTS} items per message.`);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return setError('Microphone access is off. Turn it on in Settings to record a voice note.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      setRecording(true);
    } catch {
      setError('Could not start recording on this device.');
    }
  };

  const finishRecording = async (keep: boolean) => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const durationMs = recorderState.durationMillis;
    try {
      await recorder.stop();
    } catch {
      // Stopping an already-stopped recorder is harmless.
    }
    setRecording(false);
    // Hand the audio session back to the app's normal playback settings.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false }).catch(() => {});
    if (!keep) return;
    if (!recorder.uri || durationMs < MIN_RECORDING_MS) return setError('Voice note was too short.');
    add([voiceNote(recorder.uri, durationMs)]);
  };

  // Cap voice note length.
  useEffect(() => {
    if (recording && recorderState.durationMillis >= MAX_RECORDING_MS) void finishRecording(true);
  }, [recording, recorderState.durationMillis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Never leave the microphone running after leaving the screen.
  useEffect(
    () => () => {
      if (recordingRef.current) void recorder.stop().catch(() => {});
    },
    [recorder],
  );

  // Pulsing dot while recording.
  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      if (await onSend({ text: text.trim(), attachments: pending, details: withDetails ? details : undefined, card: card ?? undefined })) {
        setText('');
        setCard(null);
        setActivityId(null);
        setActivitySupport(null);
        setActivityRewardTip('');
        setActivityTherapistNote('');
        setRoutineTitle('');
        setRoutineSteps(['', '']);
        setRoutineTimeOfDay('');
        setRoutineSupport(null);
        setRoutineNote('');
        setInputHeight(INPUT_MIN);
        setPending([]);
        setDetails({});
        setPanel('none');
      }
    } finally {
      setSending(false);
    }
  };

  const toggleTag = (tag: NoteTag) =>
    setDetails((d) => {
      const tags = d.tags?.includes(tag) ? d.tags.filter((t) => t !== tag) : [...(d.tags ?? []), tag];
      return { ...d, tags: tags.length ? tags : undefined };
    });

  return (
    <View style={styles.wrap}>
      {!!error && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {quickReplies.length > 0 && !hasContent && !recording && panel === 'none' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.replies} keyboardShouldPersistTaps="handled">
          {quickReplies.map((r) => (
            <Pressable
              key={r}
              onPress={() => !busy && void onSend({ text: r, attachments: [] })}
              style={({ pressed }) => [styles.reply, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Send quick reply: ${r}`}
            >
              <Text style={styles.replyText}>{r}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {card && (
        <View style={styles.cardPreview}>
          <Text style={styles.cardPreviewEmoji}>
            {card.type === 'progress'
              ? '📈'
              : card.type === 'routine'
                ? '✅'
                : card.type === 'studio'
                  ? TEMPLATE[card.template].icon
                  : gameInfo(card.taskId).icon}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardPreviewKicker}>
              {card.type === 'activity'
                ? 'ASSIGN ACTIVITY'
                : card.type === 'result'
                  ? 'SHARE RESULT'
                  : card.type === 'routine'
                    ? 'DAILY ROUTINE'
                    : card.type === 'studio'
                      ? 'GAME STUDIO PLAY'
                      : 'SHARE WEEKLY PROGRESS'}
            </Text>
            <Text style={styles.cardPreviewTitle} numberOfLines={1}>
              {card.type === 'progress'
                ? `${card.sessions}/${card.goal} sessions · ${card.minutes} min this week`
                : card.type === 'routine'
                  ? `${card.title} · ${card.steps.length} steps${card.timeOfDay ? ` · ${card.timeOfDay}` : ''}`
                  : card.type === 'studio'
                    ? `${card.title} · ${card.stars}/3 stars`
                    : `${gameInfo(card.taskId).title}${card.type === 'activity' ? ` · Level ${card.level}${card.frequency ? ` · ${card.frequency}` : ''}` : ''}`}
            </Text>
          </View>
          <Pressable onPress={() => setCard(null)} hitSlop={10} accessibilityLabel="Remove card">
            <Feather name="x" size={18} color={colors.inkSoft} />
          </Pressable>
        </View>
      )}

      {pending.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingRow}>
          {pending.map((p) => (
            <View key={p.key} style={styles.pending}>
              {p.kind === 'image' ? (
                <Image source={{ uri: p.uri }} style={styles.pendingImage} accessibilityLabel={p.name} />
              ) : (
                <View style={styles.pendingOther}>
                  <View style={styles.pendingIcon}>
                    <Feather name={p.kind === 'audio' ? 'mic' : 'file-text'} size={15} color={colors.forest} />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.pendingLabel} numberOfLines={1}>
                      {p.kind === 'audio' ? 'Voice note' : p.name}
                    </Text>
                    <Text style={styles.pendingMeta}>{p.kind === 'audio' ? formatDuration(p.durationMs ?? 0) : 'Document'}</Text>
                  </View>
                </View>
              )}
              <Pressable
                onPress={() => setPending((prev) => prev.filter((x) => x.key !== p.key))}
                style={styles.remove}
                hitSlop={8}
                accessibilityLabel={`Remove ${p.kind === 'audio' ? 'voice note' : p.name}`}
              >
                <Feather name="x" size={11} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {withDetails && panel !== 'details' && (
        <View style={styles.detailSummary}>
          {detailLabels(details).map((label) => (
            <View key={label} style={styles.detailChip}>
              <Text style={styles.detailChipText}>{label}</Text>
            </View>
          ))}
          <Pressable onPress={() => setDetails({})} hitSlop={8} accessibilityLabel="Clear check-in details">
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        </View>
      )}

      {panel === 'attach' && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add to message</Text>
          <View style={styles.attachRow}>
            <AttachOption icon="image" label="Photos" hint="Incl. screenshots" tint={colors.sky} onPress={() => void attach('library')} />
            <AttachOption icon="camera" label="Camera" hint="Take a photo" tint={colors.butter} onPress={() => void attach('camera')} />
            <AttachOption icon="file-text" label="Document" hint="PDF, Word, text" tint={colors.rose} onPress={() => void attach('document')} />
          </View>
          <View style={styles.attachRow}>
            {role === 'therapist' ? (
              <AttachOption icon="target" label="Activity" hint="Assign for home" tint={colors.lime} onPress={() => setPanel('activity')} />
            ) : (
              <AttachOption icon="award" label="Latest result" hint="Last game played" tint={colors.lime} onPress={() => attachCard('result')} />
            )}
            <AttachOption icon="trending-up" label="Progress" hint="This week" tint={colors.mint} onPress={() => attachCard('progress')} />
            {role === 'therapist' ? (
              <AttachOption icon="check-square" label="Routine" hint="Daily checklist" tint={colors.butter} onPress={() => { setPanel('routine'); setRoutineSteps(['', '']); setRoutineTitle(''); setRoutineNote(''); }} />
            ) : (
              <View style={styles.attachOption} />
            )}
          </View>
        </View>
      )}

      {panel === 'activity' && child && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Assign an activity</Text>
            <Pressable onPress={() => setPanel('none')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            {(child.customActivities ?? []).some((a) => !a.studio) && (
              <Text style={styles.fieldLabel}>Custom for {child.name.split(' ')[0]}</Text>
            )}
            {(child.customActivities ?? []).filter((a) => !a.studio).map((a) => {
              const g = gameInfo(a.taskId);
              const tid = a.taskId as TrainTaskId;
              const params = a.adaptive ? child.tasks[tid]?.params ?? BASE_PARAMS : a.params;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setCard({
                      ...activityCard(child, tid, a.timesPerWeek === 7 ? 'Daily' : `${a.timesPerWeek}× a week`, {
                        supportLevel: a.supportLevel,
                        therapistNote: a.instructions,
                      }),
                      level: taskLevel(trainTaskDef(tid), params),
                      customId: a.id,
                      title: a.name,
                      ...(a.hero ? { heroEmoji: a.hero.emoji } : {}),
                    });
                    setPanel('none');
                  }}
                  style={styles.gameRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Send ${a.name}`}
                >
                  <View style={[styles.gameIcon, { backgroundColor: g.tint }]}>
                    <Text style={{ fontSize: 18 }}>{a.hero?.emoji ?? g.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameTitle}>{a.name}</Text>
                    <Text style={styles.gameSkill}>
                      {g.title} · {a.adaptive ? 'adaptive' : 'fixed level'}
                    </Text>
                  </View>
                  <Feather name="send" size={16} color={colors.forest} />
                </Pressable>
              );
            })}
            {(child.customActivities ?? []).filter((a) => !!a.studio).length > 0 && (
              <Text style={styles.fieldLabel}>Game Studio</Text>
            )}
            {(child.customActivities ?? []).filter((a) => !!a.studio).map((a) => {
              const t = a.studio!.content.template;
              const info = TEMPLATE[t];
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    nav.navigate('GameStudio', { childId, activityId: a.id });
                    setPanel('none');
                  }}
                  style={styles.gameRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${a.name} in Game Studio`}
                >
                  <View style={[styles.gameIcon, { backgroundColor: info.tint }]}>
                    <Text style={{ fontSize: 18 }}>{a.hero?.emoji ?? info.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameTitle}>{a.name}</Text>
                    <Text style={styles.gameSkill}>{info.name} · Game Studio</Text>
                  </View>
                  <Feather name="edit-2" size={16} color={colors.forest} />
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setPanel('none');
                nav.navigate('ActivityBuilder', { childId });
              }}
              style={styles.gameRow}
              accessibilityRole="button"
            >
              <View style={[styles.gameIcon, { backgroundColor: colors.mint }]}>
                <Feather name="plus" size={18} color={colors.forest} />
              </View>
              <Text style={[styles.gameTitle, { color: colors.forest }]}>Create a custom activity…</Text>
            </Pressable>
            <Text style={styles.fieldLabel}>All games</Text>
            {TRAIN_GAMES.map((g) => {
              const active = activityId === g.id;
              const level = taskLevel(trainTaskDef(g.id), child.tasks[g.id]?.params ?? BASE_PARAMS);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setActivityId(g.id)}
                  style={[styles.gameRow, active && styles.optionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.gameIcon, { backgroundColor: g.tint }]}>
                    <Text style={{ fontSize: 18 }}>{g.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameTitle}>{g.title}</Text>
                    <Text style={styles.gameSkill}>
                      {g.skill} · Level {level}
                    </Text>
                  </View>
                  {active && <Feather name="check-circle" size={18} color={colors.forest} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.fieldLabel}>How often</Text>
          <View style={styles.tagWrap}>
            {FREQUENCIES.map((f) => (
              <Pressable key={f} onPress={() => setFrequency(f)} style={[styles.tag, frequency === f && styles.optionActive]} accessibilityRole="button">
                <Text style={[styles.tagText, frequency === f && styles.optionActiveText]}>{f}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Support at home</Text>
          <View style={styles.supportRow}>
            {SUPPORT_LEVELS.map((s) => {
              const active = activitySupport === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setActivitySupport(active ? null : s.value)}
                  style={[styles.supportChip, active && styles.optionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={s.label}
                >
                  <Text style={styles.supportEmoji}>{s.emoji}</Text>
                  <Text style={[styles.supportChipLabel, active && styles.optionActiveText]} numberOfLines={1}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Reward suggestion (optional)</Text>
          <TextInput
            value={activityRewardTip}
            onChangeText={setActivityRewardTip}
            placeholder="e.g. 2 sticker chart stars if focused the whole time"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, styles.shortInput]}
            maxLength={80}
          />
          <Text style={styles.fieldLabel}>Note for the family (optional)</Text>
          <TextInput
            value={activityTherapistNote}
            onChangeText={setActivityTherapistNote}
            placeholder="Personal guidance: what to watch for, how to adapt…"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, styles.multiInput]}
            multiline
            maxLength={200}
          />
          <Pressable
            disabled={!activityId}
            onPress={() => {
              if (!activityId) return;
              setCard(
                activityCard(child, activityId, frequency, {
                  supportLevel: activitySupport ?? undefined,
                  rewardTip: activityRewardTip,
                  therapistNote: activityTherapistNote,
                }),
              );
              setPanel('none');
            }}
            style={[styles.primary, !activityId && { opacity: 0.4 }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Add to message</Text>
          </Pressable>
          <Text style={styles.hintText}>Type any instructions in the message box — they’re sent with the card.</Text>
        </View>
      )}

      {panel === 'routine' && child && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Create a daily routine</Text>
            <Pressable onPress={() => setPanel('none')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>Routine title</Text>
          <TextInput
            value={routineTitle}
            onChangeText={setRoutineTitle}
            placeholder="e.g. Morning prep for school"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, styles.shortInput]}
            maxLength={60}
          />
          <Text style={styles.fieldLabel}>
            Steps · {routineSteps.filter((s) => s.trim()).length}/{routineSteps.length} filled
          </Text>
          <View style={{ gap: 6 }}>
            {routineSteps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIndex}>
                  <Text style={styles.stepIndexText}>{i + 1}</Text>
                </View>
                <TextInput
                  value={step}
                  onChangeText={(v) =>
                    setRoutineSteps((prev) => prev.map((x, idx) => (idx === i ? v : x)))
                  }
                  placeholder={`Step ${i + 1}`}
                  placeholderTextColor={colors.inkMuted}
                  style={[styles.input, styles.stepInput]}
                  maxLength={120}
                />
                {routineSteps.length > 2 && (
                  <Pressable
                    onPress={() => setRoutineSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    hitSlop={8}
                    accessibilityLabel={`Remove step ${i + 1}`}
                    style={styles.stepRemove}
                  >
                    <Feather name="trash-2" size={15} color={colors.inkMuted} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          {routineSteps.length < 8 && (
            <Pressable style={styles.addStep} onPress={() => setRoutineSteps((prev) => [...prev, ''])} accessibilityRole="button">
              <Feather name="plus" size={14} color={colors.forest} />
              <Text style={styles.addStepText}>Add a step</Text>
            </Pressable>
          )}
          <Text style={styles.fieldLabel}>Time of day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagWrap}>
            {(['', ...TIME_OF_DAY] as const).map((t) => {
              const active = routineTimeOfDay === t;
              return (
                <Pressable
                  key={t || 'any'}
                  onPress={() => setRoutineTimeOfDay(t)}
                  style={[styles.tag, active && styles.optionActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.tagText, active && styles.optionActiveText]}>{t || 'Any time'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.fieldLabel}>Suggested support</Text>
          <View style={styles.supportRow}>
            {SUPPORT_LEVELS.map((s) => {
              const active = routineSupport === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setRoutineSupport(active ? null : s.value)}
                  style={[styles.supportChip, active && styles.optionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.supportEmoji}>{s.emoji}</Text>
                  <Text style={[styles.supportChipLabel, active && styles.optionActiveText]} numberOfLines={1}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Note for the family (optional)</Text>
          <TextInput
            value={routineNote}
            onChangeText={setRoutineNote}
            placeholder="A quick tip or encouragement for the family"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, styles.multiInput]}
            multiline
            maxLength={200}
          />
          <Pressable
            disabled={!routineTitle.trim() && routineSteps.filter((s) => s.trim()).length === 0}
            onPress={() => {
              const steps = routineSteps.map((s) => s.trim()).filter((s) => s.length > 0);
              if (!routineTitle.trim() && steps.length === 0) return;
              setCard(
                routineCard(routineTitle.trim() || 'Routine', steps.length ? steps : ['Complete the routine'], {
                  timeOfDay: routineTimeOfDay || undefined,
                  supportLevel: routineSupport ?? undefined,
                  therapistNote: routineNote,
                }),
              );
              setPanel('none');
            }}
            style={[
              styles.primary,
              !routineTitle.trim() && routineSteps.filter((s) => s.trim()).length === 0 && { opacity: 0.4 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Add to message</Text>
          </Pressable>
        </View>
      )}

      {panel === 'details' && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Check-in details</Text>
            <Pressable onPress={() => setPanel('none')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Done adding details">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>How was the day?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const active = details.mood === m.value;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setDetails((d) => ({ ...d, mood: active ? undefined : m.value }))}
                  style={[styles.mood, active && styles.optionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${m.label} day`}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, active && styles.optionActiveText]} numberOfLines={1}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Sleep last night</Text>
          <View style={styles.segment}>
            {SLEEP.map((s) => {
              const active = details.sleep === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setDetails((d) => ({ ...d, sleep: active ? undefined : s.value }))}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.optionActiveText]}>{s.short}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Topic</Text>
          <View style={styles.tagWrap}>
            {TAGS.map((t) => {
              const active = !!details.tags?.includes(t.value);
              return (
                <Pressable
                  key={t.value}
                  onPress={() => toggleTag(t.value)}
                  style={[styles.tag, active && styles.optionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {active && <Feather name="check" size={13} color={colors.forest} />}
                  <Text style={[styles.tagText, active && styles.optionActiveText]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.row}>
        {recording ? (
          <View style={[styles.field, styles.recordingField]}>
            <Pressable onPress={() => void finishRecording(false)} style={styles.fieldIcon} accessibilityRole="button" accessibilityLabel="Discard recording">
              <Feather name="trash-2" size={19} color={colors.danger} />
            </Pressable>
            <View style={styles.recording} accessibilityLiveRegion="polite">
              <Animated.View style={[styles.recDot, { opacity: pulse }]} />
              <Text style={styles.recText}>{formatDuration(recorderState.durationMillis)}</Text>
              <Text style={styles.recHint} numberOfLines={1}>
                Recording voice note…
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.field, focused && styles.fieldFocused, busy && { opacity: 0.6 }]}>
            <Pressable
              onPress={() => togglePanel('attach')}
              disabled={busy}
              style={[styles.fieldIcon, panel === 'attach' && styles.fieldIconActive]}
              accessibilityRole="button"
              accessibilityState={{ expanded: panel === 'attach' }}
              accessibilityLabel="Add photo, screenshot or document"
            >
              <Feather name={panel === 'attach' ? 'x' : 'plus'} size={21} color={colors.forest} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={pending.length ? 'Add a caption…' : placeholder}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { height: inputHeight }, webInput]}
              multiline
              // Web renders multiline inputs as a 2-row textarea by default; start at one line.
              {...(Platform.OS === 'web' ? { numberOfLines: 1 } : {})}
              maxLength={MAX_CHARS}
              editable={!busy}
              onFocus={() => {
                setFocused(true);
                setPanel((p) => (p === 'attach' ? 'none' : p));
              }}
              onBlur={() => setFocused(false)}
              onContentSizeChange={(e) =>
                setInputHeight(Math.min(INPUT_MAX, Math.max(INPUT_MIN, Math.ceil(e.nativeEvent.contentSize.height))))
              }
              onKeyPress={(e) => {
                // Web: Enter sends, Shift+Enter adds a new line.
                const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={() => togglePanel('details')}
              disabled={busy}
              style={[styles.fieldIcon, (panel === 'details' || withDetails) && styles.fieldIconActive]}
              accessibilityRole="button"
              accessibilityState={{ expanded: panel === 'details' }}
              accessibilityLabel="Add check-in details: mood, sleep and topic"
            >
              <Feather name="clipboard" size={18} color={colors.forest} />
              {withDetails && <View style={styles.badge} />}
            </Pressable>
          </View>
        )}

        {recording ? (
          <Pressable onPress={() => void finishRecording(true)} style={styles.action} accessibilityRole="button" accessibilityLabel="Finish voice note">
            <Feather name="check" size={21} color={colors.white} />
          </Pressable>
        ) : hasContent ? (
          <Pressable
            onPress={() => void send()}
            disabled={!canSend}
            style={[styles.action, !canSend && styles.actionDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator color={colors.white} /> : <Feather name="arrow-up" size={22} color={colors.white} />}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void startRecording()}
            disabled={busy}
            style={[styles.action, busy && styles.actionDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Record a voice note"
          >
            <Feather name="mic" size={20} color={colors.white} />
          </Pressable>
        )}
      </View>

      {text.length > MAX_CHARS - 500 && (
        <Text style={styles.counter}>
          {text.length} / {MAX_CHARS}
        </Text>
      )}
    </View>
  );
}

function AttachOption({
  icon,
  label,
  hint,
  tint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  hint: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.attachOption, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.attachIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={20} color={colors.ink} />
      </View>
      <Text style={styles.attachLabel}>{label}</Text>
      <Text style={styles.attachHint}>{hint}</Text>
    </Pressable>
  );
}

// Remove the browser focus ring; the field shows its own focus border.
const webInput = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  errorText: { flex: 1, fontFamily: font.medium, fontSize: 12, color: colors.danger },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  fieldFocused: { borderColor: colors.forest },
  fieldIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fieldIconActive: { backgroundColor: colors.mint },
  badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.leaf, borderWidth: 1.5, borderColor: colors.card },
  input: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: Platform.OS === 'ios' ? 10 : 9,
    paddingBottom: Platform.OS === 'ios' ? 10 : 9,
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink,
    textAlignVertical: 'center',
  },
  action: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  actionDisabled: { opacity: 0.45 },
  counter: { alignSelf: 'flex-end', marginRight: 64, fontFamily: font.regular, fontSize: 11, color: colors.inkMuted },

  recordingField: { alignItems: 'center' },
  recording: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recText: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  recHint: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },

  sheet: {
    padding: 14,
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, letterSpacing: 0.2 },
  done: { fontFamily: font.semibold, fontSize: 14, color: colors.forest },
  attachRow: { flexDirection: 'row', gap: 8 },
  attachOption: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 3 },
  attachIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  attachLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  attachHint: { fontFamily: font.regular, fontSize: 11, color: colors.inkMuted },

  replies: { gap: 8, paddingHorizontal: 4 },
  reply: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.forest },
  replyText: { fontFamily: font.medium, fontSize: 13, color: colors.forest },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginHorizontal: 2,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.leaf,
  },
  cardPreviewEmoji: { fontSize: 22 },
  cardPreviewKicker: { fontFamily: font.bold, fontSize: 10, letterSpacing: 0.8, color: colors.forest },
  cardPreviewTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, marginTop: 1 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  gameIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  gameTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  gameSkill: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft },
  primary: { height: 42, borderRadius: 12, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  hintText: { fontFamily: font.regular, fontSize: 11.5, color: colors.inkMuted, textAlign: 'center' },
  fieldLabel: { fontFamily: font.medium, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  moodRow: { flexDirection: 'row', gap: 6 },
  mood: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  moodEmoji: { fontSize: 22 },
  moodLabel: { fontFamily: font.medium, fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  optionActive: { borderColor: colors.forest, backgroundColor: colors.mint },
  optionActiveText: { color: colors.forest, fontFamily: font.semibold },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segmentActive: { backgroundColor: colors.mint },
  segmentText: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  tagText: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft },

  supportRow: { flexDirection: 'row', gap: 6 },
  supportChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    minWidth: 0,
  },
  supportEmoji: { fontSize: 15 },
  supportChipLabel: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.inkSoft,
    minWidth: 0,
  },
  shortInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  multiInput: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 4,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
    backgroundColor: colors.bg,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepIndexText: { fontFamily: font.semibold, fontSize: 12, color: colors.forest },
  stepInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  stepRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: 'rgba(240, 238, 232, 0.4)',
  },
  addStepText: { fontFamily: font.medium, fontSize: 12.5, color: colors.forest },

  detailSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  detailChip: { height: 26, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.mint },
  detailChipText: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.forest },
  clear: { fontFamily: font.medium, fontSize: 12, color: colors.inkMuted, marginLeft: 2 },

  pendingRow: { gap: 10, paddingHorizontal: 4, paddingTop: 8 },
  pending: { position: 'relative' },
  pendingImage: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.border },
  pendingOther: {
    height: 64,
    maxWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  pendingLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  pendingMeta: { fontFamily: font.regular, fontSize: 11, color: colors.inkMuted, marginTop: 1 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
