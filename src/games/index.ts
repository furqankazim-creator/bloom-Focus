import type React from 'react';
import type { TaskId } from '../types';
import type { GameProps } from './common';
import ColorClash from './ColorClash';
import CountOrName from './CountOrName';
import DualTask from './DualTask';
import Feelings from './Feelings';
import FlankerTask from './FlankerTask';
import FollowPath from './FollowPath';
import GoNoGo from './GoNoGo';
import ListenFor from './ListenFor';
import MemoryEcho from './MemoryEcho';
import MemoryMatrix from './MemoryMatrix';
import PatternGarden from './PatternGarden';
import SpeedMatch from './SpeedMatch';
import StarWatch from './StarWatch';
import SwitchSort from './SwitchSort';

export const GAMES: Record<TaskId, React.ComponentType<GameProps>> = {
  starWatch: StarWatch,
  findTarget: PatternGarden,
  flankerTask: FlankerTask,
  listenFor: ListenFor,
  memoryEcho: MemoryEcho,
  memoryMatrix: MemoryMatrix,
  speedMatch: SpeedMatch,
  goNoGo: GoNoGo,
  colorClash: ColorClash,
  followSteps: FollowPath,
  switchSort: SwitchSort,
  countName: CountOrName,
  dualTask: DualTask,
  puzzleMatch: PatternGarden,
  blockBuilder: MemoryMatrix,
  mazePath: FollowPath,
  feelings: Feelings,
};
