import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import ChildProfileScreen from '../screens/ChildProfileScreen';
import EditChildScreen from '../screens/EditChildScreen';
import ParentHomeScreen from '../screens/parent/ParentHomeScreen';
import ParentNotesScreen from '../screens/parent/ParentNotesScreen';
import ParentProgressScreen from '../screens/parent/ParentProgressScreen';
import ParentTrainScreen from '../screens/parent/ParentTrainScreen';
import ParentProfileScreen from '../screens/parent/ParentProfileScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen';
import SessionScreen from '../screens/SessionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { ensureRealtime } from '../services/api';
import ActivityBuilderScreen from '../screens/therapist/ActivityBuilderScreen';
import GameStudioScreen from '../screens/therapist/GameStudioScreen';
import StudioPlayScreen from '../screens/StudioPlayScreen';
import SkillDetailScreen from '../screens/SkillDetailScreen';
import SummaryScreen from '../screens/SummaryScreen';
import ChildrenScreen from '../screens/therapist/ChildrenScreen';
import InsightsScreen from '../screens/therapist/InsightsScreen';
import PlanScreen from '../screens/therapist/PlanScreen';
import TherapistMessagesScreen from '../screens/therapist/MessagesScreen';
import TodayScreen from '../screens/therapist/TodayScreen';
import TrainGameScreen from '../screens/TrainGameScreen';
import TuningScreen from '../screens/TuningScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { useStore } from '../store/useStore';
import { colors, font } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type Icon = React.ComponentProps<typeof Feather>['name'];

const tabOptions = (icon: Icon, title: string) => ({
  title,
  tabBarIcon: ({ color }: { color: string }) => <Feather name={icon} size={24} color={color} />,
});

function Tabs() {
  const role = useStore((s) => s.role);
  // Unread messages from the other side, shown as a badge on the Messages tab.
  const unread = useStore((s) =>
    s.notes.filter((n) => n.from !== role && !n.readAt && (role !== 'parent' || n.childId === (s.parentChildId ?? s.children[0]?.id))).length,
  );
  const messagesOptions = {
    ...tabOptions('message-circle', 'Messages'),
    tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
    tabBarBadgeStyle: { backgroundColor: colors.danger, fontFamily: font.semibold, fontSize: 11 },
  };

  // Signed-in accounts keep a live connection so the server can mark messages delivered right away.
  useEffect(() => {
    void ensureRealtime().catch(() => {});
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 72, paddingTop: 8 },
      }}
    >
      {role === 'parent' ? (
        <>
          <Tab.Screen name="Home" component={ParentHomeScreen} options={tabOptions('home', 'Home')} />
          <Tab.Screen name="Train" component={ParentTrainScreen} options={tabOptions('crosshair', 'Train')} />
          <Tab.Screen name="Progress" component={ParentProgressScreen} options={tabOptions('bar-chart-2', 'Progress')} />
          <Tab.Screen name="Notes" component={ParentNotesScreen} options={messagesOptions} />
          <Tab.Screen name="Profile" component={ParentProfileScreen} options={tabOptions('user', 'Profile')} />
        </>
      ) : (
        <>
          <Tab.Screen name="Today" component={TodayScreen} options={tabOptions('sun', 'Today')} />
          <Tab.Screen name="Children" component={ChildrenScreen} options={tabOptions('users', 'Children')} />
          <Tab.Screen name="Notes" component={TherapistMessagesScreen} options={messagesOptions} />
          <Tab.Screen name="Plan" component={PlanScreen} options={tabOptions('layers', 'Activity plan')} />
          <Tab.Screen name="Insights" component={InsightsScreen} options={tabOptions('bar-chart-2', 'Insights')} />
        </>
      )}
    </Tab.Navigator>
  );
}

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg } };

export default function RootNavigator() {
  const role = useStore((s) => s.role);
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {role === null ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="ChildProfile" component={ChildProfileScreen} />
            <Stack.Screen name="EditChild" component={EditChildScreen} />
            <Stack.Screen name="Tuning" component={TuningScreen} />
            <Stack.Screen name="Session" component={SessionScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="Summary" component={SummaryScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
            <Stack.Screen name="SkillDetail" component={SkillDetailScreen} />
            <Stack.Screen name="TrainGame" component={TrainGameScreen} options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ActivityBuilder" component={ActivityBuilderScreen} />
            <Stack.Screen name="GameStudio" component={GameStudioScreen} />
            <Stack.Screen name="StudioPlay" component={StudioPlayScreen} options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
