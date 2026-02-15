// ==========================================
// Data Structures
// ==========================================

// NOTE: Using regular enum (not const enum) because SWC/Next.js
// doesn't properly inline const enum across module boundaries.
export enum Suit {
  HEARTS = 0,
  DIAMONDS = 1,
  CLUBS = 2,
  SPADES = 3,
}

export interface Card {
  readonly rank: number;   // 1(A) ~ 13(K)
  readonly suit: Suit;
  readonly faceUp: boolean;
  readonly _sv: number;    // cached suit value
  readonly _red: boolean;  // cached: hearts/diamonds
}

export function makeCard(rank: number, suit: Suit, faceUp: boolean = false): Card {
  return { rank, suit, faceUp, _sv: suit as number, _red: (suit as number) < 2 };
}

export function flipCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit, faceUp: true, _sv: c._sv, _red: c._red };
}

export enum ActionType {
  TABLEAU_TO_FOUNDATION = 1,
  TABLEAU_TO_TABLEAU = 2,
  WASTE_TO_FOUNDATION = 3,
  WASTE_TO_TABLEAU = 4,
  FOUNDATION_TO_TABLEAU = 5,
}

export interface Move {
  actionType: ActionType;
  srcIdx: number;
  destIdx: number;
  card: Card;
  numCards: number;
  stockTurns: number;
  priority: number;
}

export function makeMove(
  actionType: ActionType,
  srcIdx: number,
  destIdx: number,
  card: Card,
  numCards: number = 1,
  stockTurns: number = 0,
  priority: number = 6,
): Move {
  return { actionType, srcIdx, destIdx, card, numCards, stockTurns, priority };
}

export const WIN_VALUE = Infinity;
export const LOSS_VALUE = -Infinity;

export enum HeuristicType {
  H1 = 0,
  H2 = 1,
}
