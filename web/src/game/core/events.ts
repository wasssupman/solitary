import type { Move } from '../../solver/types';
import type { SolitaireState } from '../../solver/SolitaireState';

export interface MoveResult {
  move: Move;
  previousState: SolitaireState;
  revealedCard?: { col: number };
}

export interface StockDrawResult {
  previousState: SolitaireState;
  drawnCount: number;
  wasReset: boolean;
}

export interface CoreEvents {
  newGame: { seed: number };
  moveExecuted: MoveResult;
  stockDrawn: StockDrawResult;
  undone: { restoredState: SolitaireState };
  gameWon: Record<string, never>;
}
