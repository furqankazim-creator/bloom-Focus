import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { Tally, useTicker } from '../common';
import { TrainGameProps } from './shared';

const ROUTES = [
  ['right', 'right', 'right', 'right', 'down', 'down', 'down', 'down'],
  ['right', 'right', 'down', 'down', 'right', 'right', 'down', 'down'],
  ['right', 'down', 'right', 'right', 'down', 'right', 'down', 'down'],
] as const;
const SIZE = 5;
const PREVIEW_MS = [2200, 1700, 1200];
const WALLS: Record<number, Set<string>> = {
  1: new Set(['1,1', '2,1', '1,3', '2,3', '3,3']),
  2: new Set(['1,1', '3,1', '1,3', '3,3']),
  3: new Set(['2,0', '1,2', '3,0', '2,3']),
};

function routeFor(instructionSteps: number) {
  const level = Math.max(1, Math.min(3, instructionSteps));
  return { level, route: ROUTES[level - 1], walls: WALLS[level] };
}

export default function MazePathTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const { level, route, walls } = routeFor(params.instructionSteps);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [routeIndex, setRouteIndex] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const elapsed = useRef(0);
  const done = useRef(false);
  const tally = useRef(new Tally());
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const timer = setTimeout(() => setShowInstructions(false), PREVIEW_MS[level - 1]);
    return () => clearTimeout(timer);
  }, [level]);

  useTicker(paused, (dt) => {
    elapsed.current += dt;
    if (!done.current && elapsed.current >= durationSec * 1000) {
      done.current = true;
      onDone(tally.current.result(elapsed.current));
    }
  }, 100);

  const move = (direction: string) => {
    if (done.current || paused || showInstructions) return;
    const expected = route[routeIndex];
    const delta = direction === 'right'
      ? { x: 1, y: 0 }
      : direction === 'down'
        ? { x: 0, y: 1 }
        : direction === 'left'
          ? { x: -1, y: 0 }
          : { x: 0, y: -1 };
    const next = { x: cursor.x + delta.x, y: cursor.y + delta.y };
    const wallKey = `${next.x},${next.y}`;
    const inBounds = next.x >= 0 && next.y >= 0 && next.x < SIZE && next.y < SIZE;
    if (!inBounds || walls.has(wallKey) || direction !== expected) {
      tally.current.falseTap();
      return;
    }

    setCursor(next);
    setRouteIndex((index) => index + 1);
    tally.current.hit();
    onCorrect();
    if (routeIndex + 1 === route.length) {
      done.current = true;
      onDone(tally.current.result(Date.now() - startedAt.current));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Maze Path</Text>
      <Text style={styles.caption}>
        {showInstructions
          ? 'Remember the route, then trace it to the goal.'
          : `Follow the route. ${routeIndex} of ${route.length} moves.`}
      </Text>
      {showInstructions ? (
        <View style={styles.routePreview} accessibilityLabel={`Route: ${route.join(', ')}`}>
          {route.map((direction, index) => (
            <View key={`${direction}-${index}`} style={styles.routeStep}>
              <Text style={styles.routeNumber}>{index + 1}</Text>
              <Text style={styles.routeArrow}>{direction === 'right' ? '→' : '↓'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.board}>
          {Array.from({ length: SIZE }, (_, y) => (
            <View key={y} style={styles.row}>
              {Array.from({ length: SIZE }, (_, x) => {
                const isCursor = cursor.x === x && cursor.y === y;
                const isGoal = x === SIZE - 1 && y === SIZE - 1;
                const isWall = walls.has(`${x},${y}`);
                return (
                  <View key={`${x}-${y}`} style={[
                    styles.cell,
                    isWall && styles.wall,
                    isGoal && styles.goal,
                    isCursor && styles.cursor,
                  ]}>
                    {isCursor && <Text style={styles.marker}>●</Text>}
                    {isGoal && <Text style={styles.goalMarker}>★</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <View style={styles.controls}>
        <Pressable onPress={() => move('left')} disabled={paused || done.current || showInstructions} style={styles.button} accessibilityLabel="Move left"><Text style={styles.buttonText}>←</Text></Pressable>
        <Pressable onPress={() => move('right')} disabled={paused || done.current || showInstructions} style={styles.button} accessibilityLabel="Move right"><Text style={styles.buttonText}>→</Text></Pressable>
        <Pressable onPress={() => move('up')} disabled={paused || done.current || showInstructions} style={styles.button} accessibilityLabel="Move up"><Text style={styles.buttonText}>↑</Text></Pressable>
        <Pressable onPress={() => move('down')} disabled={paused || done.current || showInstructions} style={styles.button} accessibilityLabel="Move down"><Text style={styles.buttonText}>↓</Text></Pressable>
      </View>
      <Text style={styles.meta}>Route challenge {level} · {route.length} moves</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#FAF9F5', borderRadius: 24 },
  title: { fontFamily: font.heavy, fontSize: 24, color: colors.ink },
  caption: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, marginBottom: 14, textAlign: 'center' },
  board: { backgroundColor: colors.card, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row' },
  cell: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', margin: 2, borderRadius: 7, backgroundColor: '#E8ECE7' },
  wall: { backgroundColor: colors.ink },
  goal: { backgroundColor: colors.butter },
  cursor: { backgroundColor: colors.forest },
  marker: { color: colors.white, fontWeight: '700' },
  goalMarker: { color: colors.forestDeep, fontSize: 18 },
  routePreview: { minHeight: 105, maxWidth: 300, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 7 },
  routeStep: { width: 43, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint, borderRadius: 9 },
  routeNumber: { position: 'absolute', top: 2, right: 4, fontFamily: font.medium, fontSize: 9, color: colors.inkMuted },
  routeArrow: { fontSize: 25, color: colors.forest, lineHeight: 30 },
  controls: { flexDirection: 'row', marginTop: 14, gap: 7 },
  button: { width: 50, height: 48, borderRadius: 10, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 24, color: colors.ink, lineHeight: 30 },
  meta: { fontFamily: font.medium, fontSize: 12, color: colors.inkMuted, marginTop: 10 },
});
