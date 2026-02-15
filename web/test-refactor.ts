/**
 * Refactoring Test Script
 * Tests the new modular architecture:
 *   1. SolitaireCore (pure logic + event emitter)
 *   2. GameBridge factory (registry pattern)
 *   3. Core + Solver integration
 *
 * Run: npx tsx test-refactor.ts
 */

import { SolitaireCore } from './src/game/core/SolitaireCore';
import { getGameBridge, destroyGameBridge } from './src/game/bridge/GameBridge';
import { SolitaireState } from './src/solver/SolitaireState';
import { NestedRolloutSolver } from './src/solver/NestedRolloutSolver';
import { ActionType, makeMove, makeCard, Suit } from './src/solver/types';
import type { MoveResult, StockDrawResult } from './src/game/core/events';

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

// ─── Test 1: SolitaireCore newGame + event ───
console.log('\n[Test 1] SolitaireCore newGame + event emission');
{
  const core = new SolitaireCore();
  let eventFired = false;
  let receivedSeed = -1;

  core.on('newGame', (data) => {
    eventFired = true;
    receivedSeed = data.seed;
  });

  core.newGame(42);

  assert(eventFired, 'newGame event fired');
  assert(receivedSeed === 42, `Event received seed=42 (got ${receivedSeed})`);
  assert(core.currentSeed === 42, 'currentSeed is 42');
  assert(core.moveCount === 0, 'moveCount starts at 0');
  assert(!core.isWin, 'Not a win initially');

  // Card count
  const s = core.state;
  let total = 0;
  for (const col of s.tableau) total += col.length;
  for (const pile of s.foundation) total += pile.length;
  total += s.stock.length + s.waste.length;
  assert(total === 52, `Total cards = ${total} (expected 52)`);

  // Tableau structure
  for (let i = 0; i < 7; i++) {
    assert(s.tableau[i].length === i + 1, `Tableau col ${i} has ${i + 1} cards`);
  }
}

// ─── Test 2: SolitaireCore executeMove + event ───
console.log('\n[Test 2] SolitaireCore executeMove + event emission');
{
  const core = new SolitaireCore();
  core.newGame(42);

  const moves = core.state.getOrderedMoves();
  assert(moves.length > 0, `Seed 42 has ${moves.length} legal moves`);

  let moveEvent: MoveResult | null = null;
  core.on('moveExecuted', (data) => {
    moveEvent = data;
  });

  const firstMove = moves[0];
  const result = core.executeMove(firstMove);

  assert(moveEvent !== null, 'moveExecuted event fired');
  assert(moveEvent!.move === firstMove, 'Event contains the executed move');
  assert(moveEvent!.previousState !== undefined, 'Event contains previousState');
  assert(core.moveCount === 1, 'moveCount incremented to 1');
  assert(result.move === firstMove, 'executeMove returns correct result');
}

// ─── Test 3: SolitaireCore undo + event ───
console.log('\n[Test 3] SolitaireCore undo + event emission');
{
  const core = new SolitaireCore();
  core.newGame(42);

  // Save initial hash
  const initialHash = core.state.stateHash();

  // Execute a move
  const moves = core.state.getOrderedMoves();
  core.executeMove(moves[0]);
  assert(core.moveCount === 1, 'moveCount is 1 after move');

  const afterMoveHash = core.state.stateHash();
  assert(afterMoveHash !== initialHash, 'State changed after move');

  // Undo
  let undoFired = false;
  core.on('undone', () => { undoFired = true; });

  const undoResult = core.undo();
  assert(undoResult === true, 'undo() returns true');
  assert(undoFired, 'undone event fired');
  assert(core.moveCount === 0, 'moveCount back to 0');

  const restoredHash = core.state.stateHash();
  assert(restoredHash === initialHash, 'State restored to initial after undo');

  // Undo with empty stack
  const undoEmpty = core.undo();
  assert(undoEmpty === false, 'undo() returns false when stack empty');
}

// ─── Test 4: SolitaireCore drawStock + event ───
console.log('\n[Test 4] SolitaireCore drawStock + event emission');
{
  const core = new SolitaireCore();
  core.newGame(42);

  const initialStockLen = core.state.stock.length;
  assert(initialStockLen === 24, `Initial stock has 24 cards (got ${initialStockLen})`);
  assert(core.state.waste.length === 0, 'Initial waste is empty');

  let stockEvent: StockDrawResult | null = null;
  core.on('stockDrawn', (data) => { stockEvent = data; });

  const result = core.drawStock();
  assert(result !== null, 'drawStock returns result');
  assert(result!.drawnCount === 3, `Drew 3 cards (got ${result!.drawnCount})`);
  assert(result!.wasReset === false, 'Was not a reset');
  assert(stockEvent !== null, 'stockDrawn event fired');
  assert(core.state.stock.length === 21, `Stock now has 21 cards (got ${core.state.stock.length})`);
  assert(core.state.waste.length === 3, `Waste now has 3 cards (got ${core.state.waste.length})`);
  assert(core.moveCount === 1, 'moveCount incremented');

  // Draw stock can be undone
  core.undo();
  assert(core.state.stock.length === 24, 'Stock restored after undo');
  assert(core.state.waste.length === 0, 'Waste restored after undo');
}

