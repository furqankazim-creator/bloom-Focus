import React from 'react';
import SwitchSort from '../SwitchSort';
import type { TrainGameProps } from './shared';

export default function SwitchSortTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <SwitchSort
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
