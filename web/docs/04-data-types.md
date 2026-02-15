# Data Types

## Card
```typescript
interface Card {
  rank: number;      // 1(A) ~ 13(K)
  suit: Suit;        // enum: HEARTS=0, DIAMONDS=1, CLUBS=2, SPADES=3
  faceUp: boolean;
  _sv: number;       // cached suit.value (성능 최적화)
  _red: boolean;     // cached suit < 2 (Hearts, Diamonds = red)
}

// 생성: makeCard(rank, suit, faceUp) → Object.create + frozen-like
// 뒤집기: flipCard(card) → 새 Card (faceUp 토글)
```

## Suit
```typescript
enum Suit { HEARTS = 0, DIAMONDS = 1, CLUBS = 2, SPADES = 3 }
// Red: HEARTS(0), DIAMONDS(1)
// Black: CLUBS(2), SPADES(3)
```

## ActionType
```typescript
enum ActionType {
  TABLEAU_TO_FOUNDATION = 1,
  TABLEAU_TO_TABLEAU = 2,
  WASTE_TO_FOUNDATION = 3,
  WASTE_TO_TABLEAU = 4,
  FOUNDATION_TO_TABLEAU = 5,
}
```

## Move
```typescript
interface Move {
  actionType: ActionType;
  srcIdx: number;        // source pile index (tableau col 0-6, foundation 0-3)
  destIdx: number;       // destination pile index
  card: Card;            // 이동하는 카드
  numCards: number;      // T→T: 이동할 카드 수 (partial stack)
  stockTurns: number;    // K+ macro: stock cycling 횟수 (0이면 cycling 없음)
  priority: number;      // 수 우선순위 (1=highest)
}

// 생성: makeMove(actionType, srcIdx, destIdx, card, numCards?, stockTurns?, priority?)
```

## SolitaireState
```typescript
class SolitaireState {
  tableau: Card[][] = [[], [], [], [], [], [], []];   // 7 columns
  foundation: Card[][] = [[], [], [], []];             // 4 piles (suit 순서)
  stock: Card[] = [];
  waste: Card[] = [];

  dealThoughtful(seed: number): void;
  clone(): SolitaireState;
  isWin(): boolean;                    // foundation 합 == 52
  stateHash(): number;                 // FNV-1a 32-bit
  getOrderedMoves(): Move[];           // K+ 포함 모든 legal moves
  applyMove(move: Move): void;         // in-place mutation
  getReachableTalonCards(): Set<number>;
  canFoundationReturn(cardRank: number): boolean;
}
```

## HeuristicType
```typescript
enum HeuristicType { H1 = 0, H2 = 1 }
```

## Serialized Types (Worker 통신용)
```typescript
interface SerializedState {
  tableau: Card[][];
  foundation: Card[][];
  stock: Card[];
  waste: Card[];
}

interface SerializedMove {
  actionType: number;
  srcIdx: number;
  destIdx: number;
  card: Card;
  numCards: number;
  stockTurns: number;
  priority: number;
}
```

## Bridge Types
```typescript
interface GameDisplayState {
  tableau: { rank: number; suit: number; faceUp: boolean }[][];
  foundation: { rank: number; suit: number; faceUp: boolean }[][];
  stock: { rank: number; suit: number; faceUp: boolean }[];
  waste: { rank: number; suit: number; faceUp: boolean }[];
  moveCount: number;
  isWin: boolean;
}

interface SolverSnapshot {
  // GameDisplayState와 동일 구조 + _sv, _red 포함
  tableau: { rank; suit; faceUp; _sv; _red }[][];
  foundation: { rank; suit; faceUp; _sv; _red }[][];
  stock: { rank; suit; faceUp; _sv; _red }[];
  waste: { rank; suit; faceUp; _sv; _red }[];
}
```
