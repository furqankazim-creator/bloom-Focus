import React from 'react';
import FollowPath from '../FollowPath';
import type { TrainGameProps } from './shared';

export default function FollowPathTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <FollowPath
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
