export type PileType = 'tableau' | 'waste' | 'foundation' | 'stock';

export interface CardData {
  rank: number;
  suit: number;
  faceUp: boolean;
}

export interface CardMovementData {
  from: PileType;
  to: PileType;
  fromIndex: number;
  toIndex: number;
  cards: CardData[];
  startPositions: { x: number; y: number }[];
  endPositions: { x: number; y: number }[];
}
