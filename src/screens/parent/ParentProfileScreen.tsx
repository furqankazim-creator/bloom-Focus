import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AvatarPicker } from '../../components/AvatarPicker';
import { PinGate } from '../../components/PinGate';
import { Avatar, Card, ProgressBar, Screen, T } from '../../components/ui';
import { taskLevel } from '../../engine/adaptive';
import { sessionAccuracy, startOfWeek } from '../../engine/profile';
import { BASE_PARAMS, DOMAIN_LABEL } from '../../engine/tasks';
import { TRAIN_GAMES, describeParams, starsFor, trainTaskDef } from '../../games/train/meta';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import type { RewardTheme } from '../../types';
import { SampleBanner } from '../../components/SampleBanner';
import { dayStreak, firstName, useChildHistory } from '../helpers';

const THEMES: { id: RewardTheme; icon: string; label: string }[] = [
  { id: 'stars', icon: '⭐', label: 'Stars' },
  { id: 'animals', icon: '🐶', label: 'Animals' },
  { id: 'vehicles', icon: '🚗', label: 'Vehicles' },
  { id: 'nature', icon: '🌸', label: 'Flowers' },
  { id: 'celebration', icon: '🎉', label: 'Celebrations' },
];

export default function ParentProfileScreen() {
  const nav = useNavigation<any>();
  const { parentChildId, children, updateChild, parentPin, setParentPin } = useStore();
  const child = children.find((c) => c.id === parentChildId) || children[0];
  const { sessions: mine, isDemo } = useChildHistory(child);

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  if (!child) return null;
  const first = firstName(child.name);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  // Real stats from saved sessions.
  const totalStars = mine.reduce((n, s) => n + starsFor(sessionAccuracy(s)), 0);
  const streak = dayStreak(mine);
  const weekStart = startOfWeek().getTime();
  const thisWeek = mine.filter((s) => new Date(s.startedAt).getTime() >= weekStart).length;
  const weekGoal = Math.max(1, child.homeSessionsPerWeek || 3);

  const skills = TRAIN_GAMES.map((g) => {
    const params = child.tasks?.[g.id]?.params ?? BASE_PARAMS;
    const level = taskLevel(trainTaskDef(g.id), params);
    const played = mine.filter((s) => s.blocks.some((b) => b.taskId === g.id && b.accuracy !== null));
    const last = played[0] ? sessionAccuracy(played[0]) : null;
    return { g, params, level, played: played.length, last };
  });
  const overallLevel = Math.max(1, Math.round(skills.reduce((n, s) => n + s.level, 0) / skills.length));

  const badges = [
    { icon: '🌱', label: 'First game', done: mine.length >= 1 },
    { icon: '⭐', label: '3-star game', done: mine.some((s) => starsFor(sessionAccuracy(s)) === 3) },
    { icon: '🧩', label: 'Tried all 4', done: skills.every((s) => s.played > 0) },
    { icon: '🔥', label: '3-day streak', done: streak >= 3 },
    { icon: '🏅', label: '10 sessions', done: mine.length >= 10 },
    { icon: '🚀', label: 'Level 5 skill', done: skills.some((s) => s.level >= 5) },
  ];
  const earned = badges.filter((b) => b.done).length;

  const openPin = () => {
    setPinInput('');
    setPinConfirm('');
    setPinError('');
    setPinModal(true);
  };

  const savePin = () => {
    if (!/^\d{4}$/.test(pinInput)) return setPinError('Please enter exactly 4 digits.');
    if (pinInput !== pinConfirm) return setPinError('The two PINs don’t match.');
    setParentPin(pinInput);
    setPinModal(false);
    showToast('Parent PIN saved 🔒');
  };

  const removePin = () => {
    setParentPin(null);
    setPinModal(false);
    showToast('PIN removed — parent tabs are open');
  };

  return (
    <PinGate>
      <Screen scroll>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Pressable onPress={() => setAvatarOpen(true)} accessibilityLabel="Change profile picture">
            <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={72} />
            <View style={styles.camBadge}>
              <Feather name="camera" size={12} color={colors.white} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {child.name}
            </Text>
            <Text style={styles.meta}>
              Age {child.age} · Level {overallLevel}
            </Text>
            <View style={styles.focusPill}>
              <Text style={styles.focusText}>Focus: {DOMAIN_LABEL[child.focus]}</Text>
            </View>
          </View>
          <Pressable onPress={() => nav.navigate('EditChild', { childId: child.id })} style={styles.editBtn} accessibilityLabel="Edit profile">
            <Feather name="edit-2" size={16} color={colors.inkSoft} />
          </Pressable>
        </Card>

        {isDemo && <SampleBanner name={first} />}

        {/* Stats */}
        <View style={styles.grid}>
          <Stat icon="⭐" value={String(totalStars)} label="Total stars" />
          <Stat icon="🎯" value={String(mine.length)} label="Sessions" />
          <Stat icon="🔥" value={String(streak)} label="Day streak" />
          <Card style={styles.statBox}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statNum}>
              {thisWeek}
              <Text style={styles.statOf}>/{weekGoal}</Text>
            </Text>
            <Text style={styles.statLabel}>This week</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <ProgressBar value={thisWeek / weekGoal} height={5} color={thisWeek >= weekGoal ? '#1DB988' : colors.leaf} />
            </View>
          </Card>
        </View>

        {/* Skills */}
        <SectionTitle title="Skills" sub="Tap a skill for its full progress" />
        <View style={{ gap: 10 }}>
          {skills.map(({ g, params, level, played, last }) => (
            <Card key={g.id} onPress={() => nav.navigate('SkillDetail', { childId: child.id, taskId: g.id })} style={styles.skillRow}>
              <View style={[styles.skillIcon, { backgroundColor: g.tint }]}>
                <Text style={{ fontSize: 22, lineHeight: 28 }}>{g.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text style={styles.skillName}>{g.skill}</Text>
                  <Text style={[styles.skillLvl, { color: g.color }]}>Lvl {level}</Text>
                </View>
                <View style={{ marginVertical: 6 }}>
                  <ProgressBar value={level / 10} height={5} color={g.color} />
                </View>
                <Text style={styles.skillMeta}>
                  {describeParams(g.id, params)}
                  {played ? ` · ${played} played` : ' · not played yet'}
                  {last !== null ? ` · last ${Math.round(last * 100)}%` : ''}
                </Text>
              </View>
            </Card>
          ))}
        </View>
        <Text style={styles.footnote}>Difficulty adjusts automatically after every game based on {first}’s performance.</Text>

        {/* Badges */}
        <SectionTitle title="Badges" sub={`${earned} of ${badges.length} earned`} />
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.label} style={[styles.badge, !b.done && { opacity: 0.45 }]}>
              <Text style={{ fontSize: 26, lineHeight: 32 }}>{b.done ? b.icon : '🔒'}</Text>
              <Text style={styles.badgeLabel}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Reward theme */}
        <SectionTitle title="Reinforcement style" sub={`What ${first} collects for correct answers`} />
        <View style={styles.themeGrid}>
          {THEMES.map((t) => {
            const sel = (child.rewardTheme || 'stars') === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => updateChild(child.id, { rewardTheme: t.id })}
                style={[styles.theme, sel && styles.themeSel]}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
              >
                <Text style={{ fontSize: 24, lineHeight: 30 }}>{t.icon}</Text>
                <Text style={[styles.themeLabel, sel && { color: colors.forest }]}>{t.label}</Text>
                {sel && (
                  <View style={styles.themeCheck}>
                    <Feather name="check" size={11} color={colors.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Parent settings */}
        <SectionTitle title="Parent settings" />
        <Card style={{ padding: 0, borderRadius: 18, overflow: 'hidden', marginBottom: 60 }}>
          <Pressable onPress={openPin} style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Feather name="lock" size={16} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Parent PIN</Text>
              <Text style={styles.settingSub}>{parentPin ? 'On · protects Progress & Profile' : 'Off · anyone can open these tabs'}</Text>
            </View>
            <Text style={styles.settingAction}>{parentPin ? 'Change' : 'Set up'}</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => nav.navigate('EditChild', { childId: child.id })} style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Feather name="user" size={16} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Edit {first}’s details</Text>
              <Text style={styles.settingSub}>Name, age and focus area</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => nav.navigate('Settings')} style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Feather name="settings" size={16} color={colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>App settings</Text>
              <Text style={styles.settingSub}>Reminders, account and sign out</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.inkMuted} />
          </Pressable>
        </Card>

        <AvatarPicker
          visible={avatarOpen}
          onClose={() => setAvatarOpen(false)}
          name={child.name}
          color={child.color}
          photo={child.photo}
          emoji={child.avatarEmoji}
          onChange={(patch) => {
            updateChild(child.id, patch);
            showToast(patch.photo ? 'Photo updated 📸' : 'Avatar updated');
          }}
        />

        <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconWrap}>
                <Feather name="lock" size={26} color={colors.forest} />
              </View>
              <Text style={styles.modalTitle}>{parentPin ? 'Change parent PIN' : 'Set parent PIN'}</Text>
              <Text style={styles.modalSubtitle}>A 4-digit code keeps Progress and Profile away from little fingers.</Text>
              <TextInput
                style={styles.pinInput}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="New PIN"
                placeholderTextColor="#A0A89F"
                value={pinInput}
                onChangeText={(v) => {
                  setPinInput(v.replace(/\D/g, ''));
                  setPinError('');
                }}
                autoFocus
              />
              <TextInput
                style={styles.pinInput}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="Repeat PIN"
                placeholderTextColor="#A0A89F"
                value={pinConfirm}
                onChangeText={(v) => {
                  setPinConfirm(v.replace(/\D/g, ''));
                  setPinError('');
                }}
                onSubmitEditing={savePin}
              />
              {pinError ? <Text style={styles.modalError}>{pinError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#F0ECE4' }]} onPress={() => setPinModal(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.inkSoft }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: colors.forest }]} onPress={savePin}>
                  <Text style={[styles.modalBtnText, { color: colors.white }]}>Save PIN</Text>
                </Pressable>
              </View>
              {parentPin ? (
                <Pressable onPress={removePin} style={{ marginTop: 14, padding: 4 }}>
                  <Text style={styles.modalRemove}>Turn off PIN protection</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Modal>
      </Screen>

      {toast ? (
        <View pointerEvents="none" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </PinGate>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <Card style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginTop: 26, marginBottom: 12 }}>
      <T.H3 style={{ fontSize: 18 }}>{title}</T.H3>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  headerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, marginBottom: 14 },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.forest,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: font.heavy, fontSize: 22, color: colors.ink },
  meta: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  focusPill: { alignSelf: 'flex-start', backgroundColor: '#E4EDE0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  focusText: { fontFamily: font.semibold, fontSize: 11, color: colors.forest },
  editBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F2EC', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flexGrow: 1, flexBasis: '45%', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 18 },
  statIcon: { fontSize: 20, lineHeight: 26, marginBottom: 4 },
  statNum: { fontFamily: font.heavy, fontSize: 22, color: colors.ink },
  statOf: { fontFamily: font.bold, fontSize: 15, color: colors.inkMuted },
  statLabel: { fontFamily: font.medium, fontSize: 12, color: colors.inkMuted },
  sectionSub: { fontFamily: font.regular, fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
  skillIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  skillName: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  skillLvl: { fontFamily: font.heavy, fontSize: 13 },
  skillMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted },
  footnote: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 10 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  badgeLabel: { fontFamily: font.semibold, fontSize: 11, color: colors.ink, marginTop: 4, textAlign: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  theme: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  themeSel: { borderColor: colors.forest, backgroundColor: '#F2F7F2' },
  themeLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.ink, marginTop: 4 },
  themeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  settingIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EEF4EF', alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  settingSub: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  settingAction: { fontFamily: font.bold, fontSize: 14, color: colors.forest },
  divider: { height: 1, backgroundColor: '#EFEEE8', marginLeft: 62 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,35,25,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 340, backgroundColor: colors.white, borderRadius: 24, padding: 24, alignItems: 'center' },
  modalIconWrap: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E4EDE0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontFamily: font.bold, color: colors.ink, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, fontFamily: font.regular, color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  pinInput: {
    width: 180,
    height: 50,
    borderWidth: 2,
    borderColor: '#D4DDD0',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: font.bold,
    color: colors.ink,
    letterSpacing: 6,
    backgroundColor: '#F9FBF8',
    marginBottom: 10,
  },
  modalError: { fontSize: 12, fontFamily: font.medium, color: colors.danger, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  modalBtn: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontFamily: font.bold, fontSize: 14 },
  modalRemove: { fontSize: 12, fontFamily: font.semibold, color: colors.danger, textAlign: 'center' },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.forestDeep,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toastText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
});
