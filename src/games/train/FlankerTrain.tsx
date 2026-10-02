import React from 'react';
import FlankerTask from '../FlankerTask';
import type { TrainGameProps } from './shared';

export default function FlankerTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <FlankerTask
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
