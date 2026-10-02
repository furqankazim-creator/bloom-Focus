import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatBytes, formatDuration } from '../services/attachments';
import { colors, font } from '../theme';
import type { NoteAttachment } from '../types';

/** Photos, voice notes and files inside a message bubble. */
export function NoteAttachments({ items }: { items: NoteAttachment[] }) {
  const [viewing, setViewing] = useState<NoteAttachment | null>(null);
  const images = items.filter((a) => a.kind === 'image');
  const others = items.filter((a) => a.kind !== 'image');
  return (
    <View style={{ gap: 8 }}>
      {images.length > 0 && (
        <View style={styles.grid}>
          {images.map((a) => (
            <Thumb key={a.id} item={a} large={images.length === 1} onPress={() => setViewing(a)} />
          ))}
        </View>
      )}
      {others.map((a) => (a.kind === 'audio' ? <VoiceNote key={a.id} item={a} /> : <FileCard key={a.id} item={a} />))}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && <Image source={{ uri: viewing.url }} style={styles.viewerImage} resizeMode="contain" accessibilityLabel={viewing.name} />}
          <Pressable onPress={() => setViewing(null)} style={styles.viewerClose} accessibilityLabel="Close photo" hitSlop={12}>
            <Feather name="x" size={24} color={colors.white} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Thumb({ item, large, onPress }: { item: NoteAttachment; large: boolean; onPress: () => void }) {
  const [failed, setFailed] = useState(false);
  const size = large ? 220 : 104;
  if (failed) {
    return (
      <View style={[styles.thumb, styles.missing, { width: size, height: size }]}>
        <Feather name="image" size={20} color={colors.inkMuted} />
        <Text style={styles.missingText}>Photo unavailable</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={`Open photo ${item.name}`}>
      <Image source={{ uri: item.url }} style={[styles.thumb, { width: size, height: size }]} onError={() => setFailed(true)} />
    </Pressable>
  );
}

function VoiceNote({ item }: { item: NoteAttachment }) {
  const player = useAudioPlayer({ uri: item.url });
  const status = useAudioPlayerStatus(player);
  const durationMs = status.duration > 0 ? status.duration * 1000 : (item.durationMs ?? 0);
  const positionMs = status.currentTime * 1000;
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  const toggle = () => {
    if (status.playing) return player.pause();
    if (status.didJustFinish || (durationMs > 0 && positionMs >= durationMs - 100)) void player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.voice}>
      <Pressable
        onPress={toggle}
        style={styles.play}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
      >
        <Feather name={status.playing ? 'pause' : 'play'} size={18} color={colors.white} />
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.small}>
          {status.playing || positionMs > 0 ? `${formatDuration(positionMs)} / ` : ''}
          {durationMs ? formatDuration(durationMs) : 'Voice note'}
        </Text>
      </View>
    </View>
  );
}

function FileCard({ item }: { item: NoteAttachment }) {
  const open = async () => {
    // Device files (demo mode) go through the share sheet; server files open from their link.
    if (item.url.startsWith('file:') && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(item.url, { mimeType: item.mimeType, dialogTitle: item.name });
    } else {
      await Linking.openURL(item.url);
    }
  };
  return (
    <Pressable onPress={() => void open().catch(() => {})} style={styles.file} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
      <View style={styles.fileIcon}>
        <Feather name="file-text" size={18} color={colors.forest} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.size && <Text style={styles.small}>{formatBytes(item.size)}</Text>}
      </View>
      <Feather name="external-link" size={16} color={colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { borderRadius: 14, backgroundColor: colors.border },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  missingText: { fontFamily: font.regular, fontSize: 11, color: colors.inkMuted },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  viewerClose: { position: 'absolute', top: 56, right: 20, padding: 8 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 },
  play: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: colors.forest },
  small: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 200,
  },
  fileIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontFamily: font.medium, fontSize: 14, color: colors.ink },
});
