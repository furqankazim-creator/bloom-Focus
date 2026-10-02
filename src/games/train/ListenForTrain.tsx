import React from 'react';
import ListenFor from '../ListenFor';
import type { TrainGameProps } from './shared';

export default function ListenForTrain({ params, durationSec, paused, onCorrect, onDone }: TrainGameProps) {
  const mergedParams = { ...params, durationSec };
  return (
    <ListenFor
      params={mergedParams}
      paused={paused}
      onCorrect={onCorrect}
      onDone={onDone}
    />
  );
}
