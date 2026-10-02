import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { LearningProfileEditor, type LearningProfile } from '../components/LearningProfileEditor';
import { Button, Card, Chip, Notice, Screen, T, TopBar } from '../components/ui';
import { DOMAIN_LABEL } from '../engine/tasks';
import type { RootProps } from '../navigation/types';
import { useChild, useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { Domain } from '../types';

const AGES = [5, 8, 11, 14];
const FOCUSES: Domain[] = ['sustained', 'selective', 'auditory', 'workingMemory', 'inhibition', 'instructions', 'flexibility', 'emotional'];

export default function EditChildScreen({ route, navigation }: RootProps<'EditChild'>) {
  const existing = useChild(route.params.childId);
  const addChild = useStore((s) => s.addChild);
  const updateChild = useStore((s) => s.updateChild);
  const [name, setName] = useState(existing?.name ?? '');
  const [age, setAge] = useState(existing?.age ?? 8);
  const [ageText, setAgeText] = useState(String(existing?.age ?? 8));
  const [focus, setFocus] = useState<Domain>(existing?.focus ?? 'sustained');
  const [minutes, setMinutes] = useState(existing?.sessionMinutes ?? 15);
  const [profile, setProfile] = useState<LearningProfile>({
    cognitiveAge: existing?.cognitiveAge ?? null,
    iqScore: existing?.iqScore ?? null,
    diagnosis: existing?.diagnosis ?? [],
    communicationStyle: existing?.communicationStyle,
    sensory: existing?.sensory ?? {},
    interests: existing?.interests ?? [],
    favouriteCharacters: existing?.favouriteCharacters ?? [],
  });

  const validAge = age >= 3 && age <= 17;
  const profileValid =
    (profile.iqScore == null || (profile.iqScore >= 40 && profile.iqScore <= 160)) &&
    (profile.cognitiveAge == null || (profile.cognitiveAge >= 2 && profile.cognitiveAge <= 17));
  const ready = name.trim().length > 0 && validAge && profileValid;

  const save = () => {
    if (existing) {
      updateChild(existing.id, { name: name.trim(), age, focus, sessionMinutes: minutes, currentMinutes: Math.min(existing.currentMinutes, minutes), ...profile });
      navigation.goBack();
    } else {
      const id = addChild({ name, age, focus, sessionMinutes: minutes });
      updateChild(id, profile);
      navigation.replace('ChildProfile', { childId: id });
    }
  };

  const setAgeValue = (n: number) => {
    setAge(n);
    setAgeText(String(n));
  };

  return (
    <Screen>
      <TopBar title={existing ? 'Edit profile' : 'New profile'} onBack={() => navigation.goBack()} />
      <View style={styles.badge}>
        <Feather name="sun" size={36} color={colors.forest} />
        <View style={styles.badgeDot} />
      </View>
      <T.Eyebrow style={{ marginTop: 20 }}>A small space to grow</T.Eyebrow>
      <T.Display>{existing ? `Update ${existing.name.split(' ')[0]}’s details.` : 'Let’s make room\nfor a new bloom.'}</T.Display>
      <T.Body style={{ marginTop: 8 }}>Start with only what you need for practice.</T.Body>

      <Text style={styles.label}>First name or nickname</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Ali" placeholderTextColor={colors.inkMuted} style={styles.input} maxLength={40} />

      <Text style={styles.label}>Age</Text>
      <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}>
        {AGES.map((a) => (
          <Chip key={a} label={`${a} yrs`} selected={age === a} onPress={() => setAgeValue(a)} />
        ))}
        <TextInput
          value={ageText}
          onChangeText={(t) => {
            const clean = t.replace(/[^0-9]/g, '').slice(0, 2);
            setAgeText(clean);
            setAge(Number(clean) || 0);
          }}
          keyboardType="number-pad"
          style={[styles.ageInput, !validAge && { borderColor: colors.danger }]}
          accessibilityLabel="Custom age"
        />
      </View>
      {!validAge && <T.Small style={{ color: colors.danger, marginTop: 6 }}>Bloom Focus is designed for ages 3–17.</T.Small>}

      <Text style={styles.label}>Practice focus</Text>
      <View style={{ gap: 10 }}>
        {FOCUSES.map((f) => (
          <Card key={f} selected={focus === f} onPress={() => setFocus(f)} style={[styles.row, { gap: 14, paddingVertical: 16 }]}>
            <Feather name={focus === f ? 'check-circle' : 'circle'} size={22} color={focus === f ? colors.forest : colors.inkMuted} />
            <T.H3 style={{ fontFamily: font.medium }}>{DOMAIN_LABEL[f]}</T.H3>
          </Card>
        ))}
      </View>

      <Text style={styles.label}>Maximum session length</Text>
      <View style={[styles.row, { gap: 8 }]}>
        {[10, 15, 20].map((m) => (
          <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
        ))}
      </View>

      <Text style={[styles.label, { fontSize: 20, marginTop: 34, marginBottom: 6 }]}>Learning profile</Text>
      <T.Body>Personalises difficulty, suggested games, calm mode and the game hero.</T.Body>
      <View style={{ marginTop: 14 }}>
        <LearningProfileEditor age={age || 8} value={profile} onChange={setProfile} />
      </View>

      <Notice icon="lock" style={{ marginTop: 28 }} text="Demo mode keeps profiles on this device. Use a nickname; avoid contact details and keep clinical records in your clinical system." />
      <Button label={existing ? 'Save changes' : 'Create profile'} icon="arrow-right" disabled={!ready} onPress={save} style={{ marginTop: 20 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 96, height: 96, borderRadius: 30, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.peach },
  label: { fontFamily: font.semibold, fontSize: 16, color: colors.ink, marginTop: 26, marginBottom: 12 },
  input: {
    height: 62,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    fontFamily: font.regular,
    fontSize: 17,
    color: colors.ink,
  },
  ageInput: {
    width: 72,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.ink,
  },
});
