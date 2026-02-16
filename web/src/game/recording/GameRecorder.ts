import type { SolitaireCore } from '../core/SolitaireCore';
import type { MoveResult, StockDrawResult } from '../core/events';
import type { RecordedAction, GameRecording } from './types';
import type { SerializedMove } from '../../solver/workerProtocol';

export class GameRecorder {
  private actions: RecordedAction[] = [];
  private seed = 0;
  private sourceMode: 'play' | 'simulate';
  private finalized = false;

  private onMoveExecuted: (r: MoveResult) => void;
  private onStockDrawn: (r: StockDrawResult) => void;
  private onNewGame: (d: { seed: number }) => void;
  private onUndone: () => void;

  constructor(private core: SolitaireCore, mode: 'play' | 'simulate') {
    this.sourceMode = mode;

    this.onMoveExecuted = (result: MoveResult) => {
      const m = result.move;
      const sm: SerializedMove = {
        actionType: Number(m.actionType),
        srcIdx: m.srcIdx,
        destIdx: m.destIdx,
        card: m.card,
        numCards: m.numCards,
        stockTurns: m.stockTurns,
        priority: m.priority,
      };
      this.actions.push({ type: 'move', move: sm });
    };

    this.onStockDrawn = () => {
      this.actions.push({ type: 'stockDraw' });
    };

    this.onNewGame = (data: { seed: number }) => {
      this.actions = [];
      this.seed = data.seed;
      this.finalized = false;
    };

    this.onUndone = () => {
      this.actions.pop();
    };

    core.on('moveExecuted', this.onMoveExecuted);
    core.on('stockDrawn', this.onStockDrawn);
    core.on('newGame', this.onNewGame);
    core.on('undone', this.onUndone);
  }

  finalize(result: 'win' | 'loss' | 'abandoned'): GameRecording | null {
    if (this.finalized || this.actions.length === 0) return null;
    this.finalized = true;
    return {
      id: `${this.seed}-${Date.now()}`,
      seed: this.seed,
      sourceMode: this.sourceMode,
      result,
      actions: [...this.actions],
      recordedAt: Date.now(),
      totalMoves: this.actions.length,
    };
  }

  destroy(): void {
    this.core.off('moveExecuted', this.onMoveExecuted);
    this.core.off('stockDrawn', this.onStockDrawn);
    this.core.off('newGame', this.onNewGame);
    this.core.off('undone', this.onUndone);
  }
}
