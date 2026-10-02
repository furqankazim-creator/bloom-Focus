import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';

export function PinGate({ children }: { children: React.ReactNode }) {
  const parentPin = useStore((s) => s.parentPin);
  const [unlocked, setUnlocked] = useState(false);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  // A PIN set or changed while this screen is open was set by someone already inside, so don't lock them out.
  const pinAtMount = useRef(parentPin);

  if (!parentPin || unlocked || parentPin !== pinAtMount.current) {
    return <>{children}</>;
  }

  const handlePress = (num: string) => {
    if (entry.length >= 4) return;
    const next = entry + num;
    setEntry(next);
    setError(false);

    if (next.length === 4) {
      if (next === parentPin) {
        setUnlocked(true);
      } else {
        setError(true);
        setTimeout(() => setEntry(''), 500);
      }
    }
  };

  const handleBackspace = () => {
    setEntry((e) => e.slice(0, -1));
    setError(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name="lock" size={36} color={colors.forest} />
      </View>
      <Text style={styles.title}>Parent Area</Text>
      <Text style={styles.sub}>Enter your 4-digit PIN to continue</Text>

      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              entry.length > i && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </View>

      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((k, i) => (
          <View key={i} style={styles.keyWrap}>
            {k === '' ? null : k === '<' ? (
              <Pressable style={styles.key} onPress={handleBackspace}>
                <Feather name="delete" size={22} color={colors.ink} />
              </Pressable>
            ) : (
              <Pressable style={styles.key} onPress={() => handlePress(k)}>
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E4EDE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: font.bold,
    color: colors.ink,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    fontFamily: font.medium,
    color: colors.inkSoft,
    marginBottom: 32,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CCD6C8',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  dotError: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 270,
    justifyContent: 'center',
  },
  keyWrap: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 8,
  },
  key: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyText: {
    fontSize: 26,
    fontFamily: font.bold,
    color: colors.ink,
  },
});
