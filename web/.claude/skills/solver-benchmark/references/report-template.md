# Solitaire Solver Benchmark Report

**Date**: {DATE}
**Platform**: {PLATFORM}
**Runtime**: {RUNTIME}
**Algorithm**: Nested Rollout Policy Adaptation (NRPA)
**Reference Paper**: "Searching Solitaire in Real Time" (Bjarnason, Tadepalli, Fern)

---

## Summary

| Config | Games | Win Rate | Avg Time | Median Time | Avg Nodes |
|--------|-------|----------|----------|-------------|-----------|
{SUMMARY_TABLE}

### Paper Comparison

| Implementation | Config | Games | Timeout | Win Rate |
|----------------|--------|-------|---------|----------|
| Paper (C++) | n0=1, n1=1 | 50,000 | 60s | **74.94%** |
{OUR_RESULTS}

**Gap analysis**: {GAP_ANALYSIS}

---

## Algorithm Overview

NRPA for Thoughtful Klondike Solitaire (all cards visible).

### Search Levels
```
Level 0 (Greedy): Evaluate each legal move with heuristic, pick best
Level 1 (1-ply):  For each move, do a Level 0 rollout to evaluate
Level 2 (2-ply):  For each move, do a Level 1 rollout to evaluate
```

### Key Features
- **Dual heuristic** (H1/H2): Switches on stall
- **K+ representation**: Stock/Waste as macro-actions
- **Sub-path WIN propagation**: Applies winning sub-path directly
- **Loop detection**: Global state hash set + reverse-move filtering

### Heuristic Features (6 total)
| # | Feature | H1 Weight | H2 Weight |
|---|---------|-----------|-----------|
| 1 | Card in Foundation | 5 - rank | 5 (flat) |
| 2 | Face-down in Tableau | rank - 13 | rank - 13 |
| 3 | Reachable from Talon | 0 | +1 per card |
| 4 | Same-rank/color pair both face-down | -5 | -1 |
| 5 | Blocks suited card of lesser rank | -5 | -1 |
| 6 | Blocks own tableau build card | -10 | -5 |

---

## Detailed Results

{DETAILED_RESULTS}

---

## Optimizations

### Active
| Optimization | Impact | Description |
|-------------|--------|-------------|
| Partial stack moves | +8% win rate | Sub-section T→T moves |
| Sub-path WIN propagation | +20% win rate | Apply winning sub-path directly |
| Cached suit values | ~2x speedup | Avoid Enum `.value` overhead |
| Move signature packing | Faster loop detection | 32-bit packed move identity |
| FNV-1a state hash | Fast loop detection | 32-bit game state hash |
| K+ macro-actions | Better waste access | Simulate stock cycling |

---

## Reproducibility

Seeds 1-N with Mulberry32 PRNG. Run:
```bash
cd web
npx tsx benchmark-solver.ts
```

Results may vary ±3% due to `Math.random()` in move ordering.
