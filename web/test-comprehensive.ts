import {
  SolitaireState,
  NestedRolloutSolver,
  ActionType,
  Suit,
  WIN_VALUE,
  makeCard,
} from './src/solver/index';
import type { Card, Move } from './src/solver/index';

// ===== Helpers =====

function allCards(state: SolitaireState): Card[] {
  const cards: Card[] = [];
  for (const col of state.tableau) for (const c of col) cards.push(c);
  for (const pile of state.foundation) for (const c of pile) cards.push(c);
  for (const c of state.stock) cards.push(c);
  for (const c of state.waste) cards.push(c);
  return cards;
}

function cardId(c: Card): string {
  return `${c.rank}-${c.suit}`;
}

function checkNoDuplicatesAnd52(state: SolitaireState, label: string): { ok: boolean; msg: string } {
  const cards = allCards(state);
  if (cards.length !== 52) {
    return { ok: false, msg: `${label}: expected 52 cards, got ${cards.length}` };
  }
  const seen = new Set<string>();
  for (const c of cards) {
    const id = cardId(c);
    if (seen.has(id)) {
      return { ok: false, msg: `${label}: duplicate card ${id}` };
    }
    seen.add(id);
  }
  return { ok: true, msg: '' };
}

let passCount = 0;
let failCount = 0;