// ─── Test 5: SolitaireCore drawStock reset ───
console.log('\n[Test 5] SolitaireCore drawStock reset (empty stock)');
{
  const core = new SolitaireCore();
  core.newGame(42);

  // Exhaust stock (24 cards / 3 per draw = 8 draws)
  for (let i = 0; i < 8; i++) {
    core.drawStock();
  }
  assert(core.state.stock.length === 0, 'Stock exhausted');
  assert(core.state.waste.length === 24, `Waste has 24 cards (got ${core.state.waste.length})`);

  // Next draw should reset
  let resetEvent: StockDrawResult | null = null;
  core.on('stockDrawn', (data) => { resetEvent = data; });

  const result = core.drawStock();
  assert(result !== null, 'Reset returns result');
  assert(result!.wasReset === true, 'wasReset is true');
  assert(core.state.stock.length === 24, `Stock refilled to 24 (got ${core.state.stock.length})`);
  assert(core.state.waste.length === 0, 'Waste cleared after reset');
}

// ─── Test 6: SolitaireCore canDropOnFoundation / canDropOnTableau ───
console.log('\n[Test 6] SolitaireCore validation helpers');
{
  const core = new SolitaireCore();
  core.newGame(42);

  // Foundation: empty → only Ace of matching suit
  assert(core.canDropOnFoundation(1, 0, 0) === true, 'Ace of Hearts on empty foundation[0]');
  assert(core.canDropOnFoundation(2, 0, 0) === false, '2 of Hearts on empty foundation[0] rejected');
  assert(core.canDropOnFoundation(1, 1, 0) === false, 'Ace of Diamonds on foundation[0] rejected (wrong suit)');

  // Tableau: empty → only King
  const emptyColIdx = core.state.tableau.findIndex(col => col.length === 0);
  if (emptyColIdx >= 0) {
    assert(core.canDropOnTableau(13, true, emptyColIdx) === true, 'King on empty tableau');
    assert(core.canDropOnTableau(12, true, emptyColIdx) === false, 'Non-King on empty tableau rejected');
  }

  // Tableau: stacking requires alternating color & rank-1
  const col0Top = core.state.tableau[0][core.state.tableau[0].length - 1];
  const expectRank = col0Top.rank - 1;
  const expectRedOpposite = !col0Top._red;
  if (expectRank >= 1) {
    assert(
      core.canDropOnTableau(expectRank, expectRedOpposite, 0) === true,
      `Can stack rank ${expectRank} (red=${expectRedOpposite}) on col 0 top rank ${col0Top.rank}`
    );
    assert(
      core.canDropOnTableau(expectRank, col0Top._red, 0) === false,
      'Same color rejected'
    );
  }
}

// ─── Test 7: SolitaireCore canAutoMoveToFoundation ───
console.log('\n[Test 7] SolitaireCore canAutoMoveToFoundation');
{
  const core = new SolitaireCore();
  core.newGame(42);

  // Try all tableau columns — find one that can auto-move (if any Aces are on top)
  let foundAutoMove = false;
  for (let i = 0; i < 7; i++) {
    const fi = core.canAutoMoveToFoundation('tableau', i);
    if (fi !== null) {
      const top = core.state.tableau[i][core.state.tableau[i].length - 1];
      assert(top.rank === 1, `Auto-moveable card at col ${i} is an Ace`);
      assert(fi === top._sv, `Foundation index matches suit value`);
      foundAutoMove = true;
    }
  }

  // Waste auto-move (should be null since waste is empty)
  const wasteResult = core.canAutoMoveToFoundation('waste', 0);
  assert(wasteResult === null, 'No auto-move from empty waste');

  console.log(`    Auto-move from tableau found: ${foundAutoMove}`);
}

