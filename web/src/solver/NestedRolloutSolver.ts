import {
  ActionType, Move, HeuristicType,
  WIN_VALUE, LOSS_VALUE,
} from './types';
import { SolitaireState } from './SolitaireState';
import { evaluate } from './Evaluator';

type MoveSig = number; // packed signature

function moveSig(m: Move): MoveSig {
  // Pack into a single number for fast comparison
  // actionType(3 bits) | srcIdx+1(4 bits) | destIdx(4 bits) | rank(4 bits) | sv(2 bits) | numCards(4 bits)
  return ((m.actionType as number) << 18) |
         ((m.srcIdx + 1) << 14) |
         (m.destIdx << 10) |
         (m.card.rank << 6) |
         (m.card._sv << 4) |
         m.numCards;
}

function getReverseSig(move: Move, state: SolitaireState): MoveSig | null {
  const at = move.actionType;

  if (at === ActionType.TABLEAU_TO_TABLEAU) {
    const srcCol = state.tableau[move.srcIdx];
    const remaining = srcCol.length - move.numCards;
    if (remaining > 0 && !srcCol[remaining - 1].faceUp) return null;
    return ((ActionType.TABLEAU_TO_TABLEAU as number) << 18) |
           ((move.destIdx + 1) << 14) |
           (move.srcIdx << 10) |
           (move.card.rank << 6) |
           (move.card._sv << 4) |
           move.numCards;
  }

  if (at === ActionType.TABLEAU_TO_FOUNDATION) {
    const srcCol = state.tableau[move.srcIdx];
    if (srcCol.length > 1 && !srcCol[srcCol.length - 2].faceUp) return null;
    return ((ActionType.FOUNDATION_TO_TABLEAU as number) << 18) |
           ((move.destIdx + 1) << 14) |
           (move.srcIdx << 10) |
           (move.card.rank << 6) |
           (move.card._sv << 4) |
           1;
  }

  if (at === ActionType.FOUNDATION_TO_TABLEAU) {
    return ((ActionType.TABLEAU_TO_FOUNDATION as number) << 18) |
           ((move.destIdx + 1) << 14) |
           (move.srcIdx << 10) |
           (move.card.rank << 6) |
           (move.card._sv << 4) |
           1;
  }

  // Waste moves are not reversible
  return null;
}

export class NestedRolloutSolver {
  private root: SolitaireState;
  private maxTime: number;
  private nLevels: [number, number];
  private startTime: number = 0;
  private hTypes: [HeuristicType, HeuristicType] = [HeuristicType.H1, HeuristicType.H2];
  private caches: [Set<number>, Set<number>] = [new Set(), new Set()];
  private cacheLimit = 5000;
  finalState: SolitaireState | null = null;
  nodesSearched = 0;

  // Cancel flag - checked periodically in the search loop
  private cancelled = false;

  constructor(
    rootState: SolitaireState,
    maxTime: number = 60,
    n0: number = 1,
    n1: number = 1,
  ) {
    this.root = rootState;
    this.maxTime = maxTime;
    this.nLevels = [n0, n1];
  }

  cancel(): void {
    this.cancelled = true;
  }

  solve(): Move[] {
    this.startTime = performance.now() / 1000;
    this.caches = [new Set(), new Set()];
    this.nodesSearched = 0;
    this.cancelled = false;
    const state = this.root.clone();
    const [, moves] = this._search(
      state, 0, this.nLevels[0], new Set<number>(), true, null,
    );
    this.finalState = state;
    return moves;
  }

  private _isTimeout(): boolean {
    return this.cancelled || (performance.now() / 1000 - this.startTime > this.maxTime);
  }

