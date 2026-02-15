# Interaction (Play Mode)

## Drag & Drop

### 드래그 가능 카드
`updateCardInteractivity()`에서 설정:
- **Waste**: 맨 위 카드 1장
- **Tableau**: 각 열의 face-up 카드들 (맨 아래 face-up부터)
- **Foundation**: 각 pile의 맨 위 카드 1장 (→ Tableau로 복귀 가능)

### Drag Flow
```
dragstart
  → clearHint()
  → 카드 수집 (tableau: cardIndex부터 끝까지, 나머지: 1장)
  → depth 상승 (1000+)
  → dragData에 저장 { cards, originX, originY, sourcePile, sourceIndex }

drag
  → 모든 수집된 카드의 x,y를 delta만큼 이동

dragend
  → findDropTarget(x, y, card) 호출
  → target 있으면 executePlayerMove()
  → target 없으면 원위치 snap back
```

### Drop Target 판정 (`findDropTarget`)
1. Foundation 4개 검사 (distance < cardWidth * 0.6)
   → `canDropOnFoundation(card, fi)` 검증
2. Tableau 7열 검사 (x distance + y distance)
   → `canDropOnTableau(card, col)` 검증

### Move 실행 (`executePlayerMove`)
1. 현재 state를 undoStack에 push (clone)
2. Move 객체 생성 (source pile 종류에 따라 ActionType 결정)
3. `gameState.applyMove(move)`
4. `refreshSpritesFromState()` + `emitState()`
5. Win check → `bridge.emit('gameWon')`

## Stock Click
- Stock zone 클릭 → `onStockClick()`
- Stock 비었으면: waste 전체를 뒤집어 stock으로
- Stock 있으면: 최대 3장을 waste로 이동 (flipCard)

## Double Click (Auto-move)
- Tableau/Waste 카드 더블클릭 → `autoMoveToFoundation()`
- Foundation에 놓을 수 있으면 자동 이동

## Keyboard Shortcuts (play/page.tsx)
| Key | Action |
|-----|--------|
| `H` | Hint 요청 |
| `N` | New Game |
| `Ctrl+Z` / `Cmd+Z` | Undo |

## Hint System
```
H key → bridge.emit('requestHintFromUI')
  → PlayControls.triggerHint()
  → bridge.solverState 읽기
  → useSolver.requestHint(state)
  → NestedRolloutSolver (2s, n0=1, n1=1)
  → 첫 번째 move 반환
  → bridge.showHintCallback(move)
  → TableScene.showHint(move)
  → 초록색 highlight overlay 2초간 표시
```

## Undo
- `Ctrl+Z` → `bridge.emit('undo')`
- `undoStack.pop()` → state 복원
- `refreshSpritesFromState()` + `emitState()`

## Simulation Mode
```
[Play] 클릭 → runLoop()
  → newGameCallback(seed)
  → delay(300ms)
  → while(!cancel):
      state = bridge.solverState
      move = solveOneMove(state, 2s)  // main thread ~50ms
      applySimMoveCallback(move)
      delay(speed)  // 100~3000ms, default 1000ms
  → WIN / STUCK / Stop
```
