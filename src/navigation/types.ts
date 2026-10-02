import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrainTaskId } from '../engine/trainTasks';

export type TabParamList = {
  Today: undefined;
  Children: undefined;
  Plan: { childId?: string } | undefined;
  Insights: undefined;
  Home: undefined;
  Train: undefined;
  Progress: undefined;
  Profile: undefined;
  Notes: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ChildProfile: { childId: string };
  EditChild: { childId?: string };
  Tuning: { childId: string };
  Session: { childId: string; mode?: 'baseline' };
  Summary: { sessionId: string; fresh?: boolean };
  /** `customId` plays a therapist-built custom activity on top of `taskId`. */
  TrainGame: { childId: string; taskId: TrainTaskId; queue?: TrainTaskId[]; customId?: string };
  SessionDetail: { sessionId: string; childId?: string };
  SkillDetail: { childId: string; taskId: TrainTaskId };
  Settings: undefined;
  ActivityBuilder: { childId: string; activityId?: string };
  /** Game Studio editor; `activityId` edits an existing studio game. */
  GameStudio: { childId: string; activityId?: string };
  /** Plays a studio game. `preview` lets the therapist try it without recording a play. */
  StudioPlay: { childId: string; activityId: string; preview?: boolean };
};

export type RootProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
