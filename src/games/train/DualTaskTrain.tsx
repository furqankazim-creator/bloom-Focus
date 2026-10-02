import React from 'react';
import DualTask from '../DualTask';
import type { TrainGameProps } from './shared';

export default function DualTaskTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <DualTask
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
