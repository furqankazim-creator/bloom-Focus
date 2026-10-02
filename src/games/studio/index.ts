import type React from 'react';
import type { StudioTemplate } from '../../types';
import FindItGame from './FindItGame';
import ListenGame from './ListenGame';
import PuzzleGame from './PuzzleGame';
import SequenceGame from './SequenceGame';
import type { StudioGameProps } from './shared';
import WordSearchGame from './WordSearchGame';
import WorksheetGame from './WorksheetGame';

export const STUDIO_GAMES: Record<StudioTemplate, React.ComponentType<StudioGameProps<any>>> = {
  puzzle: PuzzleGame,
  wordsearch: WordSearchGame,
  worksheet: WorksheetGame,
  findit: FindItGame,
  sequence: SequenceGame,
  listen: ListenGame,
};