function report(name: string, ok: boolean, detail: string = '') {
  if (ok) {
    passCount++;
    console.log(`  PASS: ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failCount++;
    console.log(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ===================================================================
// TEST 1: Deal correctness
// ===================================================================
console.log('\n=== TEST 1: Deal Correctness ===');
{
  let allOk = true;
  for (let seed = 0; seed < 20; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);

    // Check 52 cards, no duplicates
    const check = checkNoDuplicatesAnd52(state, `seed=${seed}`);
    if (!check.ok) { allOk = false; console.log(`  FAIL detail: ${check.msg}`); continue; }

    // Tableau layout: columns 0..6 have 1..7 cards
    for (let i = 0; i < 7; i++) {
      if (state.tableau[i].length !== i + 1) {
        allOk = false;
        console.log(`  FAIL: seed=${seed} col ${i} has ${state.tableau[i].length} cards, expected ${i + 1}`);
      }
      // Top card should be face up
      if (!state.tableau[i][state.tableau[i].length - 1].faceUp) {
        allOk = false;
        console.log(`  FAIL: seed=${seed} col ${i} top card not face up`);
      }
      // Cards below top should be face down
      for (let j = 0; j < i; j++) {
        if (state.tableau[i][j].faceUp) {
          allOk = false;
          console.log(`  FAIL: seed=${seed} col ${i} card ${j} should be face down`);
        }
      }
    }

    // Stock should have 24 cards (52 - 28 tableau)
    if (state.stock.length !== 24) {
      allOk = false;
      console.log(`  FAIL: seed=${seed} stock has ${state.stock.length} cards, expected 24`);
    }

    // Waste should be empty
    if (state.waste.length !== 0) {
      allOk = false;
      console.log(`  FAIL: seed=${seed} waste not empty`);
    }

    // Foundation should be empty
    for (let fi = 0; fi < 4; fi++) {
      if (state.foundation[fi].length !== 0) {
        allOk = false;
        console.log(`  FAIL: seed=${seed} foundation ${fi} not empty`);
      }
    }
  }
  report('Deal correctness (20 seeds)', allOk);
}

// ===================================================================
// TEST 2: Move generation correctness
// ===================================================================
console.log('\n=== TEST 2: Move Generation Correctness ===');
{
  let allOk = true;
  let totalMoves = 0;

  for (let seed = 0; seed < 10; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);
    const moves = state.getOrderedMoves();
    totalMoves += moves.length;

    for (const m of moves) {
      switch (m.actionType) {
        case ActionType.TABLEAU_TO_FOUNDATION: {
          const col = state.tableau[m.srcIdx];
          if (col.length === 0) { allOk = false; console.log(`  FAIL: T->F from empty col ${m.srcIdx} seed=${seed}`); break; }
          const top = col[col.length - 1];
          if (top.rank !== m.card.rank || top.suit !== m.card.suit) {
            allOk = false; console.log(`  FAIL: T->F card mismatch seed=${seed}`); break;
          }
          const fPile = state.foundation[m.destIdx];
          if (fPile.length === 0) {
            if (m.card.rank !== 1) { allOk = false; console.log(`  FAIL: T->F non-ace to empty foundation seed=${seed}`); }
          } else {
            const fTop = fPile[fPile.length - 1];
            if (fTop.rank !== m.card.rank - 1 || fTop.suit !== m.card.suit) {
              allOk = false; console.log(`  FAIL: T->F invalid foundation placement seed=${seed}`);
            }
          }
          break;
        }
        case ActionType.TABLEAU_TO_TABLEAU: {
          const col = state.tableau[m.srcIdx];
          if (col.length === 0) { allOk = false; console.log(`  FAIL: T->T from empty col seed=${seed}`); break; }
          const movingIdx = col.length - m.numCards;
          const moving = col[movingIdx];
          if (moving.rank !== m.card.rank || moving.suit !== m.card.suit) {
            allOk = false; console.log(`  FAIL: T->T card mismatch seed=${seed}`); break;
          }
          if (!moving.faceUp) {
            allOk = false; console.log(`  FAIL: T->T moving face-down card seed=${seed}`); break;
          }
          const destCol = state.tableau[m.destIdx];
          if (destCol.length === 0) {
            if (m.card.rank !== 13) {
              allOk = false; console.log(`  FAIL: T->T non-king to empty col seed=${seed}`);
            }
          } else {
            const destTop = destCol[destCol.length - 1];
            if (!destTop.faceUp) {
              allOk = false; console.log(`  FAIL: T->T dest top face down seed=${seed}`); break;
            }
            if (m.card.rank !== destTop.rank - 1) {
              allOk = false; console.log(`  FAIL: T->T rank mismatch: ${m.card.rank} on ${destTop.rank} seed=${seed}`); break;
            }
            const movingRed = m.card.suit === Suit.HEARTS || m.card.suit === Suit.DIAMONDS;
            const destRed = destTop.suit === Suit.HEARTS || destTop.suit === Suit.DIAMONDS;
            if (movingRed === destRed) {
              allOk = false; console.log(`  FAIL: T->T same color seed=${seed}`); break;
            }
          }
          break;
        }
        case ActionType.WASTE_TO_FOUNDATION: {
          // Waste moves use K+ macro, so we simulate the stock turns to check
          // The card should match what would be on top of waste after stockTurns
          const fPile = state.foundation[m.destIdx];
          if (fPile.length === 0) {
            if (m.card.rank !== 1) { allOk = false; console.log(`  FAIL: W->F non-ace to empty foundation seed=${seed}`); }
          } else {
            const fTop = fPile[fPile.length - 1];
            if (fTop.rank !== m.card.rank - 1) {
              allOk = false; console.log(`  FAIL: W->F invalid foundation rank seed=${seed}`);
            }
            if (fTop.suit !== m.card.suit) {
              allOk = false; console.log(`  FAIL: W->F suit mismatch seed=${seed}`);
            }
          }
          break;
        }
        case ActionType.WASTE_TO_TABLEAU: {
          const destCol = state.tableau[m.destIdx];
          if (destCol.length === 0) {
            if (m.card.rank !== 13) {
              allOk = false; console.log(`  FAIL: W->T non-king to empty col seed=${seed}`);
            }
          } else {
            const destTop = destCol[destCol.length - 1];
            if (m.card.rank !== destTop.rank - 1) {
              allOk = false; console.log(`  FAIL: W->T rank mismatch seed=${seed}`);
            }
            const movingRed = m.card.suit === Suit.HEARTS || m.card.suit === Suit.DIAMONDS;
            const destRed = destTop.suit === Suit.HEARTS || destTop.suit === Suit.DIAMONDS;
            if (movingRed === destRed) {
              allOk = false; console.log(`  FAIL: W->T same color seed=${seed}`);
            }
          }
          break;
        }
        case ActionType.FOUNDATION_TO_TABLEAU: {
          const fPile = state.foundation[m.srcIdx];
          if (fPile.length === 0) { allOk = false; console.log(`  FAIL: F->T from empty foundation seed=${seed}`); break; }
          const fTop = fPile[fPile.length - 1];
          if (fTop.rank !== m.card.rank || fTop.suit !== m.card.suit) {
            allOk = false; console.log(`  FAIL: F->T card mismatch seed=${seed}`);
          }
          const destCol = state.tableau[m.destIdx];
          if (destCol.length === 0) {
            if (m.card.rank !== 13) {
              allOk = false; console.log(`  FAIL: F->T non-king to empty col seed=${seed}`);
            }
          } else {
            const destTop = destCol[destCol.length - 1];
            if (m.card.rank !== destTop.rank - 1) {
              allOk = false; console.log(`  FAIL: F->T rank mismatch seed=${seed}`);
            }
            const movingRed = m.card.suit === Suit.HEARTS || m.card.suit === Suit.DIAMONDS;
            const destRed = destTop.suit === Suit.HEARTS || destTop.suit === Suit.DIAMONDS;
            if (movingRed === destRed) {
              allOk = false; console.log(`  FAIL: F->T same color seed=${seed}`);
            }
          }
          break;
        }
      }
    }
  }
  report(`Move generation correctness (10 seeds, ${totalMoves} total moves)`, allOk);
}

// ===================================================================
// TEST 3: Move application correctness
// ===================================================================
console.log('\n=== TEST 3: Move Application Correctness ===');
{
  let allOk = true;
  let movesApplied = 0;

  for (let seed = 0; seed < 10; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);

    // Apply a sequence of moves (up to 200) checking invariants each time
    for (let step = 0; step < 200; step++) {
      const moves = state.getOrderedMoves();
      if (moves.length === 0) break;

      // Pick first move (highest priority)
      const move = moves[0];

      // Count cards in source and dest before
      let srcBefore: number, destBefore: number;
      switch (move.actionType) {
        case ActionType.TABLEAU_TO_FOUNDATION:
          srcBefore = state.tableau[move.srcIdx].length;
          destBefore = state.foundation[move.destIdx].length;
          break;
        case ActionType.TABLEAU_TO_TABLEAU:
          srcBefore = state.tableau[move.srcIdx].length;
          destBefore = state.tableau[move.destIdx].length;
          break;
        case ActionType.WASTE_TO_FOUNDATION:
          srcBefore = state.waste.length;
          destBefore = state.foundation[move.destIdx].length;
          break;
        case ActionType.WASTE_TO_TABLEAU:
          srcBefore = state.waste.length;
          destBefore = state.tableau[move.destIdx].length;
          break;
        case ActionType.FOUNDATION_TO_TABLEAU:
          srcBefore = state.foundation[move.srcIdx].length;
          destBefore = state.tableau[move.destIdx].length;
          break;
        default:
          srcBefore = 0; destBefore = 0;
      }

      state.applyMove(move);
      movesApplied++;

      // Check 52 cards, no duplicates
      const check = checkNoDuplicatesAnd52(state, `seed=${seed} step=${step}`);
      if (!check.ok) {
        allOk = false;
        console.log(`  FAIL detail: ${check.msg}`);
        break;
      }

      // Check source shrunk and dest grew (for non-stock-turn moves)
      // Note: waste moves with stockTurns change stock/waste counts too,
      // so only check tableau/foundation moves precisely
      if (move.actionType === ActionType.TABLEAU_TO_FOUNDATION) {
        const srcAfter = state.tableau[move.srcIdx].length;
        const destAfter = state.foundation[move.destIdx].length;
        if (srcAfter !== srcBefore - 1 || destAfter !== destBefore + 1) {
          allOk = false;
          console.log(`  FAIL: T->F pile sizes wrong seed=${seed} step=${step}`);
        }
      } else if (move.actionType === ActionType.TABLEAU_TO_TABLEAU) {
        const srcAfter = state.tableau[move.srcIdx].length;
        const destAfter = state.tableau[move.destIdx].length;
        if (srcAfter !== srcBefore - move.numCards || destAfter !== destBefore + move.numCards) {
          allOk = false;
          console.log(`  FAIL: T->T pile sizes wrong seed=${seed} step=${step}: src ${srcBefore}->${srcAfter} (expected -${move.numCards}), dest ${destBefore}->${destAfter}`);
        }
      } else if (move.actionType === ActionType.FOUNDATION_TO_TABLEAU) {
        const srcAfter = state.foundation[move.srcIdx].length;
        const destAfter = state.tableau[move.destIdx].length;
        if (srcAfter !== srcBefore - 1 || destAfter !== destBefore + 1) {
          allOk = false;
          console.log(`  FAIL: F->T pile sizes wrong seed=${seed} step=${step}`);
        }
      }

      if (state.isWin()) break;
    }
  }
  report(`Move application correctness (${movesApplied} moves applied)`, allOk);
}

// ===================================================================
// TEST 4: Solver win verification (replay)
// ===================================================================
console.log('\n=== TEST 4: Solver Win Verification ===');
{
  let allOk = true;
  let winsVerified = 0;

  // Run solver on a few seeds, replay wins
  for (let seed = 0; seed < 10; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);

    const solver = new NestedRolloutSolver(state, 5, 1, 1);
    const moves = solver.solve();
    const finalState = solver.finalState;

    if (finalState && finalState.isWin()) {
      // Replay from scratch
      const replay = new SolitaireState();
      replay.dealThoughtful(seed);

      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        replay.applyMove(m);

        // Check 52 cards at each step
        const check = checkNoDuplicatesAnd52(replay, `replay seed=${seed} move=${i}`);
        if (!check.ok) {
          allOk = false;
          console.log(`  FAIL detail: ${check.msg}`);
          break;
        }
      }

      const foundTotal = replay.foundation[0].length + replay.foundation[1].length +
                          replay.foundation[2].length + replay.foundation[3].length;
      if (foundTotal !== 52) {
        allOk = false;
        console.log(`  FAIL: seed=${seed} replay foundation total ${foundTotal}, expected 52`);
      } else {
        winsVerified++;
      }
    }
  }
  report(`Solver win verification (${winsVerified} wins replayed correctly)`, allOk, `${winsVerified} wins verified`);
}

// ===================================================================
// TEST 5: Multi-seed win rate (50 games)
// ===================================================================
console.log('\n=== TEST 5: Multi-Seed Win Rate (50 games) ===');
{
  let wins = 0;
  const results: string[] = [];
  const startAll = performance.now();

  for (let seed = 0; seed < 50; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);

    const solver = new NestedRolloutSolver(state, 2, 1, 1);
    const start = performance.now();
    const moves = solver.solve();
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);

    const isWin = solver.finalState?.isWin() ?? false;
    if (isWin) wins++;
    results.push(`  Seed ${String(seed).padStart(2)}: ${isWin ? 'WIN ' : 'LOSS'} (${elapsed}s, ${solver.nodesSearched} nodes, ${moves.length} moves)`);
  }

  const totalTime = ((performance.now() - startAll) / 1000).toFixed(1);
  for (const r of results) console.log(r);

  const winRate = ((wins / 50) * 100).toFixed(1);
  console.log(`\n  Win rate: ${wins}/50 = ${winRate}% (total time: ${totalTime}s)`);
  console.log(`  Paper target: ~74.94% (n0=1, n1=1, C++ 50k games)`);

  // Pass if win rate is at least 50% (reasonable for 50 games with 2s timeout)
  const passed = wins >= 25;
  report(`Win rate ${winRate}%`, passed, `${wins}/50 wins`);
}

// ===================================================================
// TEST 6: State hash consistency
// ===================================================================
console.log('\n=== TEST 6: State Hash Consistency ===');
{
  let allOk = true;

  for (let seed = 0; seed < 10; seed++) {
    const state = new SolitaireState();
    state.dealThoughtful(seed);

    const h1 = state.stateHash();

    // Clone and verify hash matches
    const cloned = state.clone();
    const h2 = cloned.stateHash();
    if (h1 !== h2) {
      allOk = false;
      console.log(`  FAIL: seed=${seed} clone hash mismatch: ${h1} vs ${h2}`);
    }

    // Apply a move and verify hash changes
    const moves = state.getOrderedMoves();
    if (moves.length > 0) {
      state.applyMove(moves[0]);
      const h3 = state.stateHash();
      if (h3 === h1) {
        // This could theoretically happen by collision, but extremely unlikely
        allOk = false;
        console.log(`  FAIL: seed=${seed} hash unchanged after move (likely bug)`);
      }

      // Restore from clone and verify hash matches original
      const h4 = cloned.stateHash();
      if (h4 !== h2) {
        allOk = false;
        console.log(`  FAIL: seed=${seed} clone hash changed unexpectedly: ${h2} vs ${h4}`);
      }
    }

    // Additional: two independent clones should match
    const state2 = new SolitaireState();
    state2.dealThoughtful(seed);
    const h5 = state2.stateHash();
    if (h5 !== h2) {
      allOk = false;
      console.log(`  FAIL: seed=${seed} re-deal hash mismatch: ${h2} vs ${h5}`);
    }
  }
  report('State hash consistency (10 seeds)', allOk);
}

// ===================================================================
// Summary
// ===================================================================
console.log('\n' + '='.repeat(50));
console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} tests`);
if (failCount > 0) {
  console.log('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
