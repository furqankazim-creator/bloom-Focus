import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Card, Divider, IconButton, Screen, T } from '../../components/ui';
import { pct } from '../../engine/adaptive';
import { DOMAIN_LABEL } from '../../engine/tasks';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';
import { childStats, relativeDay } from '../helpers';

export default function ChildrenScreen() {
  const nav = useNavigation();
  const children = useStore((s) => s.children);
  const sessions = useStore((s) => s.sessions);
  const [q, setQ] = useState('');
  const shown = children.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Screen>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <T.Eyebrow>Your practice space</T.Eyebrow>
          <T.Display>Children</T.Display>
          <T.Body style={{ marginTop: 6 }}>A familiar place for every growing mind.</T.Body>
        </View>
        <IconButton icon="plus" label="Add child" size={60} bg={colors.forest} color={colors.white} onPress={() => nav.navigate('EditChild', {})} />
      </View>

      <View style={styles.search}>
        <Feather name="search" size={20} color={colors.inkSoft} />
        <TextInput value={q} onChangeText={setQ} placeholder="Find a profile" placeholderTextColor={colors.inkMuted} style={styles.searchInput} />
      </View>

      <T.H2 style={{ marginTop: 28, marginBottom: 14 }}>
        {shown.length} {shown.length === 1 ? 'profile' : 'profiles'}
      </T.H2>
      <View style={{ gap: 12 }}>
        {shown.map((c) => {
          const st = childStats(c, sessions);
          return (
            <Card key={c.id} onPress={() => nav.navigate('ChildProfile', { childId: c.id })}>
              <View style={[styles.row, { gap: 16 }]}>
                <Avatar name={c.name} color={c.color} photo={c.photo} emoji={c.avatarEmoji} size={62} />
                <View style={{ flex: 1 }}>
                  <T.H3 style={{ fontSize: 19 }}>{c.name}</T.H3>
                  <T.Body style={{ marginTop: 2 }}>
                    {c.age} years · {DOMAIN_LABEL[c.focus]}
                  </T.Body>
                </View>
                <Feather name="chevron-right" size={22} color={colors.inkSoft} />
              </View>
              <Divider style={{ marginVertical: 14 }} />
              <View style={styles.row}>
                <Stat value={`${st.count}`} label="Sessions" />
                <Stat value={st.avg === null ? '—' : pct(st.avg)} label="Recent avg." />
                <Stat value={`${st.level}`} label="Level" />
                <Stat value={st.last ? relativeDay(st.last.startedAt) : '—'} label="Last seen" />
              </View>
            </Card>
          );
        })}
        {shown.length === 0 && <T.Body>No profiles match “{q}”.</T.Body>}
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 58,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    marginTop: 22,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.ink },
  statValue: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  statLabel: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.2, color: colors.inkSoft, textTransform: 'uppercase', marginTop: 4 },
});
