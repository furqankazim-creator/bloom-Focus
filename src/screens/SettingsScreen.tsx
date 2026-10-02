import React from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import type { RootProps } from '../navigation/types';
import { cancelReminders } from '../services/reminders';
import { useStore } from '../store/useStore';

export default function SettingsScreen({ navigation }: RootProps<'Settings'>) {
  const { role, userName, signOut, resetDemo, setReminder, reminder } = useStore();

  // Reminders belong to the parent on this device, so they stop when the role changes.
  const leave = () => {
    cancelReminders().catch(() => {});
    setReminder({ ...reminder, enabled: false });
    signOut();
  };

  const reset = () =>
    Alert.alert('Reset demo data?', 'All profiles, sessions and notes on this device go back to the sample data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { cancelReminders().catch(() => {}); resetDemo(); } },
    ]);

  return (
    <Screen>
      <TopBar title="Settings" onBack={() => navigation.goBack()} />
      <T.H1>{userName || 'You'}</T.H1>
      <T.Body style={{ marginTop: 4 }}>Signed in as {role === 'parent' ? 'a parent' : 'a therapist'} · demo mode</T.Body>

      <View style={{ gap: 10, marginTop: 24 }}>
        <Button label="Switch role" icon="repeat" variant="soft" onPress={leave} />
        <Button label="Reset demo data" icon="rotate-ccw" variant="light" onPress={reset} />
      </View>

      <Card style={{ marginTop: 28 }}>
        <T.H3>About Bloom Focus</T.H3>
        <T.Body style={{ marginTop: 6, fontSize: 14 }}>
          An adaptive digital practice platform for sustained attention, visual and auditory attention, working memory,
          impulse control, following instructions and cognitive flexibility. It is not a diagnostic tool or a medical device, and it does not claim to
          increase attention span.
        </T.Body>
        <T.Body style={{ marginTop: 10, fontSize: 14 }}>
          Everything is stored only on this device. No account, cloud sync or biometric sensor is connected in this version.
        </T.Body>
      </Card>
    </Screen>
  );
}