  private _search(
    state: SolitaireState,
    hIdx: number,
    nOverride: number,
    path: Set<number>,
    topLevel: boolean,
    lastMoveReverse: MoveSig | null,
  ): [number, Move[]] {
    const hType = this.hTypes[hIdx];
    const n = nOverride;
    const z = 1 - hIdx; // remaining heuristic switches
    const solution: Move[] = [];
    this.nodesSearched++;

    // === Lines 1-3: One-time entry checks ===
    if (state.isWin()) return [WIN_VALUE, solution];

    const sh = state.stateHash();
    if (path.has(sh)) return [LOSS_VALUE, solution];

    if (this._isTimeout()) return [evaluate(state, hType), solution];

    let legal = state.getOrderedMoves();
    // Local loop prevention: filter reverse of last move
    if (lastMoveReverse !== null) {
      const filtered = legal.filter(m => moveSig(m) !== lastMoveReverse);
      if (filtered.length > 0) legal = filtered;
    }
    if (legal.length === 0) return [evaluate(state, hType), solution];

    if (n === -1) return [evaluate(state, hType), solution];

    // === Lines 4-6: Cache check (ONCE on entry) ===
    // Pack cache key: hIdx is 0 or 1, n is small, sh is 32-bit
    const cacheKey = sh * 32 + n;
    if (this.caches[hIdx].has(cacheKey)) {
      if (z === 0) {
        return [evaluate(state, hType), solution];
      } else {
        const [val, sub] = this._search(
          state, hIdx + 1, this.nLevels[hIdx + 1],
          path, topLevel, null,
        );
        for (let i = 0; i < sub.length; i++) solution.push(sub[i]);
        return [val, solution];
      }
    }

    // Cache this node (only n > 0)
    if (n > 0 && this.caches[hIdx].size < this.cacheLimit) {
      this.caches[hIdx].add(cacheKey);
    }

    // === Lines 7-14: Main while loop ===
    const currentPath = new Set(path);
    currentPath.add(sh);

    while (true) {
      const loopSh = state.stateHash();

      // Line 8-9: Evaluate children
      let bestVal = LOSS_VALUE;
      let bestMove: Move | null = null;
      let bestSub: Move[] = [];

      for (let ai = 0; ai < legal.length; ai++) {
        const a = legal[ai];
        if (this._isTimeout()) {
          if (bestMove === null) {
            bestMove = a;
            bestVal = evaluate(state, hType);
          }
          break;
        }

        const child = state.clone();
        const childReverse = getReverseSig(a, state);
        child.applyMove(a);
        const [val, sub] = this._search(
          child, hIdx, n - 1, currentPath, false, childReverse,
        );

        if (val > bestVal) {
          bestVal = val;
          bestMove = a;
          bestSub = sub;
        }

        // WIN shortcut
        if (val === WIN_VALUE) break;
      }

      // Line 10: WIN propagation - apply full sub-path at once
      if (bestVal === WIN_VALUE) {
        state.applyMove(bestMove!);
        solution.push(bestMove!);
        for (let i = 0; i < bestSub.length; i++) {
          state.applyMove(bestSub[i]);
          solution.push(bestSub[i]);
        }
        if (state.isWin()) return [WIN_VALUE, solution];
        // Sub-path didn't fully complete; continue searching
        const shNew = state.stateHash();
        currentPath.add(shNew);
        legal = state.getOrderedMoves();
        if (legal.length === 0) return [WIN_VALUE, solution];
        continue;
      }

      // Line 11-13: Local max / LOSS detection
      const currentVal = evaluate(state, hType);
      if (bestVal === LOSS_VALUE || (z > 0 && bestVal < currentVal)) {
        if (z === 0) {
          return [currentVal, solution];
        } else {
          // Switch to next heuristic; exclude current state from path
          const switchPath = new Set(currentPath);
          switchPath.delete(loopSh);
          const [val, sub] = this._search(
            state, hIdx + 1, this.nLevels[hIdx + 1],
            switchPath, topLevel, null,
          );
          for (let i = 0; i < sub.length; i++) solution.push(sub[i]);
          return [val, solution];
        }
      }

      // Line 14: Advance
      const reverseSig = getReverseSig(bestMove!, state);
      state.applyMove(bestMove!);
      solution.push(bestMove!);
      const shNew = state.stateHash();

      // Loop detection for new state
      if (currentPath.has(shNew)) {
        return [evaluate(state, hType), solution];
      }

      currentPath.add(shNew);
      this.nodesSearched++;

      // Check termination
      if (state.isWin()) return [WIN_VALUE, solution];
      if (this._isTimeout()) return [evaluate(state, hType), solution];

      legal = state.getOrderedMoves();
      // Local loop prevention for next iteration
      if (reverseSig !== null) {
        const filtered = legal.filter(m => moveSig(m) !== reverseSig);
        if (filtered.length > 0) legal = filtered;
      }
      if (legal.length === 0) return [evaluate(state, hType), solution];
    }
  }
}
