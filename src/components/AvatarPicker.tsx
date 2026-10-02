import { Feather } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { Avatar } from './ui';

export const AVATAR_EMOJIS = ['🦊', '🐼', '🐯', '🦁', '🐨', '🐸', '🐵', '🐰', '🐻', '🦄', '🐙', '🐧', '🐶', '🐱', '🦖', '🐝'];

/** Profile pictures are stored inline, so keep them small: 320px JPEG is ~20–40 KB. */
const PHOTO_SIZE = 320;

async function toSmallDataUri(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not read the image');
  return `data:image/jpeg;base64,${out.base64}`;
}

export function AvatarPicker({
  visible,
  onClose,
  name,
  color,
  photo,
  emoji,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  color: string;
  photo?: string | null;
  emoji?: string | null;
  onChange: (patch: { photo: string | null; avatarEmoji: string | null }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (source: 'library' | 'camera') => {
    setError('');
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Camera access was not allowed. You can enable it in Settings.');
          return;
        }
      } else if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError('Photo access was not allowed. You can enable it in Settings.');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      setBusy(true);
      const uri = await toSmallDataUri(res.assets[0].uri);
      onChange({ photo: uri, avatarEmoji: null });
      onClose();
    } catch {
      setError('Something went wrong loading that picture. Please try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Profile picture</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginVertical: 14 }}>
            {busy ? (
              <View style={[styles.preview, { backgroundColor: color }]}>
                <ActivityIndicator color={colors.forest} />
              </View>
            ) : (
              <Avatar name={name} color={color} photo={photo} emoji={emoji} size={96} />
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={styles.action} onPress={() => pick('library')} disabled={busy}>
              <Feather name="image" size={18} color={colors.forest} />
              <Text style={styles.actionText}>Choose photo</Text>
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable style={styles.action} onPress={() => pick('camera')} disabled={busy}>
                <Feather name="camera" size={18} color={colors.forest} />
                <Text style={styles.actionText}>Take photo</Text>
              </Pressable>
            )}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.section}>Or pick a buddy</Text>
          <View style={styles.emojiGrid}>
            {AVATAR_EMOJIS.map((e) => {
              const sel = !photo && emoji === e;
              return (
                <Pressable
                  key={e}
                  onPress={() => {
                    onChange({ photo: null, avatarEmoji: e });
                    onClose();
                  }}
                  style={[styles.emojiCell, sel && styles.emojiSel]}
                  accessibilityLabel={`Use ${e} as avatar`}
                >
                  <Text style={styles.emoji}>{e}</Text>
                </Pressable>
              );
            })}
          </View>

          {(photo || emoji) && (
            <Pressable
              onPress={() => {
                onChange({ photo: null, avatarEmoji: null });
                onClose();
              }}
              style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}
            >
              <Text style={styles.remove}>Use initials instead</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,35,25,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 34,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: font.heavy, fontSize: 19, color: colors.ink },
  preview: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  action: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EEF4EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { fontFamily: font.bold, fontSize: 14, color: colors.forest },
  error: { fontFamily: font.medium, fontSize: 12, color: colors.danger, marginTop: 8, textAlign: 'center' },
  section: { fontFamily: font.bold, fontSize: 13, color: colors.inkSoft, marginTop: 18, marginBottom: 10 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  emojiCell: {
    width: '11%',
    minWidth: 38,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F6F5F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiSel: { borderColor: colors.forest, backgroundColor: '#E4EDE0' },
  emoji: { fontSize: 22, lineHeight: 28 },
  remove: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft },
});
