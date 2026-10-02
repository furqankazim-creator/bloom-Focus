import { Platform } from 'react-native';

const CHANNEL = 'practice';

/** Schedules one daily reminder at `hour`:00, replacing any earlier one. Returns false if permission was refused. */
export async function scheduleDailyReminder(hour: number, childName: string): Promise<boolean> {
  try {
    const Notifications = await import('expo-notifications');
    
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Practice reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for a little practice',
        body: `A short Bloom Focus session with ${childName}. Stop while it's still fun.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL },
    });
    return true;
  } catch (e) {
    console.warn('Notifications not available in this environment', e);
    return false;
  }
}

export async function cancelReminders() {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    // ignore
  }
}
