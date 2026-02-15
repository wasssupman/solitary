'use client';

import { useCallback } from 'react';
import { useDefenseState } from '../hooks/useDefenseState';
import { useSolver } from '../hooks/useSolver';
import { getGameBridge } from '../game/bridge/GameBridge';
import { GamePhase } from '../game/defense/DefenseState';

export default function DefenseControls({ bridgeId = 'defense' }: { bridgeId?: string }) {
  const { state, newGame, endCardPhase, startBattle, setBattleSpeed, undo } = useDefenseState(bridgeId);
  const { requestHint, hinting } = useSolver(bridgeId);

  const triggerHint = useCallback(() => {
    if (hinting) return;
    if (state?.phase !== 'CARD') return;
    const solverState = getGameBridge(bridgeId).solverState;
    if (solverState) requestHint(solverState as Parameters<typeof requestHint>[0]);
  }, [hinting, state?.phase, requestHint, bridgeId]);

  if (!state) return null;

  const isCard = state.phase === GamePhase.CARD;
  const isDeploy = state.phase === GamePhase.DEPLOY;
  const isBattle = state.phase === GamePhase.BATTLE;
  const isGameOver = state.phase === GamePhase.GAME_OVER || state.phase === GamePhase.VICTORY;

  return (
    <div className="min-h-12 flex flex-wrap items-center justify-between px-2 sm:px-4 py-1 bg-zinc-800 border-b border-zinc-700 text-xs sm:text-sm">
      {/* Left: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => newGame()}
          className="px-2 sm:px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 transition-colors text-white"
          title="New Game (N)"
        >
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New Game</span>
        </button>

        {isCard && (
          <>
            <button
              onClick={undo}
              className="px-2 sm:px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 transition-colors text-white"
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              onClick={triggerHint}
              disabled={hinting}
              className="px-2 sm:px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 transition-colors text-white disabled:opacity-50"
              title="Hint (H)"
            >
              {hinting ? '...' : 'Hint'}
            </button>
            <button
              onClick={endCardPhase}
              className="px-2 sm:px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 transition-colors text-white"
              title="End Card Phase"
            >
              End Phase
            </button>
          </>
        )}

        {isDeploy && (
          <button
            onClick={startBattle}
            className="px-2 sm:px-3 py-1 rounded bg-red-700 hover:bg-red-600 transition-colors text-white"
            title="Start Battle"
          >
            Start Battle
          </button>
        )}

        {isBattle && (
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 mr-1">Speed:</span>
            {[1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setBattleSpeed(s)}
                className={`px-2 py-1 rounded transition-colors text-white ${
                  state.battleSpeed === s ? 'bg-blue-600' : 'bg-zinc-700 hover:bg-zinc-600'
                }`}
              >
                x{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-3 sm:gap-5 text-zinc-400">
        <span className={`font-bold ${isGameOver ? 'text-yellow-400' : 'text-white'}`}>
          Wave {state.wave}/10
        </span>

        {isCard && (
          <span className={
            state.turnsRemaining > state.turnLimit * 0.5 ? 'text-emerald-400' :
            state.turnsRemaining > state.turnLimit * 0.25 ? 'text-yellow-400' : 'text-red-400'
          }>
            Turns: {state.turnsRemaining}/{state.turnLimit}
          </span>
        )}

        {isBattle && (
          <span className="text-red-400">
            Enemies: {state.enemiesAlive}
          </span>
        )}

        <span>Units: {state.unitPoolCount}</span>
        <span>Found: {state.foundationCardsPlayed}/52</span>

        <span className={
          state.baseHp > state.baseMaxHp * 0.5 ? 'text-emerald-400' :
          state.baseHp > state.baseMaxHp * 0.25 ? 'text-yellow-400' : 'text-red-400'
        }>
          Base: {state.baseHp}/{state.baseMaxHp}
        </span>

        <span className="text-zinc-500">
          [{state.phase}]
        </span>

        {state.phase === GamePhase.VICTORY && (
          <span className="text-yellow-400 font-bold">VICTORY!</span>
        )}
        {state.phase === GamePhase.GAME_OVER && (
          <span className="text-red-400 font-bold">GAME OVER</span>
        )}

        {state.waveAffinity && state.waveAffinity.resistSuits.length > 0 && (
          <span className="text-orange-400 text-xs">
            Resist: {state.waveAffinity.resistSuits.map(s => ['H','D','C','S'][s]).join(',')}
          </span>
        )}
      </div>
    </div>
  );
}
