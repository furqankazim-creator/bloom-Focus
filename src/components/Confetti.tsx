import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, StyleSheet } from 'react-native';

const PIECES = ['🎉', '⭐', '✨', '🎊', '💫', '🌟'];

/** A one-shot burst of falling emoji, drawn over everything and ignoring touches. */
export function Confetti({ count = 26, emojis = PIECES }: { count?: number; emojis?: string[] }) {
  const { width, height } = Dimensions.get('window');
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.35,
        spin: (Math.random() - 0.5) * 720,
        size: 18 + Math.random() * 14,
        emoji: emojis[i % emojis.length],
      })),
    [count, width, emojis],
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress]);

  return (
    <>
      {pieces.map((p, i) => {
        const t = progress.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.Text
            key={i}
            pointerEvents="none"
            style={[
              styles.piece,
              {
                left: p.x,
                fontSize: p.size,
                opacity: t.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-40, height * 0.9] }) },
                  { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                  { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
                ],
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, zIndex: 50 },
});
