import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, IconButton, Screen, T } from '../../components/ui';
import { NotesThread } from '../../components/NotesThread';
import { relativeDay } from '../helpers';
import { useStore } from '../../store/useStore';
import { cardSummary } from '../../services/noteCards';
import { colors, font } from '../../theme';

import type { Note } from '../../types';

const READ_BLUE = '#2B8CE0';

/** Compact ticks preview for the thread list (matches NotesThread.Ticks visual style). */
function MiniTicks({ note }: { note: Note }) {
  const state: 'sent' | 'delivered' | 'read' = note.readAt ? 'read' : note.deliveredAt ? 'delivered' : 'sent';
  const color = state === 'read' ? READ_BLUE : colors.inkMuted;
  return (
    <View style={styles.miniTicks}>
      <Feather name="check" size={11} color={color} />
      {state !== 'sent' && <Feather name="check" size={11} color={color} style={styles.miniTickSecond} />}
    </View>
  );
}

export default function TherapistMessagesScreen() {
  const children = useStore((s) => s.children);
  const notes = useStore((s) => s.notes);
  const [query, setQuery] = useState('');
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const activeChild = children.find((child) => child.id === activeChildId);

  const threads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return children
      .map((child) => {
        const childNotes = notes.filter((note) => note.childId === child.id);
        const sorted = [...childNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latest = sorted[0];
        const unread = childNotes.filter((n) => n.from !== 'therapist' && !n.readAt).length;
        return { child, latest, unread };
      })
      .filter(({ child }) => child.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => (b.latest?.createdAt ?? '').localeCompare(a.latest?.createdAt ?? ''));
  }, [children, notes, query]);

  if (activeChild) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen scroll={false} contentStyle={styles.chatScreen}>
          <View style={styles.chatHeader}>
            <IconButton icon="arrow-left" label="Back to messages" bg="transparent" onPress={() => setActiveChildId(null)} />
            <Avatar name={activeChild.name} color={activeChild.color} photo={activeChild.photo} emoji={activeChild.avatarEmoji} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.chatName} numberOfLines={1}>{activeChild.name}</Text>
              <Text style={styles.chatSubtitle} numberOfLines={1}>Private family conversation</Text>
            </View>
          </View>
          <NotesThread childId={activeChild.id} fullPage />
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  return (
    <Screen>
      <T.Eyebrow>Family conversations</T.Eyebrow>
      <T.Display>Messages</T.Display>
      <T.Body style={{ marginTop: 6 }}>One private conversation for each child and their family.</T.Body>

      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.inkSoft} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search children"
          placeholderTextColor={colors.inkMuted}
          style={styles.searchInput}
          accessibilityLabel="Search conversations by child name"
        />
        {!!query && <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search"><Feather name="x-circle" size={18} color={colors.inkMuted} /></Pressable>}
      </View>

      <View style={styles.listHeader}>
        <T.H3>Chats</T.H3>
        <T.Small>{threads.length} {threads.length === 1 ? 'child' : 'children'}</T.Small>
      </View>

      <View style={styles.threadList}>
        {threads.map(({ child, latest, unread }) => {
          const mine = latest?.from === 'therapist';
          const preview = latest?.card
            ? `${mine ? 'You: ' : ''}${cardSummary(latest.card)}`
            : latest
              ? `${mine ? 'You' : 'Parent'}: ${latest.text || (latest.attachments?.length ? '📎 Attachment' : '')}`
              : 'No messages yet · start a conversation';
          return (
            <Pressable
              key={child.id}
              onPress={() => setActiveChildId(child.id)}
              accessibilityRole="button"
              accessibilityLabel={`Open messages for ${child.name}${unread ? ` · ${unread} unread` : ''}`}
              style={({ pressed }) => [styles.threadRow, pressed && styles.threadPressed, unread > 0 && styles.threadRowUnread]}
            >
              <View style={styles.avatarWrap}>
                <Avatar name={child.name} color={child.color} photo={child.photo} emoji={child.avatarEmoji} size={54} />
                {unread > 0 && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.threadInfo}>
                <View style={styles.threadTop}>
                  <Text style={[styles.childName, unread > 0 && styles.childNameBold]} numberOfLines={1}>
                    {child.name}
                  </Text>
                  {latest && <Text style={styles.threadDate}>{relativeDay(latest.createdAt)}</Text>}
                </View>
                <View style={styles.previewRow}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {mine && latest && <MiniTicks note={latest} />}
                    <Text style={[styles.preview, unread > 0 && styles.previewBold]} numberOfLines={1}>
                      {preview}
                    </Text>
                  </View>
                  <View style={styles.rightBadges}>
                    {unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={18} color={unread > 0 ? colors.ink : colors.inkMuted} />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
        {threads.length === 0 && (
          <View style={styles.noResults}>
            <Feather name="message-circle" size={26} color={colors.inkMuted} />
            <T.Body style={{ marginTop: 10 }}>{children.length ? 'No child matches that search.' : 'Add a child profile to start a family conversation.'}</T.Body>
          </View>
        )}
      </View>

      <Text style={styles.disclaimer}>Demo conversations stay on this device. Remote conversations require an authenticated account and linked family.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chatScreen: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  chatHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  chatName: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  chatSubtitle: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  search: { height: 48, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.ink },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 4 },
  threadList: { marginTop: 4 },
  threadRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  threadRowUnread: { backgroundColor: 'rgba(214, 234, 220, 0.22)' },
  threadPressed: { opacity: 0.72 },
  avatarWrap: { position: 'relative' },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.leaf,
    borderWidth: 2,
    borderColor: colors.card,
  },
  threadInfo: { flex: 1, minWidth: 0, gap: 7 },
  threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  childName: { flex: 1, fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  childNameBold: { fontFamily: font.bold, color: colors.ink },
  threadDate: { fontFamily: font.regular, fontSize: 11, color: colors.inkMuted },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.inkSoft },
  previewBold: { fontFamily: font.semibold, color: colors.ink },
  rightBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.leaf,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { fontFamily: font.bold, fontSize: 10.5, color: colors.white },
  miniTicks: { flexDirection: 'row', alignItems: 'center', width: 18 },
  miniTickSecond: { marginLeft: -6 },
  noResults: { alignItems: 'center', padding: 28, marginTop: 12 },
  disclaimer: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.inkMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 12 },
});
