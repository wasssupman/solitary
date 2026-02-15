'use client';

import { useEffect, useCallback } from 'react';
import { useGameState } from '../hooks/useGameState';
import { useSolver } from '../hooks/useSolver';
import { useTheme } from '../hooks/useTheme';
import { getGameBridge } from '../game/bridge/GameBridge';

export default function PlayControls({ bridgeId = 'play' }: { bridgeId?: string }) {
  const { moveCount, foundationCount, elapsed, isWin, newGame, undo } = useGameState(bridgeId);
  const { requestHint, hinting } = useSolver(bridgeId);
  const { themeId, setTheme, themes } = useTheme(bridgeId);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const triggerHint = useCallback(() => {
    if (hinting || isWin) return;
    const state = getGameBridge(bridgeId).solverState;
    if (state) requestHint(state as Parameters<typeof requestHint>[0]);
  }, [hinting, isWin, requestHint]);

  // Listen for keyboard hint request
  useEffect(() => {
    const bridge = getGameBridge(bridgeId);
    bridge.on('requestHintFromUI', triggerHint);
    return () => bridge.off('requestHintFromUI', triggerHint);
  }, [triggerHint]);

  return (
    <div className="min-h-12 flex flex-wrap items-center justify-between px-2 sm:px-4 py-1 bg-zinc-800 border-b border-zinc-700 text-xs sm:text-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => newGame()}
          className="px-2 sm:px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 transition-colors text-white"
          title="New Game (N)"
        >
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New Game</span>
        </button>
        <button
          onClick={undo}
          className="px-2 sm:px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 transition-colors text-white"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={triggerHint}
          disabled={hinting || isWin}
          className="px-2 sm:px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 transition-colors text-white disabled:opacity-50"
          title="Hint (H)"
        >
          {hinting ? 'Thinking...' : 'Hint'}
        </button>
      </div>
      <div className="flex items-center gap-3 sm:gap-6 text-zinc-400">
        <span>{moveCount}</span>
        <span>{foundationCount}/52</span>
        <span>{formatTime(elapsed)}</span>
        {isWin && <span className="text-yellow-400 font-bold">WIN!</span>}
        <select
          value={themeId}
          onChange={e => setTheme(e.target.value)}
          className="bg-zinc-700 text-white rounded px-2 py-1 text-xs sm:text-sm"
        >
          {themes.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
