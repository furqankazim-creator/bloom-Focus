import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { NoteAttachment, NoteCard, NoteDetails } from '../types';
import { cardSummary } from './noteCards';
import { detailLabels } from './noteDetails';

/** Something picked or recorded in the composer that hasn't been sent yet. */
export type PendingAttachment = {
  key: string;
  kind: NoteAttachment['kind'];
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  durationMs?: number;
};

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // matches the server limit
export const DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

const key = () => Math.random().toString(36).slice(2, 10);

const extFromMime = (mime: string) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp', 'image/gif': 'gif' })[mime] ?? 'jpg';

/** Photos and screenshots from the library, or a new photo from the camera. Returns [] if cancelled. */
export async function pickImages(source: 'library' | 'camera', remaining: number): Promise<PendingAttachment[]> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === 'camera' ? 'Camera access is off. Turn it on in Settings.' : 'Photo access is off. Turn it on in Settings.');
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: source === 'library',
    selectionLimit: remaining,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return [];
  return res.assets.slice(0, remaining).map((a) => {
    const mimeType = a.mimeType ?? 'image/jpeg';
    return {
      key: key(),
      kind: 'image' as const,
      uri: a.uri,
      name: a.fileName ?? `photo-${key()}.${extFromMime(mimeType)}`,
      mimeType,
      size: a.fileSize ?? 0,
    };
  });
}

export async function pickDocuments(remaining: number): Promise<PendingAttachment[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return res.assets.slice(0, remaining).map((a) => ({
    key: key(),
    kind: 'file' as const,
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType ?? 'application/octet-stream',
    size: a.size ?? 0,
  }));
}

export function voiceNote(uri: string, durationMs: number): PendingAttachment {
  const web = Platform.OS === 'web';
  return {
    key: key(),
    kind: 'audio',
    uri,
    name: `voice-note-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${web ? 'webm' : 'm4a'}`,
    mimeType: web ? 'audio/webm' : 'audio/mp4',
    size: 0,
    durationMs,
  };
}

/**
 * Demo mode keeps attachments on this device. Picker and recorder files live in a cache the
 * system may clear, so copy them into the app's document folder first.
 */
export function saveLocally(items: PendingAttachment[]): NoteAttachment[] {
  const dir = Platform.OS === 'web' ? null : new Directory(Paths.document, 'note-attachments');
  if (dir && !dir.exists) dir.create({ intermediates: true, idempotent: true });
  return items.map((p) => {
    let url = p.uri;
    if (dir) {
      const ext = p.name.includes('.') ? p.name.slice(p.name.lastIndexOf('.')) : '';
      const dest = new File(dir, `${Date.now()}-${p.key}${ext}`);
      new File(p.uri).copy(dest);
      url = dest.uri;
    }
    return { id: p.key, kind: p.kind, mimeType: p.mimeType, name: p.name, size: p.size, durationMs: p.durationMs, url };
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** One-line summary for lists and reports, e.g. "Looks calmer today · 2 photos · voice note". */
export function noteSummary(note: { text: string; attachments?: NoteAttachment[]; details?: NoteDetails; card?: NoteCard }): string {
  const count = (kind: NoteAttachment['kind']) => note.attachments?.filter((a) => a.kind === kind).length ?? 0;
  const parts = [
    note.card && cardSummary(note.card),
    note.text,
    ...detailLabels(note.details),
    count('image') && (count('image') === 1 ? 'photo' : `${count('image')} photos`),
    count('audio') && (count('audio') === 1 ? 'voice note' : `${count('audio')} voice notes`),
    count('file') && (count('file') === 1 ? 'document' : `${count('file')} documents`),
  ].filter(Boolean) as string[];
  const summary = parts.join(' · ');
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}
