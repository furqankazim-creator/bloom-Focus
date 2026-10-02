import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { relativeDay } from '../screens/helpers';
import {
  getCloudProfile,
  isCloudConfigured,
  listCloudConversations,
  listCloudNotes,
  applyReceipt,
  markCloudThreadRead,
  sendCloudNote,
  subscribeCloudNotes,
  type CloudConversation,
  type CloudProfile,
} from '../services/api';
import { saveLocally } from '../services/attachments';
import { quickReplies } from '../services/noteCards';
import { detailLabels } from '../services/noteDetails';
import { useStore } from '../store/useStore';
import type { Note } from '../types';
import { colors, font } from '../theme';
import { NoteAttachments } from './NoteAttachments';
import { NoteCardView } from './NoteCardView';
import { NoteComposer, type OutgoingMessage } from './NoteComposer';
import { T } from './ui';

/** The private one-to-one therapist ↔ parent notebook for one child. */
export function NotesThread({ childId, limit, fullPage = false }: { childId: string; limit?: number; fullPage?: boolean }) {
  const localRole = useStore((s) => s.role) ?? 'therapist';
  const all = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const markNotesRead = useStore((s) => s.markNotesRead);
  // Tabs stay mounted in the background, so only count messages as read while this screen is showing.
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(null);
  const [cloudNotes, setCloudNotes] = useState<typeof all>([]);
  // Therapists have one private thread per linked parent; parents only ever see their own.
  const [conversations, setConversations] = useState<CloudConversation[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'checking' | 'local' | 'remote' | 'error'>(
    isCloudConfigured ? 'checking' : 'local',
  );
  const [error, setError] = useState('');
  const messageList = React.useRef<ScrollView>(null);

  // Check sign-in, then discover which thread(s) this account can use.
  useEffect(() => {
    let mounted = true;
    setConversations([]);
    setParentId(null);

    const connect = async () => {
      if (!isCloudConfigured) {
        setConnection('local');
        return;
      }
      try {
        const profile = await getCloudProfile();
        if (!mounted) return;
        if (!profile) {
          setConnection('local');
          return;
        }
        setCloudProfile(profile);
        if (profile.role === 'parent') {
          setParentId(profile.id);
        } else {
          const threads = await listCloudConversations(childId);
          if (!mounted) return;
          setConversations(threads);
          setParentId(threads[0]?.parentId ?? null);
        }
        setConnection('remote');
      } catch {
        if (mounted) {
          setConnection('error');
          setError('Could not connect to the shared conversation. Your demo notes are unchanged.');
        }
      }
    };

    void connect();
    return () => {
      mounted = false;
    };
  }, [childId]);

  // Load and follow the selected one-to-one thread.
  useEffect(() => {
    setCloudNotes([]);
    if (!cloudProfile || !parentId) return;
    let mounted = true;
    const refresh = () =>
      listCloudNotes(childId, parentId)
        .then((latest) => mounted && setCloudNotes(latest))
        .catch(() => mounted && setError('Could not load messages. Check your connection.'));
    void refresh();
    // The server only lets a socket join threads the account may read.
    const unsubscribe = subscribeCloudNotes(
      childId,
      parentId,
      (note) => {
        if (mounted) setCloudNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
      },
      (receipt) => mounted && setCloudNotes((prev) => applyReceipt(prev, receipt)),
    );
    // Safety net for flaky networks: catch up when the app returns to the foreground and every 20 s.
    const appSub = AppState.addEventListener('change', (state) => state === 'active' && void refresh());
    const poll = setInterval(() => AppState.currentState === 'active' && void refresh(), 20_000);
    return () => {
      mounted = false;
      unsubscribe();
      appSub.remove();
      clearInterval(poll);
    };
  }, [childId, cloudProfile, parentId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const role = cloudProfile?.role ?? localRole;
  // A signed-in therapist with no linked parents has nobody to message yet.
  const noThread = !!cloudProfile && !parentId;
  const notes = (cloudProfile ? cloudNotes : all)
    .filter((n) => n.childId === childId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(limit ? -limit : 0);

  useEffect(() => {
    if (fullPage) messageList.current?.scrollToEnd({ animated: true });
  }, [fullPage, notes.length]);

  // "New messages" divider: remember where unread messages started when the thread was opened.
  const firstUnreadId = useRef<string | null | undefined>(undefined);
  const unread = notes.filter((n) => n.from !== role && !n.readAt);
  if (firstUnreadId.current === undefined && (connection === 'local' || cloudNotes.length > 0)) {
    firstUnreadId.current = unread[0]?.id ?? null;
  }
  useEffect(() => {
    firstUnreadId.current = undefined;
  }, [childId, parentId]);

  // Mark the other person's messages read while the conversation is actually on screen.
  const unreadCount = unread.length;
  useEffect(() => {
    if (!isFocused || !appActive || unreadCount === 0) return;
    if (cloudProfile && parentId) void markCloudThreadRead(childId, parentId).catch(() => {});
    else if (!cloudProfile) markNotesRead(childId, role);
  }, [isFocused, appActive, unreadCount, cloudProfile, parentId, childId, role, markNotesRead]);

  // Last message I sent that the other person has seen, for the "Seen" footnote.
  const lastMine = [...notes].reverse().find((n) => n.from === role);
  const lastTheirs = notes.length && notes[notes.length - 1].from !== role ? notes[notes.length - 1] : undefined;
  const replies = lastTheirs ? quickReplies(lastTheirs.card, lastTheirs.details?.tags, role) : [];

  const send = async ({ text, attachments, details, card }: OutgoingMessage): Promise<boolean> => {
    if (noThread || connection === 'checking' || connection === 'error') return false;
    setError('');
    try {
      if (cloudProfile && parentId) {
        const sent = await sendCloudNote(childId, parentId, { text, attachments, details, card });
        setCloudNotes((prev) => (prev.some((n) => n.id === sent.id) ? prev : [...prev, sent]));
      } else {
        addNote(childId, role, text, { attachments: saveLocally(attachments), details, card });
      }
      return true;
    } catch (e) {
      const detail = e instanceof Error && /MB|attach|photo|voice|document/i.test(e.message) ? ` ${e.message}` : '';
      setError(`Message was not sent.${detail || ' Check your connection and try again.'}`);
      return false;
    }
  };

  const messageBubbles = notes.map((n, i) => {
    const mine = n.from === role;
    const prev = notes[i - 1];
    const newDay = !prev || dayKey(prev.createdAt) !== dayKey(n.createdAt);
    // Consecutive messages from the same person within a few minutes read as one group.
    const grouped = !newDay && prev.from === n.from && Date.parse(n.createdAt) - Date.parse(prev.createdAt) < GROUP_MS;
    const labels = detailLabels(n.details);
    const hasMedia = !!n.attachments?.length || !!n.card;
    return (
      <React.Fragment key={n.id}>
        {newDay && (
          <View style={styles.dayRow} accessibilityRole="header">
            <Text style={styles.dayLabel}>{dayLabel(n.createdAt)}</Text>
          </View>
        )}
        {fullPage && n.id === firstUnreadId.current && (
          <View style={styles.unreadRow}>
            <View style={styles.unreadLine} />
            <Text style={styles.unreadLabel}>New messages</Text>
            <View style={styles.unreadLine} />
          </View>
        )}
        {!mine && !grouped && <Text style={styles.sender}>{n.from === 'therapist' ? 'Therapist' : 'Parent'}</Text>}
        <View
          style={[
            styles.bubble,
            mine ? styles.mine : styles.theirs,
            grouped && (mine ? styles.mineGrouped : styles.theirsGrouped),
            hasMedia && styles.mediaBubble,
          ]}
        >
          {labels.length > 0 && (
            <View style={styles.detailRow}>
              {labels.map((label) => (
                <View key={label} style={[styles.detailChip, mine && styles.detailChipMine]}>
                  <Text style={styles.detailText}>{label}</Text>
                </View>
              ))}
            </View>
          )}
          {!!n.card && <NoteCardView card={n.card} childId={childId} createdAt={n.createdAt} viewer={role} />}
          {!!n.attachments?.length && <NoteAttachments items={n.attachments} />}
          {!!n.text && <Text style={styles.text}>{n.text}</Text>}
          <View style={styles.footer}>
            <Text style={[styles.time, mine && styles.mineTime]}>{timeLabel(n.createdAt)}</Text>
            {mine && <Ticks note={n} />}
          </View>
        </View>
        {mine && n.id === lastMine?.id && !!n.readAt && fullPage && (
          <View style={styles.seen}>
            <Feather name="eye" size={11} color={colors.inkMuted} />
            <Text style={styles.seenText}>
              Seen {relativeDay(n.readAt) === 'Today' ? timeLabel(n.readAt) : relativeDay(n.readAt).toLowerCase()}
            </Text>
          </View>
        )}
      </React.Fragment>
    );
  });

  const status = connection === 'checking'
    ? 'Connecting to your conversation…'
    : connection === 'remote'
      ? role === 'parent'
        ? 'Private conversation with the therapist · live updates'
        : 'Private conversation with this parent · live updates'
      : connection === 'error'
        ? 'Shared conversation unavailable'
        : 'Demo conversation · saved on this device only';

  return (
    <View style={[styles.thread, fullPage && styles.fullThread]}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, connection === 'remote' && styles.statusLive, connection === 'error' && styles.statusError]} />
        <T.Small style={styles.statusText}>{status}</T.Small>
      </View>
      {role === 'therapist' && conversations.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threads}>
          {conversations.map((c) => {
            const active = c.parentId === parentId;
            return (
              <Pressable
                key={c.parentId}
                onPress={() => setParentId(c.parentId)}
                style={[styles.threadChip, active && styles.threadChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Conversation with ${c.displayName}`}
              >
                <Text style={[styles.threadLabel, active && { color: colors.white }]}>{c.displayName}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {noThread && connection === 'remote' ? (
        <View style={[styles.empty, fullPage && styles.fullEmpty]}>
          <Feather name="message-circle" size={30} color={colors.inkMuted} />
          <T.H3 style={{ marginTop: 10 }}>No family conversation yet</T.H3>
          <T.Body style={{ textAlign: 'center', marginTop: 5 }}>After a parent accepts this child’s invitation, their private chat will appear here.</T.Body>
        </View>
      ) : (
        <>
          {fullPage ? (
            <ScrollView
              ref={messageList}
              style={styles.messageList}
              contentContainerStyle={[styles.messageContent, notes.length === 0 && styles.emptyMessageContent]}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => messageList.current?.scrollToEnd({ animated: true })}
            >
              {notes.length === 0 ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}><Feather name="message-circle" size={28} color={colors.forest} /></View>
                  <T.H3 style={{ marginTop: 12 }}>Start the conversation</T.H3>
                  <T.Body style={{ textAlign: 'center', marginTop: 5 }}>Share a small update, a question, or what helped today.</T.Body>
                </View>
              ) : messageBubbles}
            </ScrollView>
          ) : (
            <View style={styles.previewMessages}>
              {notes.length === 0 ? <T.Body>No messages yet. Share what you notice — it helps the plan fit.</T.Body> : messageBubbles}
            </View>
          )}
        </>
      )}
      {!!error && <T.Small style={{ color: colors.danger, paddingHorizontal: 14 }}>{error}</T.Small>}
      {!noThread && (
        <NoteComposer
          childId={childId}
          role={role}
          placeholder={role === 'parent' ? 'Message the therapist…' : 'Message the family…'}
          disabled={connection === 'checking' || connection === 'error'}
          quickReplies={replies.map((r) => r.label)}
          onSend={send}
        />
      )}
    </View>
  );
}

const GROUP_MS = 5 * 60 * 1000;
const READ_BLUE = '#2B8CE0';
const TICK_SIZE = 13;

/**
 * ✓ Sent (one grey check) ·
 * ✓✓ Delivered (two grey checks, slightly offset) ·
 * ✓✓ Read (two blue checks, offset)
 */
function Ticks({ note }: { note: Note }) {
  const state: 'sent' | 'delivered' | 'read' = note.readAt ? 'read' : note.deliveredAt ? 'delivered' : 'sent';
  const label = state === 'read' ? 'Read' : state === 'delivered' ? 'Delivered' : 'Sent';
  const color = state === 'read' ? READ_BLUE : colors.inkMuted;
  return (
    <View
      style={styles.ticks}
      accessibilityLabel={label}
      aria-live="polite"
    >
      <Feather name="check" size={TICK_SIZE} color={color} style={styles.tickFirst} />
      {state !== 'sent' && <Feather name="check" size={TICK_SIZE} color={color} style={styles.tickSecond} />}
    </View>
  );
}

const dayKey = (iso: string) => new Date(iso).toDateString();

function dayLabel(iso: string) {
  const rel = relativeDay(iso);
  if (rel === 'Today' || rel === 'Yesterday') return rel;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const styles = StyleSheet.create({
  thread: { gap: 10 },
  fullThread: { flex: 1, minHeight: 0, gap: 0, backgroundColor: '#F5F3EC' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.sage },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkMuted },
  statusLive: { backgroundColor: colors.leaf },
  statusError: { backgroundColor: colors.danger },
  statusText: { flex: 1, fontSize: 11 },
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 14 },
  emptyMessageContent: { flexGrow: 1, justifyContent: 'center' },
  previewMessages: {},
  dayRow: { alignItems: 'center', marginTop: 14, marginBottom: 6 },
  dayLabel: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.inkSoft,
    backgroundColor: colors.sage,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sender: { fontFamily: font.semibold, fontSize: 11, color: colors.inkSoft, marginTop: 8, marginBottom: 3, marginLeft: 12 },
  bubble: {
    maxWidth: '82%',
    minWidth: 76,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
    gap: 6,
  },
  mediaBubble: { paddingHorizontal: 6, paddingTop: 6 },
  mine: { backgroundColor: colors.mint, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  theirs: {
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // Grouped bubbles sit closer together and square off the corner joining them to the one above.
  mineGrouped: { marginTop: 2, borderTopRightRadius: 6 },
  theirsGrouped: { marginTop: 2, borderTopLeftRadius: 6 },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  detailChip: { height: 24, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.sage },
  detailChipMine: { backgroundColor: 'rgba(255,255,255,0.65)' },
  detailText: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.forest },
  text: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: colors.ink, paddingHorizontal: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: -2 },
  time: { fontFamily: font.regular, fontSize: 10.5, color: colors.inkMuted },
  mineTime: { color: colors.inkSoft },
  ticks: { flexDirection: 'row', alignItems: 'center', width: 22, height: 14 },
  tickFirst: {},
  tickSecond: { marginLeft: -7 },
  seen: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(96, 123, 108, 0.08)',
  },
  seenText: { fontFamily: font.medium, fontSize: 10.5, color: colors.inkMuted },
  unreadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 2 },
  unreadLine: { flex: 1, height: 1, backgroundColor: colors.peach },
  unreadLabel: { fontFamily: font.semibold, fontSize: 11, color: colors.danger },
  threads: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  threadChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  threadChipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  threadLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  fullEmpty: { flex: 1 },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
});
