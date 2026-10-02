import React from 'react';
import SpeedMatch from '../SpeedMatch';
import type { TrainGameProps } from './shared';

export default function SpeedMatchTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <SpeedMatch
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
