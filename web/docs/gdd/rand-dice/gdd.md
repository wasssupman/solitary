# GDD: Rand Dice — Solitaire + Random Dice

## Overview
**Rand Dice** is a Klondike Solitaire variant where every move you make rolls a die. The die result triggers a random modifier that either helps or hinders your game. Strategy lies in timing moves to hit favorable rolls and managing the cascading chaos.

## Core Concept
Classic Klondike Solitaire is extended with a **Dice Layer**. After each legal solitaire move (card move, stock draw, foundation placement) a 6-sided die is rolled and its result applies a game modifier immediately.

## Dice Faces & Effects

| Roll | Name | Effect |
|------|------|--------|
| 1 | Stumble | Flip the top tableau card face-down (if any face-up non-foundation card exists). Undo cost +1 |
| 2 | Slow | Next move costs 2 dice rolls (skip one animation frame — visual only). No real penalty but reduces "free" feeling |
| 3 | Bonus Draw | Draw 1 extra card from stock to waste for free (no roll triggered) |
| 4 | Shield | Next bad roll (1 or 2) is ignored. Shown as a shield icon in HUD |
| 5 | Frenzy | Player gets 3 free moves (no dice rolls) — combo window |
| 6 | Jackpot | Score ×2 multiplier for the next foundation card placed |

## Scoring
- Foundation card placed: +100 pts
- Dice roll 6 active → next foundation card: +200 pts
- Winning the game: +5000 pts bonus
- Each remaining stock card at win: -10 pts
- HUD shows current score and active modifier

## Frenzy Mode
When a 5 is rolled, **Frenzy** is activated for 3 moves. During Frenzy:
- No dice rolls occur
- HUD pulses orange
- A countdown shows free moves remaining (3 → 2 → 1)
- After 3 moves, Frenzy expires and normal rolling resumes

## Shield Mode
When a 4 is rolled, a shield is displayed. The next bad roll (1 or 2) is blocked and consumed. The shield icon disappears after blocking one roll.

## Win/Lose Conditions
- **Win**: All 52 cards placed on foundations (standard Klondike win)
- **No lose condition**: The game is unlosable but score is tracked. Stumble (1) is the main irritant.

## Visual Design
- Dice panel in HUD (top bar) shows the last rolled value with animation
- Active modifier shown as icon + text (Shield, Frenzy, Jackpot ×2)
- Frenzy: orange pulsing border around game area
- Jackpot: golden glow on foundation piles
- Roll animation: die face spins through 1-6 briefly then lands

## Game Flow
1. Player starts a new game (standard Klondike deal)
2. Every move → roll die → apply modifier → continue
3. Frenzy windows create exciting combo sequences
4. Jackpot rolls reward aggressive foundation plays
5. Stumble adds just enough chaos to keep games interesting

## Differentiators vs Other Modes
- **vs Play**: Adds chaos/luck layer; same base game
- **vs Defense**: No enemy/tower system; purely dice-driven modifiers
- **vs Survivors**: No wave system; modifiers are immediate and simple

## Target Player
Casual players who want classic Solitaire with a fresh unpredictable twist. Dice rolls create "moment" opportunities that keep even easy games exciting.
