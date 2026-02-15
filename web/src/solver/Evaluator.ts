import { HeuristicType, WIN_VALUE } from './types';
import type { SolitaireState } from './SolitaireState';

export function evaluate(state: SolitaireState, hType: HeuristicType): number {
  if (state.isWin()) return WIN_VALUE;

  let score = 0;
  const isH1 = hType === HeuristicType.H1;

  // Feature 1: x is in a Foundation stack
  // H1: 5 - rank_value (sliding scale, A=5, K=-7)
  // H2: 5 (flat)
  for (let fi = 0; fi < 4; fi++) {
    const fPile = state.foundation[fi];
    for (let ci = 0; ci < fPile.length; ci++) {
      const rv = fPile[ci].rank - 1;
      score += isH1 ? (5 - rv) : 5;
    }
  }

  // Feature 2: x is face down in a Tableau stack
  // Both: rank_value - 13 (A: -13, K: -1)
  for (let ci = 0; ci < 7; ci++) {
    const col = state.tableau[ci];
    for (let j = 0; j < col.length; j++) {
      if (!col[j].faceUp) {
        score += (col[j].rank - 1) - 13;
      }
    }
  }

  // Feature 3: x is available from K+ Talon
  // H1: 0, H2: 1
  if (!isH1) {
    const reachable = state.getReachableTalonCards();
    score += reachable.size;
  }

  // Collect face-down info for Features 4, 5, 6
  const faceDownSet = new Set<number>(); // rank * 4 + sv
  for (let ci = 0; ci < 7; ci++) {
    const col = state.tableau[ci];
    for (let j = 0; j < col.length; j++) {
      if (!col[j].faceUp) {
        faceDownSet.add(col[j].rank * 4 + col[j]._sv);
      }
    }
  }

  // Feature 4: Same rank & color pair both face-down in Tableau
  // H1: -5, H2: -1
  const w4 = isH1 ? -5 : -1;
  for (let rank = 1; rank <= 13; rank++) {
    // Red pair: Hearts(0) + Diamonds(1)
    if (faceDownSet.has(rank * 4 + 0) && faceDownSet.has(rank * 4 + 1)) {
      score += w4;
    }
    // Black pair: Clubs(2) + Spades(3)
    if (faceDownSet.has(rank * 4 + 2) && faceDownSet.has(rank * 4 + 3)) {
      score += w4;
    }
  }

  // Features 5 & 6: Blocking relationships within each column
  const w5 = isH1 ? -5 : -1;
  const w6 = isH1 ? -10 : -5;
  for (let ci = 0; ci < 7; ci++) {
    const col = state.tableau[ci];
    const n = col.length;
    for (let j = 0; j < n; j++) {
      const x = col[j];
      // Blocking condition: x is NOT resting on a face-up card
      if (j > 0 && col[j - 1].faceUp) continue;
      for (let i = 0; i < j; i++) {
        const y = col[i];
        // Feature 5: x blocks suited card of lesser rank
        if (x._sv === y._sv && x.rank > y.rank) {
          score += w5;
        }
        // Feature 6: x blocks one of its own tableau build cards
        if (x.rank < 13 && y.rank === x.rank + 1 && y._red !== x._red) {
          score += w6;
        }
      }
    }
  }

  return score;
}
