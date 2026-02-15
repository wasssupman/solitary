import type { Card, Move } from './types';

// Serialized versions use plain objects (safe for structured cloning)
export interface SerializedState {
  tableau: Card[][];
  foundation: Card[][];
  stock: Card[];
  waste: Card[];
}

export interface SerializedMove {
  actionType: number;
  srcIdx: number;
  destIdx: number;
  card: Card;
  numCards: number;
  stockTurns: number;
  priority: number;
}

export interface SolverStats {
  nodesSearched: number;
  elapsed: number;
  foundationCount: number;
}

export type WorkerRequest =
  | { type: 'solve'; state: SerializedState; n0: number; n1: number; maxTime: number }
  | { type: 'hint'; state: SerializedState; maxTime: number }
  | { type: 'cancel' };

export type WorkerResponse =
  | { type: 'solution'; moves: SerializedMove[]; win: boolean; nodesSearched: number }
  | { type: 'hint'; move: SerializedMove | null }
  | { type: 'progress'; move: SerializedMove; stats: SolverStats }
  | { type: 'error'; message: string };
