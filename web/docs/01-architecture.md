# Architecture

## Stack
| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Game Engine | Phaser 3.90 (WebGL, RESIZE scale mode) |
| Solver | TypeScript, Web Worker |
| Deploy | Vercel |

## Directory Layout
```
src/
  app/
    page.tsx              # Landing - mode selection
    layout.tsx            # Root layout (dark bg, full viewport)
    play/page.tsx         # Play mode: PlayControls + PhaserGame
    simulate/page.tsx     # Sim mode: SimControls + PhaserGame
  components/
    PhaserGame.tsx        # dynamic(() => import('./PhaserGameInner'), {ssr:false})
    PhaserGameInner.tsx   # Mounts Phaser.Game, cleanup on unmount
    PlayControls.tsx      # New Game / Undo / Hint + stats bar
    SimControls.tsx       # Seed / Play-Stop / Speed slider + stats
    StatsOverlay.tsx      # Floating stats (unused in current pages)
  hooks/
    useGameState.ts       # Subscribe to bridge 'stateChanged', track win/timer
    useSolver.ts          # requestHint(), solve() via Worker or main thread
    useAnimationQueue.ts  # (legacy, unused)
  game/
    config.ts             # Phaser.AUTO, bg=#35654d, RESIZE mode
    bridge/
      GameBridge.ts       # Singleton event bus + direct callbacks
    scenes/
      TableScene.ts       # Main scene: deal, render, drag-drop, hint, sim
    objects/
      CardSprite.ts       # Container: front/back images, flip animation
      PileZone.ts         # Rounded rect pile outline
    rendering/
      CardRenderer.ts     # Runtime texture generation (no image assets)
      LayoutManager.ts    # Responsive positions (7-col grid, overlap)
      AnimationManager.ts # Sequential tween queue
  solver/
    types.ts              # Card, Move, Suit, ActionType, HeuristicType
    Deck.ts               # createDeck(), seedShuffle() (Mulberry32)
    SolitaireState.ts     # State + K+ move generation + applyMove
    Evaluator.ts          # 6-feature dual heuristic
    NestedRolloutSolver.ts # Core search
    solverWorker.ts       # Web Worker entry
    workerProtocol.ts     # SerializedState, SerializedMove types
```

## Data Flow
```
┌─────────────┐     bridge events      ┌──────────────┐
│  React UI   │ ◄──────────────────────► │ Phaser Scene │
│ (hooks,     │   stateChanged, gameWon │ (TableScene)  │
│  controls)  │   newGame, undo         │               │
└──────┬──────┘                         └───────┬───────┘
       │ requestHint / solveOneMove             │
       ▼                                        │
┌──────────────┐   applySimMoveCallback         │
│   Solver     │ ──────────────────────────────►│
│ (Worker or   │   showHintCallback             │
│  main thread)│ ──────────────────────────────►│
└──────────────┘
```

## Bridge Pattern (핵심)
`GameBridge` singleton이 React와 Phaser를 연결.

**Direct callbacks** (stale listener 방지):
```typescript
bridge.showHintCallback    // scene.showHint()
bridge.applySimMoveCallback // scene.applySolverMove()
bridge.newGameCallback      // scene.newGame()
bridge.solverState          // 최신 solver-compatible state snapshot
```

**왜 direct callback?**
React strict mode에서 mount → unmount → remount 발생.
기존 event listener는 destroy된 scene 참조 → `displayList null` crash.
Direct callback은 scene이 `create()`에서 설정, unmount시 null로 초기화.

## Page Layout
```
┌─────────── Controls (top, fixed height) ──────────┐
│ [buttons] [stats]                                  │
├────────────────────────────────────────────────────┤
│                                                    │
│             Phaser Canvas (flex-1)                 │
│                                                    │
└────────────────────────────────────────────────────┘
```
