import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Avatar, Screen, T } from '../../components/ui';
import { NotesThread } from '../../components/NotesThread';
import { useStore } from '../../store/useStore';
import { colors, font } from '../../theme';

export default function ParentNotesScreen() {
  const child = useStore((s) => s.children.find((c) => c.id === s.parentChildId) ?? s.children[0]);
  if (!child) {
    return (
      <Screen>
        <T.Display>Messages</T.Display>
        <T.Body style={{ marginTop: 8 }}>Link a child profile to start a private conversation with the therapist.</T.Body>
      </Screen>
    );
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false} contentStyle={styles.screenContent}>
        <View style={styles.header}>
          <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{child.name}</Text>
            <Text style={styles.subtitle}>Private conversation with your therapist</Text>
          </View>
        </View>
        <NotesThread childId={child.id} fullPage />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  name: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  subtitle: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
});
