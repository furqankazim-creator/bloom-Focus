import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Button, Card, Notice, Screen, T } from '../components/ui';
import { normalizeCode } from '../store/seed';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { Role } from '../types';

const ROLES: { id: Role; icon: React.ComponentProps<typeof Feather>['name']; title: string; points: string[] }[] = [
  {
    id: 'therapist',
    icon: 'clipboard',
    title: 'I’m a therapist',
    points: ['Set up child profiles and activity plans', 'Run guided sessions and fine-tune the engine', 'Review progress and parent notes'],
  },
  {
    id: 'parent',
    icon: 'home',
    title: 'I’m a parent',
    points: ['Follow the plan your therapist set', 'Run short home practice sessions', 'See progress in plain language'],
  },
];

export default function WelcomeScreen() {
  const children = useStore((s) => s.children);
  const signIn = useStore((s) => s.signIn);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const match = code.length === 6 ? children.find((c) => c.familyCode === code) : undefined;

  const ready = role === 'therapist' ? name.trim().length > 0 : role === 'parent' && name.trim().length > 0 && !!match;

  return (
    <Screen>
      <View style={[styles.row, { gap: 14, marginTop: 12 }]}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="clover" size={36} color={colors.lime} />
        </View>
        <View>
          <Text style={styles.brand}>bloom focus</Text>
          <T.Eyebrow style={{ marginBottom: 0, marginTop: 2 }}>Adaptive attention practice</T.Eyebrow>
        </View>
      </View>

      <T.Display style={{ marginTop: 36 }}>Little steps.{'\n'}Bright blooms.</T.Display>
      <T.Body style={{ marginTop: 10, fontSize: 16 }}>
        Short, playful activities that adjust to each child after every round. Who is using the app today?
      </T.Body>

      <View style={{ gap: 12, marginTop: 24 }}>
        {ROLES.map((r) => (
          <Card key={r.id} selected={role === r.id} onPress={() => setRole(r.id)}>
            <View style={[styles.row, { gap: 14 }]}>
              <View style={[styles.roleIcon, role === r.id && { backgroundColor: colors.lime }]}>
                <Feather name={r.icon} size={22} color={colors.forest} />
              </View>
              <T.H3 style={{ flex: 1, fontSize: 18 }}>{r.title}</T.H3>
              <Feather name={role === r.id ? 'check-circle' : 'circle'} size={22} color={role === r.id ? colors.forest : colors.border} />
            </View>
            {r.points.map((p) => (
              <View key={p} style={[styles.row, { gap: 10, marginTop: 10 }]}>
                <View style={styles.dot} />
                <T.Body style={{ flex: 1, fontSize: 14 }}>{p}</T.Body>
              </View>
            ))}
          </Card>
        ))}
      </View>

      {role && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.label}>{role === 'therapist' ? 'How should we greet you?' : 'Your first name'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={role === 'therapist' ? 'e.g. Dr. Fatima' : 'e.g. Ayesha'}
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />
          {role === 'parent' && (
            <>
              <Text style={[styles.label, { marginTop: 20 }]}>Family code from your therapist</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(normalizeCode(t).slice(0, 6))}
                placeholder="e.g. AL8K2Q"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, styles.codeInput]}
              />
              {match ? (
                <Card style={[styles.row, { gap: 12, paddingVertical: 12, marginTop: 12 }]} selected>
                  <Avatar name={match.name} color={match.color} photo={match.photo} emoji={match.avatarEmoji} size={42} />
                  <T.H3 style={{ flex: 1 }}>{match.name}</T.H3>
                  <Feather name="check-circle" size={22} color={colors.forest} />
                </Card>
              ) : code.length === 6 ? (
                <T.Small style={{ color: colors.danger, marginTop: 8 }}>No child matches that code. Check it with your therapist.</T.Small>
              ) : null}
              <T.Small style={{ marginTop: 10 }}>
                Demo codes: {children.map((c) => `${c.name.split(' ')[0]} ${c.familyCode}`).join(' · ')}
              </T.Small>
            </>
          )}
        </View>
      )}

      <Button
        label="Continue"
        icon="arrow-right"
        disabled={!ready}
        onPress={() => role && signIn(role, name.trim(), role === 'parent' ? match?.id ?? null : null)}
        style={{ marginTop: 28 }}
      />
      <Notice
        icon="lock"
        style={{ marginTop: 16 }}
        text="Demo mode keeps everything on this device. Use nicknames; avoid medical, contact, or other sensitive details."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#14253F', alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: font.bold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  roleIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.leaf },
  label: { fontFamily: font.semibold, fontSize: 15, color: colors.ink, marginBottom: 10 },
  codeInput: { fontFamily: font.bold, fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  input: {
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.ink,
  },
});
