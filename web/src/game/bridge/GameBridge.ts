type Listener = (...args: unknown[]) => void;

export interface GameDisplayState {
  tableau: { rank: number; suit: number; faceUp: boolean }[][];
  foundation: { rank: number; suit: number; faceUp: boolean }[][];
  stock: { rank: number; suit: number; faceUp: boolean }[];
  waste: { rank: number; suit: number; faceUp: boolean }[];
  moveCount: number;
  isWin: boolean;
}

/** Solver-compatible state snapshot (kept in sync by TableScene). */
export interface SolverSnapshot {
  tableau: { rank: number; suit: number; faceUp: boolean; _sv: number; _red: boolean }[][];
  foundation: { rank: number; suit: number; faceUp: boolean; _sv: number; _red: boolean }[][];
  stock: { rank: number; suit: number; faceUp: boolean; _sv: number; _red: boolean }[];
  waste: { rank: number; suit: number; faceUp: boolean; _sv: number; _red: boolean }[];
}

/**
 * Central event bus connecting React UI ↔ Phaser game scene.
 * Events:
 *  - 'stateChanged' (state: GameDisplayState)
 *  - 'newGame' (seed?: number)
 *  - 'undo'
 *  - 'hintResult' (move: { srcPile, srcIdx, destPile, destIdx } | null)
 *  - 'gameWon'
 *  - 'requestHint'
 */
export class GameBridge {
  private listeners = new Map<string, Set<Listener>>();

  /** Latest solver-compatible state snapshot, updated by the scene after every move. */
  solverState: SolverSnapshot | null = null;

  /** Direct callback to the active scene's showHint. Set by scene, cleared on destroy. */
  showHintCallback: ((move: unknown) => void) | null = null;

  /** Direct callback to apply a solver move (simulation). Set by scene, cleared on destroy. */
  applySimMoveCallback: ((move: unknown) => void) | null = null;

  /** Direct callback to start a new game. Set by scene, cleared on destroy. */
  newGameCallback: ((seed?: number) => void) | null = null;

  /** Direct callback to apply a theme change. Set by scene, cleared on destroy. */
  applyThemeCallback: ((themeId: string) => void) | null = null;

  // ── Replay Mode Callbacks ──

  /** Load a recording into ReplayScene. */
  loadRecordingCallback: ((recording: unknown) => void) | null = null;

  /** Step one action forward in replay. */
  replayStepCallback: (() => void) | null = null;

  /** Called by React cleanup before game.destroy() to finalize recordings etc. */
  sceneCleanupCallback: (() => void) | null = null;

  // ── Defense Mode Callbacks ──

  /** End card phase and transition to deploy. */
  endCardPhaseCallback: (() => void) | null = null;

  /** Start battle phase. */
  startBattleCallback: (() => void) | null = null;

  /** Set battle speed (1, 2, 4). */
  setBattleSpeedCallback: ((speed: number) => void) | null = null;

  /** Deploy a unit to a lane slot. */
  deployUnitCallback: ((unitId: string, slotIdx: number) => void) | null = null;

  on(event: string, fn: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: Listener): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, ...args: unknown[]): void {
    const fns = this.listeners.get(event);
    if (fns) for (const fn of fns) fn(...args);
  }

  /** Remove all Phaser-side listeners (called before game.destroy). */
  clearSceneListeners(): void {
    // Keep only React-side events, clear everything Phaser registers
    const sceneEvents = [
      'showHint', 'getState', 'simMove', 'newGame', 'undo', 'setTheme',
      'defenseStateChanged', 'endCardPhase', 'startBattle', 'setBattleSpeed', 'deployUnit',
      'replayLoaded', 'replayProgress', 'finalizeRecording',
      'survivorsStateChanged',
    ];
    for (const ev of sceneEvents) {
      this.listeners.delete(ev);
    }
  }
}

// Bridge registry (replaces singleton)
const bridges = new Map<string, GameBridge>();

export function getGameBridge(id = 'default'): GameBridge {
  if (!bridges.has(id)) bridges.set(id, new GameBridge());
  return bridges.get(id)!;
}

export function destroyGameBridge(id: string): void {
  bridges.delete(id);
}
