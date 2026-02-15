# Solver Algorithm

Reference: "Searching Solitaire in Real Time" (Bjarnason, Tadepalli, Fern)

## Core: Nested Rollout Policy Adaptation

2-level heuristic search. 현재 상태에서 가능한 수를 모두 평가하고, 가장 높은 점수의 수를 greedy하게 선택. 막히면 heuristic을 전환.

### Parameters
| Param | Default | 설명 |
|-------|---------|------|
| `n0` | 1 | Level 0 rollout depth |
| `n1` | 1 | Level 1 rollout depth |
| `maxTime` | 60s (solve), 2s (hint) | 시간 제한 |

### Search Flow (`_search`)
```
1. Win check → return WIN_VALUE
2. Loop detection (path에 같은 hash 존재) → return LOSS_VALUE
3. Timeout check → return evaluate(state, hType)
4. Cache check → 이미 방문한 (state, hIdx, n) → heuristic 전환
5. Main loop:
   a. 모든 legal moves 생성
   b. 각 move에 대해 재귀 평가 (depth-1)
   c. WIN 발견 → sub-path 전체를 즉시 적용 (핵심 최적화)
   d. 최고 점수 move 선택
   e. Local max (점수 하락) → heuristic 전환
   f. 선택된 move 적용, loop detection 갱신
   g. 반복
```

### Sub-path WIN Propagation (54% → 74%)
자식 노드에서 WIN 경로를 찾으면, 한 수씩 재탐색하지 않고 전체 경로를 그대로 적용.
승리 게임의 탐색 시간을 극적으로 단축.

## K+ Macro Actions

Stock/Waste를 단일 move로 표현. `Move.stockTurns` 필드가 stock cycling 횟수를 인코딩.

```
getOrderedMoves() 에서:
1. Stock+Waste 전체를 시뮬레이션 (최대 60 turns)
2. 각 turn마다 waste top 카드가 Foundation/Tableau로 갈 수 있는지 체크
3. 가능하면 move 생성: { actionType, stockTurns: N, card, dest }
4. applyMove()가 stockTurns만큼 stock을 cycling 한 후 실제 move 적용
```

## Heuristic Evaluation (6 Features)

| # | Feature | H1 (Opening) | H2 (Endgame) |
|---|---------|-------------|-------------|
| 1 | Foundation card | `5 - rank_value` | `5` (flat) |
| 2 | Face-down in tableau | `rank - 14` | `rank - 14` |
| 3 | Reachable from talon | `0` | `1` per card |
| 4 | Same-rank pair face-down | `-5` | `-1` |
| 5 | Blocks suited card | `-5` | `-1` |
| 6 | Blocks tableau build | `-10` | `-5` |

- H1: 높은 rank를 foundation에 올리는 것을 선호 (공격적)
- H2: talon 접근성 중시, blocking 페널티 완화 (보수적)
- 막히면 H1↔H2 전환

## Move Priority (getOrderedMoves)
| Priority | Move Type |
|----------|-----------|
| 1 | T→F (reveals face-down) |
| 2 | T→F (no reveal), W→F |
| 3 | T→T (reveals face-down) |
| 4 | W→T |
| 5 | F→T (King to first empty col only) |
| 6 | T→T (no reveal) |

## State Hash
FNV-1a 32-bit. Tableau (rank, suit, faceUp per card + separators) + Foundation (lengths) + Stock + Waste.
Loop detection: `path` Set에 hash 저장.

## Cache
- `caches: [Set<number>, Set<number>]` (H1용, H2용)
- Key: `stateHash * 32 + depth`
- Limit: 5000 per heuristic
- Cache hit → heuristic 전환 트리거

## Performance
| Config | Win Rate | Notes |
|--------|----------|-------|
| n0=1, n1=1, 2s | ~56% | 짧은 timeout |
| n0=1, n1=1, 60s | ~74% | Paper 수준 |
| Paper (C++, 50K games) | 74.94% | Reference |
