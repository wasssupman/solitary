import type { SerializedMove } from '../../solver/workerProtocol';

export type RecordedAction =
  | { type: 'move'; move: SerializedMove }
  | { type: 'stockDraw' };

export interface GameRecording {
  id: string;
  seed: number;
  sourceMode: 'play' | 'simulate';
  result: 'win' | 'loss' | 'abandoned';
  actions: RecordedAction[];
  recordedAt: number;
  totalMoves: number;
}
