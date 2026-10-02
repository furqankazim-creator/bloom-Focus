import type React from 'react';
import { TRAIN_INFO, TrainInfo, TrainTaskId } from '../../engine/trainTasks';
import BlockBuilderTrain from './BlockBuilderTrain';
import ColorClashTrain from './ColorClashTrain';
import DualTaskTrain from './DualTaskTrain';
import FindTarget from './FindTarget';
import FlankerTrain from './FlankerTrain';
import FollowPathTrain from './FollowPathTrain';
import GoNoGoTrain from './GoNoGoTrain';
import ListenForTrain from './ListenForTrain';
import MazePathTrain from './MazePathTrain';
import MemoryMatrixTrain from './MemoryMatrixTrain';
import MemorySequence from './MemorySequence';
import PuzzleMatchTrain from './PuzzleMatchTrain';
import type { TrainGameProps } from './shared';
import SpeedMatchTrain from './SpeedMatchTrain';
import SwitchSortTrain from './SwitchSortTrain';
import TapStars from './TapStars';

export * from '../../engine/trainTasks';

export type TrainGameMeta = TrainInfo & { Game: React.ComponentType<TrainGameProps> };

const COMPONENTS: Record<TrainTaskId, React.ComponentType<TrainGameProps>> = {
  starWatch: TapStars,
  speedMatch: SpeedMatchTrain,
  findTarget: FindTarget,
  flankerTask: FlankerTrain,
  memoryEcho: MemorySequence,
  memoryMatrix: MemoryMatrixTrain,
  goNoGo: GoNoGoTrain,
  colorClash: ColorClashTrain,
  switchSort: SwitchSortTrain,
  listenFor: ListenForTrain,
  followSteps: FollowPathTrain,
  dualTask: DualTaskTrain,
  puzzleMatch: PuzzleMatchTrain,
  blockBuilder: BlockBuilderTrain,
  mazePath: MazePathTrain,
};

export const TRAIN_GAMES: TrainGameMeta[] = TRAIN_INFO.map((g) => ({ ...g, Game: COMPONENTS[g.id] }));

export const TRAIN_GAME = Object.fromEntries(TRAIN_GAMES.map((g) => [g.id, g])) as Record<TrainTaskId, TrainGameMeta>;