// ─── Test 8: SolitaireCore getSerializableState ───
console.log('\n[Test 8] SolitaireCore getSerializableState');
{
  const core = new SolitaireCore();
  core.newGame(42);

  const snap = core.getSerializableState();
  assert(snap.tableau.length === 7, 'Snapshot has 7 tableau columns');
  assert(snap.foundation.length === 4, 'Snapshot has 4 foundation piles');
  assert(typeof snap.stock.length === 'number', 'Snapshot has stock array');
  assert(typeof snap.waste.length === 'number', 'Snapshot has waste array');

  // Round-trip: use snapshot to reconstruct solver state
  const gs2 = new SolitaireState();
  gs2.tableau = snap.tableau.map(col => col.slice());
  gs2.foundation = snap.foundation.map(pile => pile.slice());
  gs2.stock = snap.stock.slice();
  gs2.waste = snap.waste.slice();

  const moves2 = gs2.getOrderedMoves();
  assert(moves2.length > 0, `Reconstructed state has ${moves2.length} legal moves`);
}

// ─── Test 9: SolitaireCore getDisplayState ───
console.log('\n[Test 9] SolitaireCore getDisplayState');
{
  const core = new SolitaireCore();
  core.newGame(42);

  // Execute a move to make it interesting
  const moves = core.state.getOrderedMoves();
  core.executeMove(moves[0]);

  const display = core.getDisplayState();
  assert(display.moveCount === 1, `Display moveCount is 1 (got ${display.moveCount})`);
  assert(display.isWin === false, 'Display isWin is false');
  assert(display.tableau.length === 7, 'Display has 7 tableau columns');
  assert(display.foundation.length === 4, 'Display has 4 foundation piles');

  // Display card format: { rank, suit, faceUp }
  const firstCard = display.tableau[0][0];
  assert(typeof firstCard.rank === 'number', 'Display card has rank');
  assert(typeof firstCard.suit === 'number', 'Display card has suit');
  assert(typeof firstCard.faceUp === 'boolean', 'Display card has faceUp');
}

// ─── Test 10: SolitaireCore applyStockTurns ───
console.log('\n[Test 10] SolitaireCore applyStockTurns');
{
  const core = new SolitaireCore();
  core.newGame(42);

  const initialStock = core.state.stock.length;
  core.applyStockTurns(2);

  assert(core.state.waste.length === 6, `2 stock turns = 6 waste cards (got ${core.state.waste.length})`);
  assert(core.state.stock.length === initialStock - 6, `Stock reduced by 6 (got ${core.state.stock.length})`);
}

// ─── Test 11: SolitaireCore event off() ───
console.log('\n[Test 11] SolitaireCore event off() (unsubscribe)');
{
  const core = new SolitaireCore();
  let count = 0;
  const listener = () => { count++; };

  core.on('newGame', listener);
  core.newGame(1);
  assert(count === 1, 'Listener called once');

  core.off('newGame', listener);
  core.newGame(2);
  assert(count === 1, 'Listener not called after off()');
}

// ─── Test 12: SolitaireCore gameWon event ───
console.log('\n[Test 12] SolitaireCore gameWon event (via solver)');
{
  const core = new SolitaireCore();
  core.newGame(42);

  // Use solver to get a full solution
  const solverState = new SolitaireState();
  solverState.dealThoughtful(42);
  const solver = new NestedRolloutSolver(solverState, 10, 1, 1);
  const solverMoves = solver.solve();
  const win = solver.finalState?.isWin() ?? false;

  if (win && solverMoves.length > 0) {
    let wonFired = false;
    core.on('gameWon', () => { wonFired = true; });

    // Apply all solver moves through core.
    // executeMove strips stockTurns, so we must call applyStockTurns separately.
    for (const m of solverMoves) {
      if (m.stockTurns > 0) {
        core.applyStockTurns(m.stockTurns);
      }
      core.executeMove(m);
    }

    assert(core.isWin, 'Core reports win after all solver moves');
    assert(wonFired, 'gameWon event fired');
    assert(core.moveCount === solverMoves.length, `moveCount matches solver moves (${core.moveCount})`);
  } else {
    console.log('    (Seed 42 not solved in 10s, skipping gameWon test)');
    assert(true, 'Skipped — solver did not find win');
  }
}

// ─── Test 13: GameBridge factory ───
console.log('\n[Test 13] GameBridge factory (registry pattern)');
{
  const bridge1 = getGameBridge('play');
  const bridge2 = getGameBridge('simulate');
  const bridge1Again = getGameBridge('play');

  assert(bridge1 === bridge1Again, 'Same id returns same bridge instance');
  assert(bridge1 !== bridge2, 'Different ids return different bridges');

  // Each bridge has independent state
  bridge1.solverState = { tableau: [], foundation: [], stock: [], waste: [] };
  assert(bridge2.solverState === null, 'Bridge 2 state is independent');

  // Destroy
  destroyGameBridge('play');
  const bridge1New = getGameBridge('play');
  assert(bridge1New !== bridge1, 'After destroy, new instance is created');

  // Cleanup
  destroyGameBridge('play');
  destroyGameBridge('simulate');
}

