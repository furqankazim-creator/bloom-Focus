import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { GameProps, Tally, shuffle, useTicker } from './common';
import { FeedbackPill, useFeedback } from './train/shared';

const SHOW_MS = [2200, 1850, 1500, 1200, 950];

type Phase = 'preview' | 'hold' | 'recall' | 'result';

type RoundData = {
  gridSize: number; // 3 for 3x3, 4 for 4x4
  totalCells: number;
  targets: number[];
};

function generateRound(memoryLoad: number): RoundData {
  const count = Math.max(3, Math.min(7, memoryLoad));
  const gridSize = count >= 5 ? 4 : 3;
  const totalCells = gridSize * gridSize;
  const indices = Array.from({ length: totalCells }, (_, i) => i);
  const targets = shuffle(indices).slice(0, count);
  return { gridSize, totalCells, targets };
}

export default function MemoryMatrix({ params, paused, onCorrect, onDone }: GameProps) {
  const showMs = SHOW_MS[params.speed - 1] ?? 1500;
  const holdMs = params.distractors * 500; // 0 to 2500ms
  const { fb, good, bad } = useFeedback();

  const [round, setRound] = useState<RoundData>(() => generateRound(params.memoryLoad));
  const [phase, setPhase] = useState<Phase>('preview');
  const [selected, setSelected] = useState<number[]>([]);
  const [wrongCell, setWrongCell] = useState<number | null>(null);

  const r = useRef({
    elapsed: 0,
    phaseAt: 0,
    tally: new Tally(),
    done: false,
  });
  const [, force] = useState(0);

  const setNextPhase = (p: Phase) => {
    setPhase(p);
    r.current.phaseAt = r.current.elapsed;
  };

  const startNewRound = () => {
    setRound(generateRound(params.memoryLoad));
    setSelected([]);
    setWrongCell(null);
    setNextPhase('preview');
  };

  useTicker(paused, (dt) => {
    const st = r.current;
    if (st.done) return;
    st.elapsed += dt;
    const timeInPhase = st.elapsed - st.phaseAt;

    if (st.elapsed >= params.durationSec * 1000 && phase !== 'result') {
      st.done = true;
      onDone(st.tally.result(st.elapsed));
      return;
    }

    if (phase === 'preview' && timeInPhase >= showMs) {
      if (holdMs > 0) {
        setNextPhase('hold');
      } else {
        setNextPhase('recall');
      }
    } else if (phase === 'hold' && timeInPhase >= holdMs) {
      setNextPhase('recall');
    } else if (phase === 'result' && timeInPhase >= 1100) {
      if (st.elapsed >= params.durationSec * 1000) {
        st.done = true;
        onDone(st.tally.result(st.elapsed));
        return;
      }
      startNewRound();
    }

    force((x) => x + 1);
  });

  const tapCell = (index: number) => {
    const st = r.current;
    if (st.done || paused || phase !== 'recall' || selected.includes(index)) return;

    if (round.targets.includes(index)) {
      const nextSelected = [...selected, index];
      setSelected(nextSelected);
      st.tally.hit(st.elapsed - st.phaseAt);

      if (nextSelected.length === round.targets.length) {
        onCorrect();
        good('Pattern complete! 🌟');
        setNextPhase('result');
      }
    } else {
      setWrongCell(index);
      st.tally.falseTap();
      bad('Oops! Remember the tiles');
      setNextPhase('result');
    }
  };

  const remaining = round.targets.length - selected.length;

  return (
    <View style={styles.container}>
      <FeedbackPill fb={fb} top={8} />

      <View style={styles.header}>
        <Text style={styles.title}>Spatial Grid</Text>
        <Text style={styles.subtitle}>
          {phase === 'preview'
            ? 'Memorize the highlighted tiles…'
            : phase === 'hold'
              ? 'Hold it in mind…'
              : phase === 'recall'
                ? `Tap the ${remaining} target ${remaining === 1 ? 'tile' : 'tiles'}`
                : wrongCell !== null
                  ? 'Here was the pattern'
                  : 'Pattern clear!'}
        </Text>
      </View>

      <View style={styles.matrixArea}>
        <View
          style={[
            styles.grid,
            {
              width: round.gridSize === 4 ? 280 : 250,
              height: round.gridSize === 4 ? 280 : 250,
            },
          ]}
        >
          {Array.from({ length: round.totalCells }).map((_, i) => {
            const isTarget = round.targets.includes(i);
            const isFound = selected.includes(i);
            const isWrong = wrongCell === i;
            const isShowingTarget = (phase === 'preview' && isTarget) || (phase === 'result' && isTarget);

            let bg = '#E7E5DF';
            let border = '#DAD6CD';
            if (isShowingTarget) {
              bg = '#10B981'; // vibrant emerald
              border = '#059669';
            } else if (isFound) {
              bg = '#10B981';
              border = '#059669';
            } else if (isWrong) {
              bg = '#EF4444'; // red
              border = '#DC2626';
            }

            return (
              <Pressable
                key={i}
                onPress={() => tapCell(i)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    width: round.gridSize === 4 ? 60 : 72,
                    height: round.gridSize === 4 ? 60 : 72,
                    backgroundColor: bg,
                    borderColor: border,
                  },
                  pressed && phase === 'recall' && { opacity: 0.8 },
                ]}
                disabled={phase !== 'recall'}
                accessibilityLabel={`Cell ${i + 1}`}
              >
                {(isShowingTarget || isFound) && (
                  <View style={styles.innerGlow} />
                )}
                {isWrong && <Text style={{ fontSize: 22, color: colors.white }}>✕</Text>}
                {isFound && <Text style={{ fontSize: 22, color: colors.white }}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footerNote}>
        <Text style={styles.footerText}>
          {round.targets.length} tiles · {round.gridSize}×{round.gridSize} grid
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  header: { alignItems: 'center', marginVertical: 6 },
  title: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginBottom: 2 },
  subtitle: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  matrixArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F7F3',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E4DC',
    marginVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  innerGlow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  footerNote: { alignItems: 'center', marginBottom: 12 },
  footerText: { fontFamily: font.semibold, fontSize: 13, color: colors.inkMuted },
});
