# Solitary - Klondike Solitaire with AI Solver

## Overview
Thoughtful Klondike Solitaire web game with a Nested Rollout Policy Adaptation solver.
Based on paper: "Searching Solitaire in Real Time" (Bjarnason, Tadepalli, Fern).

## Tech Stack
- **Framework**: Next.js 16 + React 19 + TypeScript
- **Game Engine**: Phaser 3 (WebGL canvas rendering)
- **Styling**: Tailwind CSS 4
- **Solver**: Nested Rollout (main thread + Web Worker)
- **Deploy**: Vercel (`solitaire-hunter.vercel.app`, public — no auth)

## Project Structure
```
web/
  src/
    app/                  # Next.js routes (/, /play, /simulate)
    components/           # React UI (PlayControls, SimControls, PhaserGame)
    hooks/                # useGameState, useSolver
    game/
      bridge/             # GameBridge - React <-> Phaser event bus (singleton)
      scenes/             # TableScene - main Phaser scene
      objects/            # CardSprite, PileZone
      rendering/          # CardRenderer, LayoutManager, AnimationManager
      config.ts           # Phaser game config
    solver/
      types.ts            # Card, Move, ActionType, Suit enums
      Deck.ts             # Seeded shuffle (Mulberry32)
      SolitaireState.ts   # Game state + K+ move generation
      Evaluator.ts        # 6-feature dual heuristic (H1/H2)
      NestedRolloutSolver.ts  # Core search algorithm
      solverWorker.ts     # Web Worker wrapper
      workerProtocol.ts   # Worker message types
  docs/                   # Spec documents
```

## Key Architecture Patterns

### React <-> Phaser Bridge
- `GameBridge` singleton connects React UI and Phaser scene
- **Direct callbacks** (`showHintCallback`, `applySimMoveCallback`, `newGameCallback`) bypass stale event listeners from React strict mode double-mount
- All callbacks cleared in `PhaserGameInner` cleanup before `game.destroy()`

### Solver Integration
- **Hint**: Main thread, `solveOneMove()` ~50ms, returns first move
- **Full solve**: Web Worker preferred, main thread fallback
- **Simulation loop**: `solveOneMove -> applyMove -> delay -> repeat`

### State Flow
```
User action / Solver move
  -> gameState.applyMove(move)
  -> refreshSpritesFromState()
  -> emitState()  (updates bridge.solverState + emits 'stateChanged')
  -> React hooks re-render
```

## Commands
All commands run from `web/` directory:
```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm test             # Solver unit tests (npx tsx test-solver.ts)
```

### Deploy
**Must run from `web/`** (`.vercel/project.json` lives there):
```bash
cd web
vercel --prod --public && vercel alias set solitaire-hunter.vercel.app  # Deploy (public, no auth)
```

## Critical Implementation Notes

1. **Partial stack moves**: T->T allows moving sub-sections of face-up cards (not just full stacks). Boosts win rate 44% -> 52%.

2. **Sub-path WIN propagation**: When nested search finds WIN, apply entire sub-path directly instead of re-searching. Massive speedup for winning games (54% -> 74%).

3. **Cached suit values**: `Card._sv` and `Card._red` avoid slow Enum `.value` access. ~2x speedup.

4. **K+ macro-actions**: `Move.stockTurns` encodes stock cycling count. `getOrderedMoves()` simulates up to 60 stock turns to find reachable waste cards.

5. **Domain pruning is UNSOUND** for Klondike (T->T reveals rely on delete effects). Do not re-enable.

6. **Phaser scene guards**: Always check `this.scene?.isActive()` + try-catch in bridge callbacks. `this.sys` check alone is insufficient (partially destroyed scenes).

## Benchmarks
- Paper target: n0=1, n1=1 -> 74.94% (50,000 games, C++, 60s)
- Our best: n0=1, n1=1 -> 74% (50 games, TS, 2s timeout)
