import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { Tally, pick, useTicker } from '../common';
import { FeedbackPill, TrainGameProps, useFeedback } from './shared';

type Piece = { shape: string; color: string };

const SHAPES = ['●', '■', '▲', '◆', '✚', '★'];
const PALETTE = ['#2E8B57', '#E58A42', '#3D83B8', '#C94F58', '#8059A5', '#C3A02F'];
const PIECE_COUNT = (distractors: number) => Math.max(3, Math.min(8, 3 + distractors));

function makeRound(count: number) {
  const target: Piece = { shape: pick(SHAPES), color: pick(PALETTE) };
  const options = [target];
  while (options.length < count) {
    const candidate = { shape: pick(SHAPES), color: pick(PALETTE) };
    if (!options.some((option) => option.shape === candidate.shape && option.color === candidate.color)) {
      options.push(candidate);
    }
  }
  for (let index = options.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
  }
  return { target, options, answer: options.findIndex((option) => option.shape === target.shape && option.color === target.color) };
}

export default function PuzzleMatchTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const [round, setRound] = useState(() => makeRound(PIECE_COUNT(params.distractors)));
  const [selected, setSelected] = useState<number | null>(null);
  const elapsed = useRef(0);
  const tally = useRef(new Tally());
  const done = useRef(false);
  const { fb, good, bad } = useFeedback();
  const pieceCount = PIECE_COUNT(params.distractors);

  useTicker(paused, (dt) => {
    elapsed.current += dt;
    if (!done.current && elapsed.current >= durationSec * 1000) {
      done.current = true;
      onDone(tally.current.result(elapsed.current));
    }
  }, 100);

  const choosePiece = (index: number) => {
    if (paused || done.current || selected !== null) return;
    setSelected(index);
    if (index === round.answer) {
      tally.current.hit();
      onCorrect();
      good('Matching piece!');
    } else {
      tally.current.falseTap();
      bad('Look closely at both the shape and color.');
    }
      setTimeout(() => {
      if (done.current) return;
      setSelected(null);
      setRound(makeRound(pieceCount));
    }, 550);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Puzzle Match</Text>
      <Text style={styles.caption}>Match the piece by its shape and color.</Text>
      <View style={styles.targetWrap}>
        <Text style={styles.label}>MATCH THIS PIECE</Text>
        <View style={[styles.piece, styles.targetPiece, { backgroundColor: round.target.color }]}>
          <Text style={styles.shape}>{round.target.shape}</Text>
        </View>
      </View>
      <View style={styles.options}>
        {round.options.map((piece, index) => {
          const isSelected = selected === index;
          const isCorrect = selected !== null && index === round.answer;
          return (
            <Pressable
              key={`${piece.shape}-${piece.color}-${index}`}
              onPress={() => choosePiece(index)}
              disabled={paused || selected !== null}
              accessibilityRole="button"
              accessibilityLabel={`Puzzle piece ${index + 1}, ${piece.color} ${piece.shape === '●' ? 'circle' : 'shape'}`}
              style={[
                styles.piece,
                styles.option,
                { backgroundColor: piece.color },
                isSelected && !isCorrect && styles.wrong,
                isCorrect && styles.correct,
              ]}
            >
              <Text style={styles.shape}>{piece.shape}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{pieceCount} choices</Text>
      <FeedbackPill fb={fb} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FAF9F5', borderRadius: 24 },
  title: { fontFamily: font.heavy, fontSize: 24, color: colors.ink },
  caption: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, marginBottom: 18, textAlign: 'center' },
  targetWrap: { alignItems: 'center', marginBottom: 18 },
  label: { fontFamily: font.bold, fontSize: 11, color: colors.inkMuted, marginBottom: 8 },
  piece: { width: 66, height: 66, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(30,58,47,0.12)' },
  targetPiece: { width: 82, height: 82, borderRadius: 20 },
  shape: { fontSize: 38, color: colors.white, textAlign: 'center', textAlignVertical: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 320 },
  option: { width: 68, height: 68 },
  wrong: { borderColor: colors.danger, opacity: 0.55 },
  correct: { borderColor: colors.forest, borderWidth: 5 },
  hint: { fontFamily: font.medium, fontSize: 13, color: colors.inkMuted, marginTop: 16 },
});
