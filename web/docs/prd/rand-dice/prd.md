# PRD: Rand Dice Mode

## Summary
Add a new game mode "Rand Dice" to the Solitaire web app. This mode plays classic Klondike Solitaire with a dice roll after every move, triggering modifiers (Stumble, Slow, Bonus Draw, Shield, Frenzy, Jackpot).

## User Stories

### Core Gameplay
- As a player, I want to play standard Klondike Solitaire so the core game feels familiar.
- As a player, I want a die to roll after every move so each action has an element of surprise.
- As a player, I want to see the dice result clearly so I know what modifier was applied.
- As a player, I want active modifiers (Shield, Frenzy, Jackpot) displayed in the HUD so I can plan around them.

### Dice Modifiers
- Roll 1 (Stumble): The top face-up card on a random non-empty tableau pile flips face-down.
- Roll 2 (Slow): Visual-only delay effect; no game state change beyond cosmetic.
- Roll 3 (Bonus Draw): One extra card drawn from stock to waste, no roll triggered.
- Roll 4 (Shield): Next bad roll (1 or 2) is negated and removed.
- Roll 5 (Frenzy): Player gets 3 free moves (no dice rolls during frenzy).
- Roll 6 (Jackpot): Next foundation card placed scores double (×2).

### Scoring
- Foundation placement: +100 pts (or +200 during Jackpot).
- Win bonus: +5000 pts.
- Score displayed in HUD, updated after every modifier/placement.

### New Game & Navigation
- As a player, I want a "New Game" button to restart with a fresh deal.
- As a player, I want a Home link to return to the mode selector.
- As a player, I want the N key to start a new game (keyboard shortcut parity with Play mode).

## Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | Dice rolls after every solitaire move (card move, stock draw, foundation placement) |
| 2 | Each of the 6 die faces triggers the correct modifier |
| 3 | Shield absorbs exactly one bad roll then disappears |
| 4 | Frenzy gives exactly 3 free moves (no rolls) |
| 5 | Jackpot doubles exactly the next foundation placement score |
| 6 | Stumble flips exactly one face-up tableau card face-down |
| 7 | Score is displayed and updated correctly in HUD |
| 8 | Active modifiers (Shield / Frenzy / Jackpot) are visible in HUD |
| 9 | Dice value is visible in HUD after each roll |
| 10 | New Game resets dice state, score, and modifiers |
| 11 | Game is winnable and win condition is detected |
| 12 | npm run build passes with no TypeScript errors |

## Out of Scope
- Undo functionality (not implemented in this mode to preserve dice randomness)
- AI hints (solver not integrated)
- Saving scores between sessions
- Leaderboard
