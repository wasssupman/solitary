# TRD: Rand Dice Mode

## Architecture Overview

Rand Dice follows the same architecture as existing modes (Defense, Survivors). It introduces a thin `RandDiceCore` layer on top of `SolitaireCore` that intercepts move events and applies dice modifiers.

## New Files

### `web/src/game/scenes/RandDiceScene.ts`
- Extends `Phaser.Scene`
- Scene key: `'RandDiceScene'`
- Accepts `bridgeId` in `init()` data config
- Uses `SolitaireCore` for card logic
- Uses `SpriteManager`, `CardRenderer`, `LayoutManager`, `InteractionController`, `CardMovementRunner` (same as PlayScene)
- Adds `DiceHUD` drawn directly via Phaser graphics/text (no separate class needed)
- Intercepts `moveExecuted` and `stockDrawn` events from `SolitaireCore` to trigger dice rolls
- Maintains local state: `score`, `shieldActive`, `frenzyMovesLeft`, `jackpotActive`, `lastRoll`

### `web/src/app/rand-dice/page.tsx`
- Next.js client page
- Dynamic import of `PhaserGame` (ssr: false)
- Uses `RandDiceControls` and `HomeButton`
- Mode: `'rand-dice'`, bridgeId: `'rand-dice'`
- Keyboard: N for new game

### `web/src/components/RandDiceControls.tsx`
- React client component
- Shows: New Game button, Score, Last Roll, Active Modifier, Foundation count
- Reads state via `getGameBridge('rand-dice')` events (`randDiceStateChanged`)
- No solver/hint integration

## Modified Files

### `web/src/game/config.ts`
```ts
import { RandDiceScene } from './scenes/RandDiceScene';
export { PlayScene, SimulateScene, DefenseScene, ReplayScene, SurvivorsScene, RandDiceScene };
```

### `web/src/components/PhaserGameInner.tsx`
- Add `'rand-dice'` to `mode` union type
- Add ternary for `SceneClass` and `sceneKey`

### `web/src/app/page.tsx`
- Add Link card: amber color, href `/rand-dice`, label "Rand Dice", subtitle "Solitaire with lucky dice rolls"

### `web/src/game/bridge/GameBridge.ts`
- Add `randDiceNewGameCallback` to the class (optional — can use `newGameCallback`)
- Add `'randDiceStateChanged'` to `clearSceneListeners` list

## Dice State Machine

```
State = { score, shieldActive, frenzyMovesLeft, jackpotActive, lastRoll }

onMove():
  if frenzyMovesLeft > 0:
    frenzyMovesLeft--
    emit state
    return
  roll = random(1..6)
  lastRoll = roll
  applyModifier(roll)
  emit state

applyModifier(roll):
  1 (Stumble):  if shieldActive: shieldActive=false; else: flipRandomCard()
  2 (Slow):     if shieldActive: shieldActive=false; else: (visual only)
  3 (Bonus):    drawExtraFromStock()  [no roll triggered]
  4 (Shield):   shieldActive = true
  5 (Frenzy):   frenzyMovesLeft = 3
  6 (Jackpot):  jackpotActive = true

onFoundationPlaced():
  pts = jackpotActive ? 200 : 100
  jackpotActive = false
  score += pts
```

## Bridge Events
- Scene → React: `bridge.emit('randDiceStateChanged', { score, lastRoll, shieldActive, frenzyMovesLeft, jackpotActive, foundationCount, isWin })`
- React → Scene: `bridge.newGameCallback()` (reuse existing callback)

## Stumble Implementation
- On roll 1 (not shielded), collect all tableau piles that have ≥1 face-up card.
- Pick one pile at random.
- Find the top-most face-up card and set `faceUp = false` on `SolitaireCore.state`.
- Call `SpriteManager.rebuild()` to reflect the flip.

## Bonus Draw Implementation
- Check if stock is non-empty.
- Call `SolitaireCore.drawFromStock()` directly (or emit the same event the stock click triggers).
- This does NOT trigger another dice roll.

## HUD Layout (in-canvas)
- Top-left: `Score: XXXX`
- Top-center: Dice face `[ 4 ]` (large text, updates after each roll)
- Top-right: Active modifier label (`SHIELD`, `FRENZY x3`, `JACKPOT x2`, or blank)
- Colors: Frenzy = orange, Jackpot = gold, Shield = blue, Stumble = red flash

## TypeScript Constraints
- No new enum files — dice rolls are plain `number` (1–6)
- `RandDiceScene` does not extend any other scene class; all card logic via `SolitaireCore` composition
- All bridge callbacks typed as `(...) => void` consistent with `GameBridge`
