import { SolitaireState } from '../../solver/SolitaireState';
import { makeCard, flipCard, makeMove, ActionType, type Card, type Move } from '../../solver/types';
import { createDeck, seedShuffle } from '../../solver/Deck';
import type { GameDisplayState, SolverSnapshot } from '../bridge/GameBridge';
import type { CoreEvents, MoveResult, StockDrawResult } from './events';

type Listener<T> = (data: T) => void;

export class SolitaireCore {
  private gameState!: SolitaireState;
  private undoStack: SolitaireState[] = [];
  private _moveCount = 0;
  private _currentSeed = 0;

  // Typed event emitter
  private listeners = new Map<string, Set<Listener<unknown>>>();

  get state(): SolitaireState { return this.gameState; }
  get moveCount(): number { return this._moveCount; }
  get currentSeed(): number { return this._currentSeed; }
  get isWin(): boolean { return this.gameState.isWin(); }

  // ── Event System ──

  on<K extends keyof CoreEvents>(event: K, cb: Listener<CoreEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as Listener<unknown>);
  }

  off<K extends keyof CoreEvents>(event: K, cb: Listener<CoreEvents[K]>): void {
    this.listeners.get(event)?.delete(cb as Listener<unknown>);
  }

  private emit<K extends keyof CoreEvents>(event: K, data: CoreEvents[K]): void {
    const fns = this.listeners.get(event);
    if (fns) for (const fn of fns) fn(data);
  }

  // ── Game Management ──

  newGame(seed?: number): void {
    this._currentSeed = seed ?? Math.floor(Math.random() * 1000000);
    this.gameState = new SolitaireState();
    this.gameState.dealThoughtful(this._currentSeed);
    this.undoStack = [];
    this._moveCount = 0;
    this.emit('newGame', { seed: this._currentSeed });
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const restoredState = this.undoStack.pop()!;
    this.gameState = restoredState;
    this._moveCount = Math.max(0, this._moveCount - 1);
    this.emit('undone', { restoredState });
    return true;
  }

  // ── Move Execution ──

  executeMove(move: Move): MoveResult {
    const previousState = this.gameState.clone();
    this.undoStack.push(previousState);

    // Detect revealed card before applying
    const at = Number(move.actionType);
    let revealedCard: { col: number } | undefined;

    if (at === ActionType.TABLEAU_TO_FOUNDATION || at === ActionType.TABLEAU_TO_TABLEAU) {
      const srcCol = this.gameState.tableau[move.srcIdx];
      const remaining = srcCol.length - move.numCards;
      if (remaining > 0 && !srcCol[remaining - 1].faceUp) {
        revealedCard = { col: move.srcIdx };
      }
    }

    // Strip stockTurns — callers handle stock cycling separately via applyStockTurns()
    // to allow sprite animation between stock turns and the actual move.
    if (move.stockTurns > 0) {
      const stripped = { ...move, stockTurns: 0 };
      this.gameState.applyMove(stripped);
    } else {
      this.gameState.applyMove(move);
    }
    this._moveCount++;

    const result: MoveResult = { move, previousState, revealedCard };
    this.emit('moveExecuted', result);

    if (this.gameState.isWin()) {
      this.emit('gameWon', {});
    }

    return result;
  }

  drawStock(): StockDrawResult | null {
    const previousState = this.gameState.clone();
    this.undoStack.push(previousState);

    if (this.gameState.stock.length === 0) {
      if (this.gameState.waste.length === 0) {
        this.undoStack.pop(); // no-op
        return null;
      }
      // Reset: waste -> stock
      for (let i = this.gameState.waste.length - 1; i >= 0; i--) {
        this.gameState.stock.push(this.gameState.waste[i]);
      }
      this.gameState.waste = [];
      this._moveCount++;

      const result: StockDrawResult = { previousState, drawnCount: 0, wasReset: true };
      this.emit('stockDrawn', result);
      return result;
    }

    // Draw up to 3
    const drawnCount = Math.min(3, this.gameState.stock.length);
    for (let d = 0; d < drawnCount; d++) {
      this.gameState.waste.push(flipCard(this.gameState.stock.pop()!));
    }
    this._moveCount++;

    const result: StockDrawResult = { previousState, drawnCount, wasReset: false };
    this.emit('stockDrawn', result);
    return result;
  }

  /** Apply stock turns (for solver moves that need stock cycling first). */
  applyStockTurns(turns: number): void {
    for (let t = 0; t < turns; t++) {
      if (this.gameState.stock.length === 0) {
        for (let i = this.gameState.waste.length - 1; i >= 0; i--) {
          this.gameState.stock.push(this.gameState.waste[i]);
        }
        this.gameState.waste = [];
      }
      const draw = Math.min(3, this.gameState.stock.length);
      for (let d = 0; d < draw; d++) {
        this.gameState.waste.push(flipCard(this.gameState.stock.pop()!));
      }
    }
  }

  // ── Validation ──

  canDropOnFoundation(rank: number, suit: number, fi: number): boolean {
    const fPile = this.gameState.foundation[fi];
    if (fPile.length === 0) return rank === 1 && suit === fi;
    const top = fPile[fPile.length - 1];
    return suit === top._sv && rank === top.rank + 1;
  }

  canDropOnTableau(rank: number, isRed: boolean, col: number): boolean {
    const colCards = this.gameState.tableau[col];
    if (colCards.length === 0) return rank === 13;
    const top = colCards[colCards.length - 1];
    return rank === top.rank - 1 && isRed !== top._red;
  }

  /** Check if top card of a pile can auto-move to its foundation. */
  canAutoMoveToFoundation(pile: 'tableau' | 'waste', pileIndex: number): number | null {
    let card: Card;
    if (pile === 'waste') {
      if (this.gameState.waste.length === 0) return null;
      card = this.gameState.waste[this.gameState.waste.length - 1];
    } else {
      const col = this.gameState.tableau[pileIndex];
      if (col.length === 0) return null;
      card = col[col.length - 1];
      if (!card.faceUp) return null;
    }

    const fi = card._sv;
    const fPile = this.gameState.foundation[fi];
    const canF = (fPile.length === 0 && card.rank === 1) ||
                 (fPile.length > 0 && fPile[fPile.length - 1].rank === card.rank - 1);
    return canF ? fi : null;
  }

  // ── Serialization ──

  getSerializableState(): SolverSnapshot {
    return {
      tableau: this.gameState.tableau.map(col =>
        col.map(c => ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red })),
      ),
      foundation: this.gameState.foundation.map(pile =>
        pile.map(c => ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red })),
      ),
      stock: this.gameState.stock.map(c =>
        ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red }),
      ),
      waste: this.gameState.waste.map(c =>
        ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red }),
      ),
    };
  }

  getDisplayState(): GameDisplayState {
    const toDisplay = (c: Card) => ({ rank: c.rank, suit: c._sv, faceUp: c.faceUp });
    return {
      tableau: this.gameState.tableau.map(col => col.map(toDisplay)),
      foundation: this.gameState.foundation.map(pile => pile.map(toDisplay)),
      stock: this.gameState.stock.map(toDisplay),
      waste: this.gameState.waste.map(toDisplay),
      moveCount: this._moveCount,
      isWin: this.gameState.isWin(),
    };
  }
}
