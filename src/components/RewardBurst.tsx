import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { RewardTheme } from '../types';
import { MciName } from './ui';

export const REWARD_ICON: Record<RewardTheme, { icon: MciName; color: string; label: string }> = {
  stars: { icon: 'star', color: '#E9B949', label: 'Stars' },
  animals: { icon: 'paw', color: '#C98B5E', label: 'Animals' },
  vehicles: { icon: 'car-side', color: '#5B8DB8', label: 'Vehicles' },
  nature: { icon: 'flower', color: '#E07A9F', label: 'Flowers' },
  celebration: { icon: 'party-popper', color: '#9C7FC1', label: 'Celebrations' },
};

/** Pops the child's chosen reward icon each time `count` goes up. */
export function RewardBurst({ theme, count }: { theme: RewardTheme; count: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(anim, { toValue: 0, duration: 350, delay: 250, useNativeDriver: true }),
    ]).start();
  }, [count, anim]);

  const r = REWARD_ICON[theme];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.burst,
        {
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
          ],
        },
      ]}
    >
      <MaterialCommunityIcons name={r.icon} size={120} color={r.color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: { position: 'absolute', alignSelf: 'center', top: '35%', zIndex: 20 },
});
