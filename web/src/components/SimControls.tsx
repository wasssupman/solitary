'use client';

import { useState, useCallback, useRef } from 'react';
import { useGameState } from '../hooks/useGameState';
import { getGameBridge } from '../game/bridge/GameBridge';
import type { SerializedState, SerializedMove } from '../solver/workerProtocol';

/**
 * Run solver for one best move (main thread, quick ~50ms).
 */
async function solveOneMove(state: SerializedState, maxTime: number): Promise<SerializedMove | null> {
  const { SolitaireState } = await import('../solver/SolitaireState');
  const { NestedRolloutSolver } = await import('../solver/NestedRolloutSolver');

  const gs = new SolitaireState();
  gs.tableau = state.tableau.map(col => col.slice());
  gs.foundation = state.foundation.map(pile => pile.slice());
  gs.stock = state.stock.slice();
  gs.waste = state.waste.slice();

  const solver = new NestedRolloutSolver(gs, maxTime, 1, 1);
  const moves = solver.solve();
  if (moves.length === 0) return null;

  const m = moves[0];
  return {
    actionType: m.actionType as number,
    srcIdx: m.srcIdx,
    destIdx: m.destIdx,
    card: m.card,
    numCards: m.numCards,
    stockTurns: m.stockTurns,
    priority: m.priority,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export default function SimControls({ bridgeId = 'simulate' }: { bridgeId?: string }) {
  const { moveCount, foundationCount, isWin, newGame } = useGameState(bridgeId);
  const [seed, setSeed] = useState('42');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<'win' | 'stuck' | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [speed, setSpeed] = useState(2000);
  const cancelRef = useRef(false);
  const playingRef = useRef(false);

  const runLoop = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    cancelRef.current = false;
    setPlaying(true);
    setResult(null);
    setStepCount(0);

    // Start new game via direct callback (bypasses stale event listeners)
    const s = parseInt(seed) || 0;
    const bridge = getGameBridge(bridgeId);
    const newGameFn = bridge.newGameCallback;
    if (newGameFn) {
      newGameFn(s);
    } else {
      newGame(s);
    }
    await delay(300); // wait for scene init

    let steps = 0;
    while (!cancelRef.current) {
      const state = bridge.solverState;
      if (!state) break;

      // Check win
      const totalFoundation = state.foundation.reduce((sum, p) => sum + p.length, 0);
      if (totalFoundation === 52) {
        setResult('win');
        break;
      }

      // Solve for one move
      const move = await solveOneMove(state as SerializedState, 2);
      if (!move || cancelRef.current) {
        if (!cancelRef.current) {
          setResult('stuck');
          bridge.emit('finalizeRecording', 'loss');
        }
        break;
      }

      // Apply the move via direct callback (bypasses stale event listeners)
      const applyFn = bridge.applySimMoveCallback;
      if (applyFn) {
        applyFn(move);
      } else {
        bridge.emit('simMove', move);
      }
      steps++;
      setStepCount(steps);

      // Wait
      await delay(speed);
    }

    playingRef.current = false;
    setPlaying(false);
  }, [seed, newGame, speed]);

  const stop = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return (
    <div className="h-auto min-h-12 flex flex-wrap items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 text-sm gap-2">
      <div className="flex items-center gap-3">
        <label className="text-zinc-400">Seed:</label>
        <input
          type="number"
          value={seed}
          onChange={e => setSeed(e.target.value)}
          className="w-20 px-2 py-1 rounded bg-zinc-700 text-white border border-zinc-600 text-center"
          disabled={playing}
        />
        <button
          onClick={playing ? stop : runLoop}
          className={`px-3 py-1 rounded transition-colors text-white ${
            playing
              ? 'bg-red-700 hover:bg-red-600'
              : 'bg-emerald-700 hover:bg-emerald-600'
          }`}
        >
          {playing ? 'Stop' : 'Play'}
        </button>
        <div className="flex items-center gap-1 text-zinc-400">
          <label>Speed:</label>
          <input
            type="range"
            min="100"
            max="3000"
            step="100"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="w-24"
          />
          <span className="w-14 text-right">{speed}ms</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-zinc-400">
        <span>Moves: {moveCount}</span>
        <span>Foundation: {foundationCount}/52</span>
        {result === 'win' && <span className="text-green-400 font-bold">WIN</span>}
        {result === 'stuck' && <span className="text-red-400 font-bold">STUCK</span>}
      </div>
    </div>
  );
}
