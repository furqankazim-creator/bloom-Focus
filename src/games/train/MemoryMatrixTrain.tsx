import React from 'react';
import MemoryMatrix from '../MemoryMatrix';
import type { TrainGameProps } from './shared';

export default function MemoryMatrixTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <MemoryMatrix
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
