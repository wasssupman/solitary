'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGameBridge } from '../game/bridge/GameBridge';

interface DiceState {
  score: number;
  lastRoll: number | null;
  shieldActive: boolean;
  frenzyMovesLeft: number;
  jackpotActive: boolean;
  foundationCount: number;
  isWin: boolean;
}

const ROLL_LABELS: Record<number, string> = {
  1: 'Stumble',
  2: 'Slow',
  3: 'Bonus Draw',
  4: 'Shield',
  5: 'Frenzy',
  6: 'Jackpot',
};

const ROLL_COLORS: Record<number, string> = {
  1: 'text-red-400',
  2: 'text-zinc-400',
  3: 'text-green-400',
  4: 'text-blue-400',
  5: 'text-orange-400',
  6: 'text-yellow-400',
};

export default function RandDiceControls({ bridgeId = 'rand-dice' }: { bridgeId?: string }) {
  const [diceState, setDiceState] = useState<DiceState>({
    score: 0,
    lastRoll: null,
    shieldActive: false,
    frenzyMovesLeft: 0,
    jackpotActive: false,
    foundationCount: 0,
    isWin: false,
  });

  useEffect(() => {
    const bridge = getGameBridge(bridgeId);
    const handler = (state: unknown) => {
      setDiceState(state as DiceState);
    };
    bridge.on('randDiceStateChanged', handler);
    return () => bridge.off('randDiceStateChanged', handler);
  }, [bridgeId]);

  const handleNewGame = useCallback(() => {
    const bridge = getGameBridge(bridgeId);
    if (bridge.newGameCallback) bridge.newGameCallback();
  }, [bridgeId]);

  const rollLabel = diceState.lastRoll !== null ? ROLL_LABELS[diceState.lastRoll] : '—';
  const rollColor = diceState.lastRoll !== null ? ROLL_COLORS[diceState.lastRoll] : 'text-zinc-500';

  return (
    <div className="min-h-12 flex flex-wrap items-center justify-between px-2 sm:px-4 py-1 bg-zinc-800 border-b border-zinc-700 text-xs sm:text-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={handleNewGame}
          className="px-2 sm:px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 transition-colors text-white"
          title="New Game (N)"
        >
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New Game</span>
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-5 text-zinc-300">
        {/* Last roll */}
        <span className="flex items-center gap-1">
          <span className="text-zinc-500 hidden sm:inline">Roll:</span>
          <span className={`font-bold ${rollColor}`}>
            {diceState.lastRoll !== null ? `[${diceState.lastRoll}]` : '[ — ]'}
          </span>
          <span className={`hidden sm:inline ${rollColor}`}>{rollLabel}</span>
        </span>

        {/* Active modifier */}
        <span className="hidden sm:flex items-center gap-1 min-w-[90px]">
          {diceState.frenzyMovesLeft > 0 && (
            <span className="font-bold text-orange-400">FRENZY x{diceState.frenzyMovesLeft}</span>
          )}
          {diceState.shieldActive && !diceState.frenzyMovesLeft && (
            <span className="font-bold text-blue-400">SHIELD</span>
          )}
          {diceState.jackpotActive && !diceState.frenzyMovesLeft && !diceState.shieldActive && (
            <span className="font-bold text-yellow-400">JACKPOT x2</span>
          )}
        </span>

        {/* Foundation count */}
        <span className="text-zinc-400">{diceState.foundationCount}/52</span>

        {/* Score */}
        <span className="font-mono text-emerald-400">{diceState.score} pts</span>

        {diceState.isWin && (
          <span className="text-yellow-400 font-bold">WIN!</span>
        )}
      </div>
    </div>
  );
}
