import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, pick, useTicker } from './common';
import { FeedbackPill, useFeedback } from './train/shared';

const CARD_MS = [3000, 2400, 1900, 1500, 1150];

type CardItem = {
  id: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  label: string;
};

const BASIC_CARDS: CardItem[] = [
  { id: 'star', icon: 'star', color: '#F59E0B', label: 'Star' },
  { id: 'heart', icon: 'heart', color: '#EF4444', label: 'Heart' },
  { id: 'circle', icon: 'circle', color: '#3B82F6', label: 'Circle' },
  { id: 'clover', icon: 'clover', color: '#10B981', label: 'Clover' },
  { id: 'diamond', icon: 'rhombus', color: '#8B5CF6', label: 'Diamond' },
  { id: 'moon', icon: 'moon-waxing-crescent', color: '#6366F1', label: 'Moon' },
];

const LURE_CARDS: CardItem[] = [
  { id: 'square', icon: 'square', color: '#10B981', label: 'Square' },
  { id: 'rounded-square', icon: 'square-rounded', color: '#059669', label: 'Round Square' },
  { id: 'hexagon', icon: 'hexagon', color: '#F59E0B', label: 'Hexagon' },
  { id: 'octagon', icon: 'octagram', color: '#D97706', label: 'Star Octagon' },
];

export default function SpeedMatch({ params, paused, onCorrect, onDone }: GameProps) {
  const cardMs = CARD_MS[params.speed - 1] ?? 1900;
  const pool = params.distractors >= 2 ? [...BASIC_CARDS, ...LURE_CARDS] : BASIC_CARDS;
  const { fb, good, bad } = useFeedback();

  const [prevCard, setPrevCard] = useState<CardItem | null>(null);
  const [currentCard, setCurrentCard] = useState<CardItem>(() => pick(pool));
  const [isFirstCard, setIsFirstCard] = useState(true);

  const r = useRef({
    elapsed: 0,
    cardAt: 500,
    tally: new Tally(),
    done: false,
    answered: false,
  });
  const [, force] = useState(0);

  const nextCard = (lastCard: CardItem) => {
    const st = r.current;
    st.cardAt = st.elapsed + 250;
    st.answered = false;
    setPrevCard(lastCard);

    // 45% match probability
    const willMatch = Math.random() < 0.45;
    if (willMatch) {
      setCurrentCard(lastCard);
    } else {
      const others = pool.filter((c) => c.id !== lastCard.id);
      setCurrentCard(pick(others));
    }
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;

    if (st.elapsed >= params.durationSec * 1000) {
      st.done = true;
      onDone(st.tally.result(st.elapsed));
      return;
    }

    if (isFirstCard) {
      if (st.elapsed - st.cardAt >= 1600) {
        setIsFirstCard(false);
        nextCard(currentCard);
      }
      force((x) => x + 1);
      return;
    }

    if (!st.answered && st.elapsed - st.cardAt >= cardMs) {
      const wasMatch = prevCard && currentCard.id === prevCard.id;
      if (wasMatch) {
        st.tally.miss();
        bad('Missed! They matched');
      } else {
        st.tally.reject();
      }
      nextCard(currentCard);
    }
    force((x) => x + 1);
  });

  const handleResponse = (saidMatch: boolean) => {
    const st = r.current;
    if (st.done || paused || st.answered || isFirstCard || st.elapsed < st.cardAt) return;
    st.answered = true;

    const actualMatch = prevCard !== null && currentCard.id === prevCard.id;
    if (saidMatch === actualMatch) {
      if (saidMatch) {
        st.tally.hit(st.elapsed - st.cardAt);
        onCorrect();
        good('Match! ⚡');
      } else {
        st.tally.reject();
        onCorrect();
        good('Different! ⚡');
      }
    } else {
      st.tally.falseTap();
      bad(actualMatch ? 'Oops! They matched' : 'Oops! They were different');
    }

    nextCard(currentCard);
  };

  const st = r.current;
  const inGap = st.elapsed < st.cardAt;
  const timeLeft = isFirstCard ? 1 : inGap ? 1 : Math.max(0, 1 - (st.elapsed - st.cardAt) / cardMs);

  return (
    <View style={styles.container}>
      <FeedbackPill fb={fb} top={8} />

      <View style={styles.header}>
        <Text style={styles.title}>Flash Match</Text>
        <Text style={styles.subtitle}>
          {isFirstCard
            ? 'Look at this card and remember it…'
            : 'Does this match the card shown right before?'}
        </Text>
      </View>

      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timeLeft * 100}%` }]} />
      </View>

      {/* Main Flash Card Stage */}
      <View style={styles.stage}>
        {!inGap && (
          <View style={styles.cardBox}>
            <MaterialCommunityIcons name={currentCard.icon} size={110} color={currentCard.color} />
            <Text style={[styles.cardLabel, { color: currentCard.color }]}>{currentCard.label}</Text>
          </View>
        )}

        {isFirstCard && (
          <View style={styles.firstCardNotice}>
            <Text style={styles.firstCardText}>Get ready…</Text>
          </View>
        )}
      </View>

      {/* Big Action Buttons (No vs Yes) */}
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnNo, pressed && styles.btnPressed, isFirstCard && styles.btnDisabled]}
          onPress={() => handleResponse(false)}
          disabled={isFirstCard}
          accessibilityLabel="Different"
        >
          <Feather name="x" size={28} color={colors.white} />
          <Text style={styles.btnText}>DIFFERENT</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnYes, pressed && styles.btnPressed, isFirstCard && styles.btnDisabled]}
          onPress={() => handleResponse(true)}
          disabled={isFirstCard}
          accessibilityLabel="Match"
        >
          <Feather name="check" size={28} color={colors.white} />
          <Text style={styles.btnText}>MATCH</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  header: { alignItems: 'center', marginVertical: 6 },
  title: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  subtitle: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  timerBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginVertical: 8, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.forest, borderRadius: 3 },
  stage: {
    flex: 1,
    backgroundColor: '#F8F7F4',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E4DC',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    minHeight: 220,
  },
  cardBox: {
    backgroundColor: colors.white,
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardLabel: { fontFamily: font.bold, fontSize: 16, marginTop: 8 },
  firstCardNotice: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  firstCardText: { fontFamily: font.semibold, fontSize: 13, color: colors.forest },
  btnRow: { flexDirection: 'row', gap: 14, marginTop: 8, marginBottom: 12 },
  btn: {
    flex: 1,
    height: 72,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  btnNo: { backgroundColor: '#EF5A4C' },
  btnYes: { backgroundColor: '#1DB988' },
  btnPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: font.heavy, fontSize: 17, color: colors.white, letterSpacing: 0.5 },
});
