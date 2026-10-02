import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Divider, Screen, T, TaskIcon, TopBar } from '../components/ui';
import { STEP_DOWN_ACCURACY, STEP_UP_ACCURACY, STEP_UP_STREAK, pct, taskLevel } from '../engine/adaptive';
import { DIM_STEPS, TASKS, TASK_ORDER, dimLabel, formatDim } from '../engine/tasks';
import type { RootProps } from '../navigation/types';
import { useChild, useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { Dim } from '../types';

export default function TuningScreen({ route, navigation }: RootProps<'Tuning'>) {
  const child = useChild(route.params.childId);
  const setTaskParam = useStore((s) => s.setTaskParam);
  const toggleLock = useStore((s) => s.toggleLock);
  if (!child) return null;

  const tasks = TASK_ORDER.filter((id) => TASKS[id].scored && child.tasks[id]?.enabled);

  const step = (id: (typeof tasks)[number], dim: Dim | 'reinforceEvery', delta: number) => {
    const steps = DIM_STEPS[dim];
    const i = steps.indexOf(child.tasks[id].params[dim]);
    const next = steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? 0 : i) + delta))];
    setTaskParam(child.id, id, dim, next);
  };

  return (
    <Screen>
      <TopBar title="Adaptive settings" onBack={() => navigation.goBack()} />
      <T.H1>{child.name.split(' ')[0]}’s engine</T.H1>
      <T.Body style={{ marginTop: 8 }}>
        After every activity the engine moves one setting at a time. Set a starting point with − / +, or lock a setting to keep
        the engine from changing it.
      </T.Body>

      <Card style={{ marginTop: 18, backgroundColor: colors.sage, borderColor: colors.sage, gap: 8 }}>
        <Rule icon="arrow-up-circle" text={`${STEP_UP_STREAK} blocks in a row at ${pct(STEP_UP_ACCURACY)}+ → the least-advanced setting steps up and rewards thin out.`} />
        <Rule icon="minus-circle" text={`${pct(STEP_DOWN_ACCURACY)}–${pct(STEP_UP_ACCURACY)} → growth zone, nothing changes.`} />
        <Rule icon="arrow-down-circle" text={`Below ${pct(STEP_DOWN_ACCURACY)} → the engine eases the one setting that explains it: tiring late → shorter; quick early taps → slower; missed targets → fewer distractions; otherwise less to remember.`} />
      </Card>

      {tasks.length === 0 && <T.Body style={{ marginTop: 20 }}>No scored activities are switched on in this child’s plan.</T.Body>}

      {tasks.map((id) => {
        const t = TASKS[id];
        const state = child.tasks[id];
        return (
          <Card key={id} style={{ marginTop: 16 }}>
            <View style={[styles.row, { gap: 12 }]}>
              <TaskIcon icon={t.icon} tint={t.tint} size={46} />
              <View style={{ flex: 1 }}>
                <T.H3>{t.name}</T.H3>
                <T.Small>
                  Level {taskLevel(t, state.params)} · streak {state.streak}/{STEP_UP_STREAK}
                </T.Small>
              </View>
            </View>
            <Divider style={{ marginVertical: 12 }} />
            {[...t.dims, 'reinforceEvery' as const].map((dim) => {
              const locked = dim !== 'reinforceEvery' && state.locked.includes(dim);
              return (
                <View key={dim} style={[styles.row, { paddingVertical: 8, gap: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dim}>{dimLabel(t, dim)}</Text>
                    <Text style={styles.value}>{formatDim(dim, state.params[dim])}</Text>
                  </View>
                  <Stepper icon="minus" onPress={() => step(id, dim, -1)} label={`Lower ${dimLabel(t, dim)}`} />
                  <Stepper icon="plus" onPress={() => step(id, dim, +1)} label={`Raise ${dimLabel(t, dim)}`} />
                  {dim !== 'reinforceEvery' ? (
                    <Pressable
                      onPress={() => toggleLock(child.id, id, dim)}
                      style={[styles.lock, locked && { backgroundColor: colors.forest }]}
                      accessibilityLabel={`${locked ? 'Unlock' : 'Lock'} ${dimLabel(t, dim)}`}
                    >
                      <Feather name={locked ? 'lock' : 'unlock'} size={16} color={locked ? colors.white : colors.inkSoft} />
                    </Pressable>
                  ) : (
                    <View style={{ width: 40 }} />
                  )}
                </View>
              );
            })}
          </Card>
        );
      })}
    </Screen>
  );
}

function Rule({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={[styles.row, { gap: 10, alignItems: 'flex-start' }]}>
      <Feather name={icon} size={16} color={colors.forest} style={{ marginTop: 2 }} />
      <Text style={styles.rule}>{text}</Text>
    </View>
  );
}

function Stepper({ icon, onPress, label }: { icon: 'plus' | 'minus'; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [styles.stepper, pressed && { opacity: 0.6 }]}>
      <Feather name={icon} size={18} color={colors.forest} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1, fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, color: colors.forest },
  dim: { fontFamily: font.medium, fontSize: 14, color: colors.inkSoft },
  value: { fontFamily: font.semibold, fontSize: 16, color: colors.ink, marginTop: 2 },
  stepper: { width: 44, height: 40, borderRadius: 14, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
  lock: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
