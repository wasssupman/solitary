/**
 * Solitaire Solver Benchmark Script
 *
 * Run from project root (web/):
 *   npx tsx .claude/skills/solver-benchmark/solver-benchmark/scripts/run-benchmark.ts
 *
 * Or with custom args:
 *   npx tsx run-benchmark.ts --games 50 --timeout 10 --n0 1 --n1 1
 */

import { SolitaireState } from '../../src/solver/SolitaireState';
import { NestedRolloutSolver } from '../../src/solver/NestedRolloutSolver';

interface BenchmarkConfig {
  label: string;
  n0: number;
  n1: number;
  timeout: number;
  numGames: number;
}

interface GameResult {
  seed: number;
  won: boolean;
  moves: number;
  nodes: number;
  timeMs: number;
}

interface BenchmarkResult {
  config: BenchmarkConfig;
  results: GameResult[];
  wins: number;
  winRate: number;
  avgTimeMs: number;
  medianTimeMs: number;
  avgMoves: number;
  avgNodes: number;
  avgWinTimeMs: number;
  avgLossTimeMs: number;
  avgWinMoves: number;
}

function runSingleGame(seed: number, n0: number, n1: number, timeout: number): GameResult {
  const state = new SolitaireState();
  state.dealThoughtful(seed);

  const solver = new NestedRolloutSolver(state, timeout, n0, n1);
  const t0 = performance.now();
  const moves = solver.solve();
  const timeMs = performance.now() - t0;

  const won = solver.finalState?.isWin() ?? false;

  return {
    seed,
    won,
    moves: moves.length,
    nodes: solver.nodesSearched,
    timeMs: Math.round(timeMs),
  };
}

function runBenchmark(config: BenchmarkConfig): BenchmarkResult {
  const results: GameResult[] = [];

  for (let i = 0; i < config.numGames; i++) {
    const seed = i + 1;
    const result = runSingleGame(seed, config.n0, config.n1, config.timeout);
    results.push(result);

    const pct = Math.round(((i + 1) / config.numGames) * 100);
    const winsSoFar = results.filter(r => r.won).length;
    const rateSoFar = Math.round((winsSoFar / (i + 1)) * 100);
    process.stdout.write(`\r  [${config.label}] ${i + 1}/${config.numGames} (${pct}%) — wins: ${winsSoFar} (${rateSoFar}%) — last: ${result.won ? 'WIN' : 'LOSS'} ${result.timeMs}ms`);
  }
  console.log();

  const wins = results.filter(r => r.won).length;
  const winResults = results.filter(r => r.won);
  const lossResults = results.filter(r => !r.won);
  const times = results.map(r => r.timeMs).sort((a, b) => a - b);

  return {
    config,
    results,
    wins,
    winRate: wins / config.numGames,
    avgTimeMs: Math.round(results.reduce((s, r) => s + r.timeMs, 0) / config.numGames),
    medianTimeMs: times[Math.floor(times.length / 2)],
    avgMoves: Math.round(results.reduce((s, r) => s + r.moves, 0) / config.numGames),
    avgNodes: Math.round(results.reduce((s, r) => s + r.nodes, 0) / config.numGames),
    avgWinTimeMs: winResults.length > 0 ? Math.round(winResults.reduce((s, r) => s + r.timeMs, 0) / winResults.length) : 0,
    avgLossTimeMs: lossResults.length > 0 ? Math.round(lossResults.reduce((s, r) => s + r.timeMs, 0) / lossResults.length) : 0,
    avgWinMoves: winResults.length > 0 ? Math.round(winResults.reduce((s, r) => s + r.moves, 0) / winResults.length) : 0,
  };
}

// Parse CLI args
function parseArgs(): { games: number; timeout: number; n0: number; n1: number; configs?: string } {
  const args = process.argv.slice(2);
  const result = { games: 100, timeout: 5, n0: 1, n1: 1, configs: undefined as string | undefined };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const val = args[i + 1];
    if (key === 'games') result.games = parseInt(val);
    if (key === 'timeout') result.timeout = parseInt(val);
    if (key === 'n0') result.n0 = parseInt(val);
    if (key === 'n1') result.n1 = parseInt(val);
    if (key === 'configs') result.configs = val;
  }
  return result;
}

