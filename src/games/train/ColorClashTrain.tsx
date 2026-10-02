import React from 'react';
import ColorClash from '../ColorClash';
import type { TrainGameProps } from './shared';

export default function ColorClashTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <ColorClash
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