// ─── Test 14: GameBridge event system ───
console.log('\n[Test 14] GameBridge event system');
{
  const bridge = getGameBridge('test-events');
  let received: unknown = null;

  bridge.on('stateChanged', (state) => { received = state; });
  bridge.emit('stateChanged', { test: true });
  assert(received !== null, 'Event listener received data');
  assert((received as { test: boolean }).test === true, 'Data matches');

  // clearSceneListeners removes scene-side events
  bridge.on('simMove', () => {});
  bridge.on('getState', () => {});
  bridge.clearSceneListeners();

  // stateChanged should still work (it's React-side)
  received = null;
  bridge.emit('stateChanged', { test: 2 });
  assert(received !== null, 'React-side listener survives clearSceneListeners');

  destroyGameBridge('test-events');
}

// ─── Test 15: Core + Solver integration (multi-seed) ───
console.log('\n[Test 15] Core + Solver integration (5 seeds)');
{
  let wins = 0;
  let totalMoves = 0;

  for (let seed = 0; seed < 5; seed++) {
    const core = new SolitaireCore();
    core.newGame(seed);

    // Get serializable state from core, feed to solver
    const snap = core.getSerializableState();
    const gs = new SolitaireState();
    gs.tableau = snap.tableau.map(col => col.slice());
    gs.foundation = snap.foundation.map(pile => pile.slice());
    gs.stock = snap.stock.slice();
    gs.waste = snap.waste.slice();

    const solver = new NestedRolloutSolver(gs, 2, 1, 1);
    const moves = solver.solve();

    if (moves.length > 0) {
      // Apply first 5 moves through core
      const applyCount = Math.min(5, moves.length);
      let moveEvents = 0;
      core.on('moveExecuted', () => { moveEvents++; });

      for (let i = 0; i < applyCount; i++) {
        const m = moves[i];
        if (m.stockTurns > 0) core.applyStockTurns(m.stockTurns);
        core.executeMove(m);
      }

      assert(moveEvents === applyCount, `Seed ${seed}: ${moveEvents} moveExecuted events for ${applyCount} moves`);
      totalMoves += applyCount;
    }

    if (solver.finalState?.isWin()) wins++;
  }

  console.log(`    ${wins}/5 seeds won, ${totalMoves} total moves applied through core`);
  assert(totalMoves > 0, 'At least some moves were applied');
}

// ─── Test 16: SolitaireCore multiple newGame resets ───
console.log('\n[Test 16] SolitaireCore multiple newGame resets');
{
  const core = new SolitaireCore();

  // First game
  core.newGame(42);
  const moves = core.state.getOrderedMoves();
  core.executeMove(moves[0]);
  assert(core.moveCount === 1, 'First game: moveCount is 1');

  // Start new game — everything should reset
  core.newGame(100);
  assert(core.moveCount === 0, 'Second game: moveCount reset to 0');
  assert(core.currentSeed === 100, 'Second game: seed is 100');

  // Card count still valid
  let total = 0;
  const s = core.state;
  for (const col of s.tableau) total += col.length;
  for (const pile of s.foundation) total += pile.length;
  total += s.stock.length + s.waste.length;
  assert(total === 52, `Second game: total cards = ${total}`);

  // Undo stack should be empty (from first game)
  assert(core.undo() === false, 'Undo stack cleared on newGame');
}

// ─── Test 17: SolitaireCore deterministic seeded deals ───
console.log('\n[Test 17] Deterministic seeded deals');
{
  const core1 = new SolitaireCore();
  const core2 = new SolitaireCore();

  core1.newGame(42);
  core2.newGame(42);

  assert(core1.state.stateHash() === core2.state.stateHash(), 'Same seed produces same state hash');

  core2.newGame(43);
  assert(core1.state.stateHash() !== core2.state.stateHash(), 'Different seeds produce different hashes');
}

// ─── Test 18: SolitaireCore random seed (no argument) ───
console.log('\n[Test 18] SolitaireCore random seed (no argument)');
{
  const core = new SolitaireCore();
  core.newGame();
  assert(core.currentSeed >= 0, `Random seed assigned: ${core.currentSeed}`);
  assert(core.state.tableau.length === 7, 'Game dealt correctly with random seed');
}

// ─── Summary ───
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
