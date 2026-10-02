import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BAND_LABEL,
  CHARACTER_PRESETS,
  COMMUNICATION_STYLES,
  INTEREST_PRESETS,
  SENSORY_FLAGS,
  SUPPORT_PROFILES,
  fitBand,
} from '../engine/personalize';
import { colors, font } from '../theme';
import type { Child } from '../types';

export type LearningProfile = Pick<
  Child,
  'cognitiveAge' | 'iqScore' | 'diagnosis' | 'communicationStyle' | 'sensory' | 'interests' | 'favouriteCharacters'
>;

const MAX_HEROES = 3;

/** Optional, therapist-entered details that personalise difficulty, games and motivation. */
export function LearningProfileEditor({
  age,
  value,
  onChange,
}: {
  age: number;
  value: LearningProfile;
  onChange: (next: LearningProfile) => void;
}) {
  const [cogText, setCogText] = useState(value.cognitiveAge != null ? String(value.cognitiveAge) : '');
  const [iqText, setIqText] = useState(value.iqScore != null ? String(value.iqScore) : '');
  const [interest, setInterest] = useState('');
  const [customHero, setCustomHero] = useState({ name: '', emoji: '' });

  const set = (patch: Partial<LearningProfile>) => onChange({ ...value, ...patch });
  const toggle = (list: string[] | undefined, item: string) =>
    list?.includes(item) ? list.filter((x) => x !== item) : [...(list ?? []), item];

  const iqValid = value.iqScore == null || (value.iqScore >= 40 && value.iqScore <= 160);
  const cogValid = value.cognitiveAge == null || (value.cognitiveAge >= 2 && value.cognitiveAge <= 17);
  const fit = fitBand({ age, cognitiveAge: value.cognitiveAge, iqScore: iqValid ? value.iqScore : null });
  const heroes = value.favouriteCharacters ?? [];

  const toggleHero = (h: { name: string; emoji: string }) => {
    const on = heroes.some((x) => x.emoji === h.emoji);
    if (on) set({ favouriteCharacters: heroes.filter((x) => x.emoji !== h.emoji) });
    else if (heroes.length < MAX_HEROES) set({ favouriteCharacters: [...heroes, h] });
  };

  return (
    <View>
      <View style={styles.banner}>
        <Feather name="shield" size={16} color={colors.forest} />
        <Text style={styles.bannerText}>
          Everything here is optional and used only to pitch activities. It is not a diagnosis — keep clinical records in your
          clinical system.
        </Text>
      </View>

      <Label text="Developmental level" />
      <View style={styles.twoCol}>
        <Field
          label="Working age"
          hint={`Leave blank to use age ${age}`}
          value={cogText}
          invalid={!cogValid}
          onChange={(t) => {
            const clean = t.replace(/[^0-9]/g, '').slice(0, 2);
            setCogText(clean);
            set({ cognitiveAge: clean ? Number(clean) : null });
          }}
        />
        <Field
          label="Standard score (IQ)"
          hint="Optional · 40–160"
          value={iqText}
          invalid={!iqValid}
          onChange={(t) => {
            const clean = t.replace(/[^0-9]/g, '').slice(0, 3);
            setIqText(clean);
            set({ iqScore: clean ? Number(clean) : null });
          }}
        />
      </View>
      <View style={styles.fit}>
        <Text style={styles.fitText}>
          Activities pitched at: <Text style={{ fontFamily: font.bold }}>{BAND_LABEL[fit.band]}</Text>
          {fit.reasons.length ? ` (${fit.reasons.join(', ')})` : ''}
        </Text>
      </View>

      <Label text="Support profile" hint="Family-reported. Shapes which games are suggested." />
      <View style={styles.wrap}>
        {SUPPORT_PROFILES.map((p) => (
          <Toggle key={p} label={p} on={!!value.diagnosis?.includes(p)} onPress={() => set({ diagnosis: toggle(value.diagnosis, p) })} />
        ))}
      </View>

      <Label text="How they communicate" />
      <View style={{ gap: 8 }}>
        {COMMUNICATION_STYLES.map((c) => {
          const on = value.communicationStyle === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => set({ communicationStyle: on ? undefined : c.value })}
              style={[styles.option, on && styles.on]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Feather name={on ? 'check-circle' : 'circle'} size={18} color={on ? colors.forest : colors.inkMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{c.label}</Text>
                <Text style={styles.optionHint}>{c.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Label text="Sensory sensitivities" hint="Turns on calm mode and keeps screens simple." />
      <View style={styles.wrap}>
        {SENSORY_FLAGS.map((f) => (
          <Toggle
            key={f.key}
            label={`${f.emoji} ${f.label}`}
            on={!!value.sensory?.[f.key]}
            onPress={() => set({ sensory: { ...value.sensory, [f.key]: !value.sensory?.[f.key] } })}
          />
        ))}
      </View>

      <Label text={`Favourite characters (${heroes.length}/${MAX_HEROES})`} hint="The first one becomes the hero in games." />
      <View style={styles.wrap}>
        {heroes
          .filter((h) => !CHARACTER_PRESETS.some((p) => p.emoji === h.emoji))
          .concat(CHARACTER_PRESETS)
          .map((h) => {
            const index = heroes.findIndex((x) => x.emoji === h.emoji);
            const on = index >= 0;
            return (
              <Pressable
                key={h.emoji + h.name}
                onPress={() => toggleHero(h)}
                style={[styles.hero, on && styles.on, !on && heroes.length >= MAX_HEROES && { opacity: 0.4 }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={h.name}
              >
                <Text style={styles.heroEmoji}>{h.emoji}</Text>
                <Text style={styles.heroName} numberOfLines={1}>
                  {h.name}
                </Text>
                {on && (
                  <View style={styles.rank}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
      </View>
      <View style={[styles.addRow, { marginTop: 10 }]}>
        <TextInput
          value={customHero.emoji}
          onChangeText={(t) => setCustomHero((c) => ({ ...c, emoji: t.slice(0, 8) }))}
          placeholder="🐸"
          placeholderTextColor={colors.inkMuted}
          style={[styles.addInput, { width: 58, textAlign: 'center' }]}
          accessibilityLabel="Custom character emoji"
        />
        <TextInput
          value={customHero.name}
          onChangeText={(t) => setCustomHero((c) => ({ ...c, name: t.slice(0, 20) }))}
          placeholder="Own character, e.g. Froggy"
          placeholderTextColor={colors.inkMuted}
          style={[styles.addInput, { flex: 1 }]}
        />
        <Pressable
          onPress={() => {
            if (!customHero.name.trim() || !customHero.emoji.trim() || heroes.length >= MAX_HEROES) return;
            toggleHero({ name: customHero.name.trim(), emoji: customHero.emoji.trim() });
            setCustomHero({ name: '', emoji: '' });
          }}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add custom character"
        >
          <Feather name="plus" size={18} color={colors.white} />
        </Pressable>
      </View>

      <Label text="Interests" hint="Useful talking points and reward ideas." />
      <View style={styles.wrap}>
        {[...new Set([...(value.interests ?? []), ...INTEREST_PRESETS])].map((i) => (
          <Toggle key={i} label={i} on={!!value.interests?.includes(i)} onPress={() => set({ interests: toggle(value.interests, i) })} />
        ))}
      </View>
      <View style={[styles.addRow, { marginTop: 10 }]}>
        <TextInput
          value={interest}
          onChangeText={setInterest}
          placeholder="Add another interest"
          placeholderTextColor={colors.inkMuted}
          style={[styles.addInput, { flex: 1 }]}
          maxLength={24}
          onSubmitEditing={() => {
            if (interest.trim()) set({ interests: [...new Set([...(value.interests ?? []), interest.trim()])] });
            setInterest('');
          }}
        />
        <Pressable
          onPress={() => {
            if (interest.trim()) set({ interests: [...new Set([...(value.interests ?? []), interest.trim()])] });
            setInterest('');
          }}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add interest"
        >
          <Feather name="plus" size={18} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 10 }}>
      <Text style={styles.label}>{text}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

function Field({ label, hint, value, invalid, onChange }: { label: string; hint: string; value: string; invalid: boolean; onChange: (t: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.inkMuted}
        style={[styles.fieldInput, invalid && { borderColor: colors.danger }]}
        accessibilityLabel={label}
      />
      <Text style={[styles.hint, invalid && { color: colors.danger }]}>{invalid ? 'Out of range' : hint}</Text>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, on && styles.on]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {on && <Feather name="check" size={13} color={colors.forest} />}
      <Text style={[styles.toggleText, on && { color: colors.forest, fontFamily: font.semibold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.mint },
  bannerText: { flex: 1, fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, color: colors.forest },
  label: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.inkMuted, marginTop: 3 },
  twoCol: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  fieldInput: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: font.semibold,
    fontSize: 17,
    color: colors.ink,
  },
  fit: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: colors.sage },
  fitText: { fontFamily: font.regular, fontSize: 13, color: colors.forest },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  toggleText: { fontFamily: font.medium, fontSize: 13.5, color: colors.inkSoft },
  on: { borderColor: colors.forest, backgroundColor: colors.mint },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  optionTitle: { fontFamily: font.semibold, fontSize: 14.5, color: colors.ink },
  optionHint: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkSoft },
  hero: { width: 72, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  heroEmoji: { fontSize: 26 },
  heroName: { fontFamily: font.medium, fontSize: 11, color: colors.inkSoft, marginTop: 2, maxWidth: 64 },
  rank: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: font.bold, fontSize: 10, color: colors.white },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.ink,
  },
  addBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
});
