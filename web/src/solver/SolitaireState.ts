import {
  Card, Suit, ActionType, Move,
  makeCard, flipCard, makeMove,
} from './types';
import { createDeck, seedShuffle } from './Deck';

export class SolitaireState {
  tableau: Card[][] = [[], [], [], [], [], [], []];
  foundation: Card[][] = [[], [], [], []];
  stock: Card[] = [];
  waste: Card[] = [];

  clone(): SolitaireState {
    const s = new SolitaireState();
    for (let i = 0; i < 7; i++) s.tableau[i] = this.tableau[i].slice();
    for (let i = 0; i < 4; i++) s.foundation[i] = this.foundation[i].slice();
    s.stock = this.stock.slice();
    s.waste = this.waste.slice();
    return s;
  }

  dealThoughtful(seed: number): void {
    const deck = seedShuffle(createDeck(), seed);
    let idx = deck.length - 1;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j <= i; j++) {
        const c = deck[idx--];
        this.tableau[i].push(
          j === i ? flipCard(c) : c
        );
      }
    }
    // Remaining cards go to stock (in order)
    this.stock = deck.slice(0, idx + 1);
    this.waste = [];
  }

  isWin(): boolean {
    return this.foundation[0].length +
           this.foundation[1].length +
           this.foundation[2].length +
           this.foundation[3].length === 52;
  }

  // FNV-1a hash on the same parts as Python
  stateHash(): number {
    let h = 0x811c9dc5;
    // Tableau
    for (let ci = 0; ci < 7; ci++) {
      const col = this.tableau[ci];
      for (let j = 0; j < col.length; j++) {
        const c = col[j];
        const v = c.rank * 8 + c._sv * 2 + (c.faceUp ? 1 : 0);
        h ^= v; h = Math.imul(h, 0x01000193);
      }
      h ^= 0xff; h = Math.imul(h, 0x01000193); // separator -1
    }
    // Foundation lengths
    for (let fi = 0; fi < 4; fi++) {
      h ^= this.foundation[fi].length;
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0xfe; h = Math.imul(h, 0x01000193); // separator -2
    // Stock
    for (let i = 0; i < this.stock.length; i++) {
      const c = this.stock[i];
      h ^= (c.rank * 4 + c._sv);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0xfd; h = Math.imul(h, 0x01000193); // separator -3
    // Waste
    for (let i = 0; i < this.waste.length; i++) {
      const c = this.waste[i];
      h ^= (c.rank * 4 + c._sv);
      h = Math.imul(h, 0x01000193);
    }
    return h | 0; // force 32-bit signed
  }

  getReachableTalonCards(): Set<number> {
    const reachable = new Set<number>(); // rank * 4 + sv
    const simStock = this.stock.slice();
    const simWaste = this.waste.slice();
    const seen = new Set<string>();

    for (let turn = 0; turn < 60; turn++) {
      if (simWaste.length > 0) {
        const c = simWaste[simWaste.length - 1];
        reachable.add(c.rank * 4 + c._sv);
      }
      // Build key from stock+waste identity
      let key = '';
      for (let i = 0; i < simStock.length; i++) {
        const c = simStock[i];
        key += String(c.rank * 10 + c._sv) + ',';
      }
      key += '|';
      for (let i = 0; i < simWaste.length; i++) {
        const c = simWaste[i];
        key += String(c.rank * 10 + c._sv) + ',';
      }
      if (seen.has(key)) break;
      seen.add(key);

      if (simStock.length === 0) {
        if (simWaste.length === 0) break;
        // Flip waste to stock
        for (let i = simWaste.length - 1; i >= 0; i--) {
          simStock.push(simWaste[i]);
        }
        simWaste.length = 0;
      }
      const draw = Math.min(3, simStock.length);
      for (let d = 0; d < draw; d++) {
        simWaste.push(simStock.pop()!);
      }
    }
    return reachable;
  }

  canFoundationReturn(cardRank: number): boolean {
    if (cardRank <= 2) return false;
    const target = cardRank - 2;
    for (let fi = 0; fi < 4; fi++) {
      if (this.foundation[fi].length < target) return true;
    }
    return false;
  }

  // ----------------------------------------------------------------
  // Move Generation (Paper Sec 4.4)
  // Priority: 1=T->F(reveal), 2=any->F, 3=T->T(reveal),
  //           4=Waste->T, 5=F->T, 6=T->T(no reveal)
  // ----------------------------------------------------------------
  getOrderedMoves(): Move[] {
    const allMoves: Move[] = [];
    let firstEmpty = this._firstEmptyCol();

    // --- Tableau moves ---
    for (let i = 0; i < 7; i++) {
      const col = this.tableau[i];
      if (col.length === 0) continue;
      const top = col[col.length - 1];

      // Tableau -> Foundation
      const fIdx = top._sv;
      const fPile = this.foundation[fIdx];
      const canF = (fPile.length === 0 && top.rank === 1) ||
                   (fPile.length > 0 && fPile[fPile.length - 1].rank === top.rank - 1);
      if (canF) {
        const reveals = col.length > 1 && !col[col.length - 2].faceUp;
        allMoves.push(makeMove(
          ActionType.TABLEAU_TO_FOUNDATION, i, fIdx, top, 1, 0,
          reveals ? 1 : 2,
        ));
      }

      // Tableau -> Tableau (partial and full stack moves)
      const colLen = col.length;
      for (let j = 0; j < colLen; j++) {
        if (!col[j].faceUp) continue;
        const moving = col[j];
        const mRank = moving.rank;
        const mRed = moving._red;
        const reveals = j > 0 && !col[j - 1].faceUp;
        const kingAtBottom = mRank === 13 && j === 0;
        const nCards = colLen - j;
        const pri = reveals ? 3 : 6;
        for (let ti = 0; ti < 7; ti++) {
          if (ti === i) continue;
          const targetCol = this.tableau[ti];
          if (targetCol.length === 0) {
            if (mRank === 13 && !kingAtBottom && ti === firstEmpty) {
              allMoves.push(makeMove(
                ActionType.TABLEAU_TO_TABLEAU, i, ti, moving, nCards, 0, pri,
              ));
            }
          } else {
            const tt = targetCol[targetCol.length - 1];
            if (tt.faceUp && mRank === tt.rank - 1 && mRed !== tt._red) {
              allMoves.push(makeMove(
                ActionType.TABLEAU_TO_TABLEAU, i, ti, moving, nCards, 0, pri,
              ));
            }
          }
        }
      }
    }

    // --- Foundation -> Tableau ---
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const fPile = this.foundation[fIdx];
      if (fPile.length === 0) continue;
      const top = fPile[fPile.length - 1];
      if (!this.canFoundationReturn(top.rank)) continue;
      const tRank = top.rank;
      const tRed = top._red;
      for (let ti = 0; ti < 7; ti++) {
        const col = this.tableau[ti];
        if (col.length === 0) {
          if (tRank === 13) {
            allMoves.push(makeMove(
              ActionType.FOUNDATION_TO_TABLEAU, fIdx, ti, top, 1, 0, 5,
            ));
            break; // Only first empty for King
          }
        } else {
          const tt = col[col.length - 1];
          if (tt.faceUp && tRank === tt.rank - 1 && tRed !== tt._red) {
            allMoves.push(makeMove(
              ActionType.FOUNDATION_TO_TABLEAU, fIdx, ti, top, 1, 0, 5,
            ));
          }
        }
      }
    }

    // --- K+ Waste/Stock moves ---
    const simStock = this.stock.slice();
    const simWaste = this.waste.slice();
    const seenStates = new Set<string>();
    const found = new Set<string>();
    firstEmpty = this._firstEmptyCol();

    for (let turns = 0; turns < 60; turns++) {
      if (simWaste.length > 0) {
        this._genWasteMoves(
          simWaste[simWaste.length - 1], turns, allMoves, found, firstEmpty,
        );
      }
      // Build key
      let key = '';
      for (let i = 0; i < simStock.length; i++) {
        const c = simStock[i];
        key += String(c.rank * 10 + c._sv) + ',';
      }
      key += '|';
      for (let i = 0; i < simWaste.length; i++) {
        const c = simWaste[i];
        key += String(c.rank * 10 + c._sv) + ',';
      }
      if (seenStates.has(key)) break;
      seenStates.add(key);

      if (simStock.length === 0) {
        if (simWaste.length === 0) break;
        for (let i = simWaste.length - 1; i >= 0; i--) {
          simStock.push(simWaste[i]);
        }
        simWaste.length = 0;
      }
      const draw = Math.min(3, simStock.length);
      for (let d = 0; d < draw; d++) {
        simWaste.push(simStock.pop()!);
      }
    }

    // Shuffle then stable sort by priority
    shuffleArray(allMoves);
    allMoves.sort((a, b) => a.priority - b.priority);
    return allMoves;
  }

  _firstEmptyCol(): number | null {
    for (let i = 0; i < 7; i++) {
      if (this.tableau[i].length === 0) return i;
    }
    return null;
  }

  _genWasteMoves(
    card: Card,
    turns: number,
    moves: Move[],
    found: Set<string>,
    firstEmpty: number | null,
  ): void {
    const cRank = card.rank;
    const cSv = card._sv;
    const fPile = this.foundation[cSv];
    const canF = (fPile.length === 0 && cRank === 1) ||
                 (fPile.length > 0 && fPile[fPile.length - 1].rank === cRank - 1);
    if (canF) {
      const aid = `WF,${cRank},${cSv}`;
      if (!found.has(aid)) {
        moves.push(makeMove(
          ActionType.WASTE_TO_FOUNDATION, -1, cSv, card, 1, turns, 2,
        ));
        found.add(aid);
      }
    }

    const cRed = card._red;
    for (let ti = 0; ti < 7; ti++) {
      const col = this.tableau[ti];
      if (col.length === 0) {
        if (cRank === 13 && ti === firstEmpty) {
          const aid = `WT,${cRank},${cSv},${ti}`;
          if (!found.has(aid)) {
            moves.push(makeMove(
              ActionType.WASTE_TO_TABLEAU, -1, ti, card, 1, turns, 4,
            ));
            found.add(aid);
          }
        }
      } else {
        const tt = col[col.length - 1];
        if (tt.faceUp && cRank === tt.rank - 1 && cRed !== tt._red) {
          const aid = `WT,${cRank},${cSv},${ti}`;
          if (!found.has(aid)) {
            moves.push(makeMove(
              ActionType.WASTE_TO_TABLEAU, -1, ti, card, 1, turns, 4,
            ));
            found.add(aid);
          }
        }
      }
    }
  }

  applyMove(move: Move): void {
    // K+ macro: cycle stock
    if (move.stockTurns > 0) {
      for (let t = 0; t < move.stockTurns; t++) {
        if (this.stock.length === 0) {
          for (let i = this.waste.length - 1; i >= 0; i--) {
            this.stock.push(this.waste[i]);
          }
          this.waste.length = 0;
        }
        const draw = Math.min(3, this.stock.length);
        for (let d = 0; d < draw; d++) {
          this.waste.push(this.stock.pop()!);
        }
      }
    }

    const at = move.actionType;
    if (at === ActionType.TABLEAU_TO_FOUNDATION) {
      const c = this.tableau[move.srcIdx].pop()!;
      this.foundation[move.destIdx].push(
        makeCard(c.rank, c.suit, true),
      );
      this._flipTop(move.srcIdx);
    } else if (at === ActionType.TABLEAU_TO_TABLEAU) {
      const src = this.tableau[move.srcIdx];
      const stack = src.splice(src.length - move.numCards, move.numCards);
      const dest = this.tableau[move.destIdx];
      for (let i = 0; i < stack.length; i++) dest.push(stack[i]);
      this._flipTop(move.srcIdx);
    } else if (at === ActionType.WASTE_TO_FOUNDATION) {
      const c = this.waste.pop()!;
      this.foundation[move.destIdx].push(
        makeCard(c.rank, c.suit, true),
      );
    } else if (at === ActionType.WASTE_TO_TABLEAU) {
      const c = this.waste.pop()!;
      this.tableau[move.destIdx].push(
        makeCard(c.rank, c.suit, true),
      );
    } else if (at === ActionType.FOUNDATION_TO_TABLEAU) {
      const c = this.foundation[move.srcIdx].pop()!;
      this.tableau[move.destIdx].push(
        makeCard(c.rank, c.suit, true),
      );
    }
  }

  _flipTop(colIdx: number): void {
    const col = this.tableau[colIdx];
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1] = flipCard(col[col.length - 1]);
    }
  }
}

// Fisher-Yates shuffle (uses Math.random - non-seeded, fine for move randomization)
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}
