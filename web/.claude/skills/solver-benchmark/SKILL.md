---
name: solver-benchmark
description: Run and report NRPA solitaire solver benchmarks. Use when the user asks to benchmark, test, or measure the solver's win rate, performance, or speed. Triggers on requests like "run benchmark", "test solver", "measure win rate", "solver performance", "벤치마크", "솔버 테스트".
---

# Solver Benchmark

Run the NRPA solver across seeded games and produce a structured benchmark report.

## Quick Start

Run all 3 configs (Greedy, Default, Deep):

```bash
cd web
npx tsx benchmark-solver.ts
```

Or use the skill's parametric script:

```bash
cd web
npx tsx .claude/skills/solver-benchmark/solver-benchmark/scripts/run-benchmark.ts --configs all --games 100 --timeout 5
```

Single config:

```bash
npx tsx .claude/skills/solver-benchmark/solver-benchmark/scripts/run-benchmark.ts --n0 1 --n1 1 --games 50 --timeout 10
```

## Workflow

1. **Run benchmark** using `scripts/run-benchmark.ts` with desired parameters
2. **Collect JSON output** from the `=== JSON Results ===` section at the end
3. **Generate report** using `references/report-template.md` as the structure, filling in measured values
4. **Save report** to `web/docs/solver-benchmark.md` (English) and optionally `solver-benchmark-ko.md` (Korean)

## Parameters

| Flag | Default | Description |
|------|---------|-------------|
| `--configs` | single | `all` runs Greedy + Default + Deep |
| `--games` | 100 | Number of games per config |
| `--timeout` | 5 | Seconds per game |
| `--n0` | 1 | Outer search depth |
| `--n1` | 1 | Inner search depth |

## Reference Baselines

| Config | Paper (C++) | Our Best (TS) |
|--------|-------------|---------------|
| n0=1, n1=1 | 74.94% (50K games, 60s) | ~64% (100 games, 5s) |
| n0=2, n1=1 | — | ~70% (50 games, 10s) |
| Greedy | — | ~15% (100 games) |

## Report Template

Use `references/report-template.md` for the output structure. Replace `{PLACEHOLDERS}` with actual measured values.
