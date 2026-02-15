import type { WorkerRequest, WorkerResponse, SerializedMove } from './workerProtocol';
import type { Card } from './types';
import { SolitaireState } from './SolitaireState';
import { NestedRolloutSolver } from './NestedRolloutSolver';

let currentSolver: NestedRolloutSolver | null = null;

function deserializeState(data: { tableau: Card[][]; foundation: Card[][]; stock: Card[]; waste: Card[] }): SolitaireState {
  const state = new SolitaireState();
  state.tableau = data.tableau.map(col => col.slice());
  state.foundation = data.foundation.map(pile => pile.slice());
  state.stock = data.stock.slice();
  state.waste = data.waste.slice();
  return state;
}

function serializeMove(m: { actionType: number; srcIdx: number; destIdx: number; card: Card; numCards: number; stockTurns: number; priority: number }): SerializedMove {
  return {
    actionType: m.actionType,
    srcIdx: m.srcIdx,
    destIdx: m.destIdx,
    card: m.card,
    numCards: m.numCards,
    stockTurns: m.stockTurns,
    priority: m.priority,
  };
}

function postResponse(msg: WorkerResponse): void {
  self.postMessage(msg);
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;

  if (req.type === 'cancel') {
    if (currentSolver) currentSolver.cancel();
    return;
  }

  if (req.type === 'solve') {
    try {
      const state = deserializeState(req.state);
      const solver = new NestedRolloutSolver(state, req.maxTime, req.n0, req.n1);
      currentSolver = solver;
      const moves = solver.solve();
      const win = solver.finalState?.isWin() ?? false;
      postResponse({
        type: 'solution',
        moves: moves.map(serializeMove),
        win,
        nodesSearched: solver.nodesSearched,
      });
    } catch (err) {
      postResponse({ type: 'error', message: String(err) });
    } finally {
      currentSolver = null;
    }
    return;
  }

  if (req.type === 'hint') {
    try {
      const state = deserializeState(req.state);
      const solver = new NestedRolloutSolver(state, req.maxTime, 1, 1);
      currentSolver = solver;
      const moves = solver.solve();
      const hint = moves.length > 0 ? serializeMove(moves[0]) : null;
      postResponse({ type: 'hint', move: hint });
    } catch (err) {
      postResponse({ type: 'error', message: String(err) });
    } finally {
      currentSolver = null;
    }
    return;
  }
};
