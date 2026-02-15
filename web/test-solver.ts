/**
 * Solver Test Script
 * Tests:
 * 1. Solver finds moves for a given seed
 * 2. Hint flow (get state → solver → best move)
 * 3. Simulation flow (full solve → move list)
 *
 * Run: npx tsx test-solver.mts
 */

import { SolitaireState } from './src/solver/SolitaireState';
import { NestedRolloutSolver } from './src/solver/NestedRolloutSolver';
import { ActionType } from './src/solver/types';

const ACTION_NAMES: Record<number, string> = {
  [ActionType.TABLEAU_TO_FOUNDATION]: 'T→F',
  [ActionType.TABLEAU_TO_TABLEAU]: 'T→T',
  [ActionType.WASTE_TO_FOUNDATION]: 'W→F',
  [ActionType.WASTE_TO_TABLEAU]: 'W→T',
  [ActionType.FOUNDATION_TO_TABLEAU]: 'F→T',
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

// ─── Test 1: Deal & basic state ───
console.log('\n[Test 1] Deal & basic state');
{
  const state = new SolitaireState();
  state.dealThoughtful(42);

  assert(state.tableau.length === 7, 'Has 7 tableau columns');

  let totalCards = 0;
  for (const col of state.tableau) totalCards += col.length;
  for (const pile of state.foundation) totalCards += pile.length;
  totalCards += state.stock.length + state.waste.length;
  assert(totalCards === 52, `Total cards = ${totalCards} (expected 52)`);

  // Tableau structure: col i has i+1 cards
  for (let i = 0; i < 7; i++) {
    assert(state.tableau[i].length === i + 1, `Tableau col ${i} has ${i + 1} cards`);
    // Top card should be face up
    const top = state.tableau[i][state.tableau[i].length - 1];
    assert(top.faceUp === true, `Tableau col ${i} top card is face up`);
  }

  assert(!state.isWin(), 'Not a win initially');
  assert(state.waste.length === 0, 'Waste is empty initially');
  assert(state.stock.length === 24, `Stock has 24 cards (got ${state.stock.length})`);
}

// ─── Test 2: Move generation ───
console.log('\n[Test 2] Move generation');
{
  const state = new SolitaireState();
  state.dealThoughtful(42);

  const moves = state.getOrderedMoves();
  assert(moves.length > 0, `Seed 42: found ${moves.length} legal moves`);

  for (const m of moves) {
    assert(m.card !== undefined && m.card !== null, `Move has a card (${ACTION_NAMES[m.actionType as number]} rank=${m.card.rank})`);
    assert(typeof m.actionType === 'number' || typeof m.actionType === 'string',
      `ActionType is valid: ${m.actionType}`);
  }
}

// ─── Test 3: Hint (quick solve, 2 seconds) ───
console.log('\n[Test 3] Hint (2-second solve)');
{
  const state = new SolitaireState();
  state.dealThoughtful(42);

  const start = performance.now();
  const solver = new NestedRolloutSolver(state, 2, 1, 1);
  const moves = solver.solve();
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);

  assert(moves.length > 0, `Hint found ${moves.length} moves in ${elapsed}s`);

  if (moves.length > 0) {
    const first = moves[0];
    console.log(`    Best move: ${ACTION_NAMES[first.actionType as number]} ` +
      `src=${first.srcIdx} dest=${first.destIdx} ` +
      `card=rank${first.card.rank} stockTurns=${first.stockTurns}`);
    assert(first.card.rank >= 1 && first.card.rank <= 13, 'Card rank is valid');
  }
}

// ─── Test 4: Hint state serialization round-trip ───
console.log('\n[Test 4] Hint state serialization round-trip');
{
  const state = new SolitaireState();
  state.dealThoughtful(42);

  // Simulate what getSerializableState() does
  const serialized = {
    tableau: state.tableau.map(col =>
      col.map(c => ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red }))),
    foundation: state.foundation.map(pile =>
      pile.map(c => ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red }))),
    stock: state.stock.map(c =>
      ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red })),
    waste: state.waste.map(c =>
      ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red })),
  };

  // Simulate what runHintDirect() does — reconstruct from serialized
  const gs2 = new SolitaireState();
  gs2.tableau = serialized.tableau.map(col => col.slice());
  gs2.foundation = serialized.foundation.map(pile => pile.slice());
  gs2.stock = serialized.stock.slice();
  gs2.waste = serialized.waste.slice();

  const moves2 = gs2.getOrderedMoves();
  assert(moves2.length > 0, `Deserialized state has ${moves2.length} legal moves`);

  const solver2 = new NestedRolloutSolver(gs2, 2, 1, 1);
  const hint2 = solver2.solve();
  assert(hint2.length > 0, `Hint from deserialized state: ${hint2.length} moves`);
}

// ─── Test 5: Full simulation solve ───
console.log('\n[Test 5] Full simulation solve (seed 42, max 10s)');
{
  const state = new SolitaireState();
  state.dealThoughtful(42);

  const start = performance.now();
  const solver = new NestedRolloutSolver(state, 10, 1, 1);
  const moves = solver.solve();
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  const win = solver.finalState?.isWin() ?? false;

  console.log(`    Result: ${win ? 'WIN' : 'NOT SOLVED'} | ${moves.length} moves | ${solver.nodesSearched} nodes | ${elapsed}s`);
  assert(moves.length > 0, `Solver produced ${moves.length} moves`);
  assert(solver.nodesSearched > 0, `Searched ${solver.nodesSearched} nodes`);

  // Verify moves are applicable
  const verify = new SolitaireState();
  verify.dealThoughtful(42);
  let validMoves = 0;
  for (const m of moves) {
    try {
      verify.applyMove(m);
      validMoves++;
    } catch {
      console.log(`    ✗ Move ${validMoves + 1} failed to apply`);
      break;
    }
  }
  assert(validMoves === moves.length, `All ${moves.length} moves applied successfully`);
  if (win) {
    assert(verify.isWin(), 'Verification state is also a win');
  }
}

// ─── Test 6: Multiple seeds ───
console.log('\n[Test 6] Multi-seed hint test (seeds 0-9)');
{
  let hintSuccesses = 0;
  for (let seed = 0; seed < 10; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);

    const solver = new NestedRolloutSolver(state, 1, 1, 1);
    const moves = solver.solve();
    if (moves.length > 0) {
      hintSuccesses++;
    }
    const first = moves[0];
    const desc = first
      ? `${ACTION_NAMES[first.actionType as number]} rank${first.card.rank}`
      : 'no hint';
    console.log(`    Seed ${seed}: ${moves.length} moves (${desc})`);
  }
  assert(hintSuccesses === 10, `All 10 seeds produced hints (got ${hintSuccesses}/10)`);
}

// ─── Summary ───
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
