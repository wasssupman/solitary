'use client';

import { useState, useCallback, useRef } from 'react';
import { getGameBridge } from '../game/bridge/GameBridge';
import type { SerializedState, SerializedMove } from '../solver/workerProtocol';

/**
 * Run the solver directly in the main thread for a quick hint.
 * Uses dynamic import to avoid SSR issues with solver modules.
 * Wrapped in setTimeout(0) so React can flush "Thinking..." first.
 */
function runHintDirect(state: SerializedState, maxTime: number): Promise<SerializedMove | null> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const { SolitaireState } = await import('../solver/SolitaireState');
        const { NestedRolloutSolver } = await import('../solver/NestedRolloutSolver');

        const gs = new SolitaireState();
        gs.tableau = state.tableau.map(col => col.slice());
        gs.foundation = state.foundation.map(pile => pile.slice());
        gs.stock = state.stock.slice();
        gs.waste = state.waste.slice();

        const solver = new NestedRolloutSolver(gs, maxTime, 1, 1);
        const moves = solver.solve();
        if (moves.length > 0) {
          const m = moves[0];
          resolve({
            actionType: m.actionType as number,
            srcIdx: m.srcIdx,
            destIdx: m.destIdx,
            card: m.card,
            numCards: m.numCards,
            stockTurns: m.stockTurns,
            priority: m.priority,
          });
        } else {
          resolve(null);
        }
      } catch (err) {
        console.error('Hint solver error:', err);
        resolve(null);
      }
    }, 0);
  });
}

/**
 * Try Worker-based solve; falls back to main thread if Worker fails.
 */
function createWorker(): Worker | null {
  try {
    const worker = new Worker(
      new URL('../solver/solverWorker.ts', import.meta.url),
      { type: 'module' },
    );
    return worker;
  } catch (err) {
    console.warn('Web Worker creation failed, using main thread fallback:', err);
    return null;
  }
}

export function useSolver() {
  const [hinting, setHinting] = useState(false);
  const [solving, setSolving] = useState(false);
  const hintingRef = useRef(false);
  const solvingRef = useRef(false);

  const requestHint = useCallback(async (state: SerializedState) => {
    if (hintingRef.current || solvingRef.current) return;
    hintingRef.current = true;
    setHinting(true);
    try {
      const move = await runHintDirect(state, 2);
      if (move) {
        const cb = getGameBridge().showHintCallback;
        if (cb) cb(move);
      }
    } catch (err) {
      console.error('Hint error:', err);
    } finally {
      hintingRef.current = false;
      setHinting(false);
    }
  }, []);

  const solve = useCallback(async (
    state: SerializedState,
    n0 = 1,
    n1 = 1,
    maxTime = 60,
  ): Promise<{ moves: SerializedMove[]; win: boolean; nodesSearched: number } | null> => {
    if (solvingRef.current) return null;
    solvingRef.current = true;
    setSolving(true);
    try {
      // Try Worker first
      const worker = createWorker();
      if (worker) {
        return await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error('Worker timeout'));
          }, (maxTime + 5) * 1000);

          worker.onerror = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error(`Worker error: ${e.message}`));
          };

          worker.onmessage = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            const msg = e.data;
            if (msg.type === 'solution') {
              resolve({ moves: msg.moves, win: msg.win, nodesSearched: msg.nodesSearched });
            } else if (msg.type === 'error') {
              reject(new Error(msg.message));
            }
          };

          worker.postMessage({ type: 'solve', state, n0, n1, maxTime });
        });
      }

      // Fallback: main thread
      const { SolitaireState } = await import('../solver/SolitaireState');
      const { NestedRolloutSolver } = await import('../solver/NestedRolloutSolver');

      const gs = new SolitaireState();
      gs.tableau = state.tableau.map(col => col.slice());
      gs.foundation = state.foundation.map(pile => pile.slice());
      gs.stock = state.stock.slice();
      gs.waste = state.waste.slice();

      const solver = new NestedRolloutSolver(gs, maxTime, n0, n1);
      const moves = solver.solve();
      const win = solver.finalState?.isWin() ?? false;
      return {
        moves: moves.map(m => ({
          actionType: m.actionType as number,
          srcIdx: m.srcIdx,
          destIdx: m.destIdx,
          card: m.card,
          numCards: m.numCards,
          stockTurns: m.stockTurns,
          priority: m.priority,
        })),
        win,
        nodesSearched: solver.nodesSearched,
      };
    } catch (err) {
      console.error('Solve error:', err);
      return null;
    } finally {
      solvingRef.current = false;
      setSolving(false);
    }
  }, []);

  const cancel = useCallback(() => {
    // Cancel is best-effort with workers
  }, []);

  return { requestHint, solve, cancel, hinting, solving };
}