const cliArgs = parseArgs();

const configs: BenchmarkConfig[] = cliArgs.configs === 'all'
  ? [
      { label: 'Greedy (n0=0, n1=0)', n0: 0, n1: 0, timeout: 5, numGames: cliArgs.games },
      { label: 'Default (n0=1, n1=1)', n0: 1, n1: 1, timeout: cliArgs.timeout, numGames: cliArgs.games },
      { label: 'Deep (n0=2, n1=1)', n0: 2, n1: 1, timeout: 10, numGames: Math.min(cliArgs.games, 50) },
    ]
  : [
      { label: `n0=${cliArgs.n0}, n1=${cliArgs.n1}`, n0: cliArgs.n0, n1: cliArgs.n1, timeout: cliArgs.timeout, numGames: cliArgs.games },
    ];

console.log('=== Solitaire Solver Benchmark ===');
console.log(`Platform: ${process.platform} ${process.arch}`);
console.log(`Node.js: ${process.version}`);
console.log(`Date: ${new Date().toISOString()}`);
console.log();

const allResults: BenchmarkResult[] = [];

for (const config of configs) {
  console.log(`--- ${config.label} (timeout: ${config.timeout}s, games: ${config.numGames}) ---`);
  const result = runBenchmark(config);
  allResults.push(result);
  console.log(`  Win Rate: ${result.wins}/${config.numGames} (${(result.winRate * 100).toFixed(1)}%)`);
  console.log(`  Avg Time: ${result.avgTimeMs}ms | Median: ${result.medianTimeMs}ms`);
  console.log(`  Avg Win Time: ${result.avgWinTimeMs}ms | Avg Loss Time: ${result.avgLossTimeMs}ms`);
  console.log(`  Avg Moves: ${result.avgMoves} | Avg Win Moves: ${result.avgWinMoves}`);
  console.log(`  Avg Nodes: ${result.avgNodes}`);
  console.log();
}

// Paper comparison
console.log('=== Paper Comparison ===');
console.log('Paper: "Searching Solitaire in Real Time" (Bjarnason, Tadepalli, Fern)');
console.log('Paper result: n0=1, n1=1 → 74.94% (50,000 games, C++, 60s timeout)');
const defaultResult = allResults.find(r => r.config.n0 === 1 && r.config.n1 === 1);
if (defaultResult) {
  console.log(`Our result:   n0=1, n1=1 → ${(defaultResult.winRate * 100).toFixed(1)}% (${defaultResult.config.numGames} games, TS, ${defaultResult.config.timeout}s timeout)`);
}
console.log();

// Per-seed results for default config
if (defaultResult) {
  console.log('=== Seed-level Results (first 20) ===');
  const first20 = defaultResult.results.slice(0, 20);
  console.log('Seed | Won | Moves | Nodes | Time(ms)');
  console.log('-----|-----|-------|-------|--------');
  for (const r of first20) {
    console.log(`${String(r.seed).padStart(4)} | ${r.won ? 'WIN' : '   '} | ${String(r.moves).padStart(5)} | ${String(r.nodes).padStart(5)} | ${String(r.timeMs).padStart(7)}`);
  }
}

// JSON output for report generation
console.log('\n=== JSON Results ===');
console.log(JSON.stringify(allResults.map(r => ({
  label: r.config.label,
  n0: r.config.n0,
  n1: r.config.n1,
  timeout: r.config.timeout,
  games: r.config.numGames,
  wins: r.wins,
  winRate: +(r.winRate * 100).toFixed(1),
  avgTimeMs: r.avgTimeMs,
  medianTimeMs: r.medianTimeMs,
  avgMoves: r.avgMoves,
  avgNodes: r.avgNodes,
  avgWinTimeMs: r.avgWinTimeMs,
  avgLossTimeMs: r.avgLossTimeMs,
  avgWinMoves: r.avgWinMoves,
})), null, 2));
