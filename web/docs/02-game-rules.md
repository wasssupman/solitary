# Game Rules (Klondike Solitaire)

## Deal
- 52장 카드, seeded shuffle (Mulberry32 PRNG)
- Tableau 7열: 열 i에 i+1장 (i=0..6). 맨 위 1장만 face-up
- 나머지 24장 → Stock (face-down)
- Waste, Foundation: 비어있음

## Piles
| Pile | 수량 | 규칙 |
|------|------|------|
| Tableau | 7열 | 내림차순, 색상 교대 (Red↔Black). K만 빈 열에 놓음 |
| Foundation | 4개 (suit별) | 오름차순 A→K, 같은 suit |
| Stock | 1개 | 클릭 시 3장씩 Waste로 이동 (face-up) |
| Waste | 1개 | 맨 위 카드만 사용 가능 |

## Move Types (ActionType enum)
```typescript
enum ActionType {
  TABLEAU_TO_FOUNDATION = 1,  // 탭로 → 파운데이션
  TABLEAU_TO_TABLEAU = 2,     // 탭로 → 탭로 (부분 스택 이동 가능)
  WASTE_TO_FOUNDATION = 3,    // 웨이스트 → 파운데이션
  WASTE_TO_TABLEAU = 4,       // 웨이스트 → 탭로
  FOUNDATION_TO_TABLEAU = 5,  // 파운데이션 → 탭로
}
```

## Move Validation
| Move | 조건 |
|------|------|
| → Foundation | A(빈 pile) 또는 같은 suit의 rank+1 |
| → Tableau | rank-1이고 반대 색상. K는 빈 열 가능 |
| Foundation → Tableau | `canFoundationReturn()`: rank > 2이고 rank-2가 완성 안 됐을 때만 |
| Stock click | 3장 draw. stock 비면 waste를 뒤집어 stock으로 |

## Partial Stack Move
- Tableau→Tableau: face-up 카드 중 일부만 이동 가능
- 예: [K,Q,J,10] 스택에서 [J,10]만 떼어 다른 Q 위로 이동

## Win Condition
- Foundation 4개에 총 52장 = 승리

## Thoughtful Solitaire
- 모든 카드 위치가 공개된 상태에서 플레이 (Perfect Information)
- Solver는 이 정보를 활용하여 최적 수를 탐색
