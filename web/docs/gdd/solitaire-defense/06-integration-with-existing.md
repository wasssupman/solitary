# Integration with Existing Codebase - 기존 코드베이스 통합 가이드

## 기존 아키텍처 참조

현재 Solitary 프로젝트는 다음 구조를 가진다:

```
web/src/
  app/           -> Next.js 라우트 (/, /play, /simulate)
  components/    -> React UI
  hooks/         -> useGameState, useSolver
  game/
    bridge/      -> GameBridge (React <-> Phaser)
    scenes/      -> TableScene
    objects/     -> CardSprite, PileZone
    rendering/   -> CardRenderer, LayoutManager, AnimationManager
    config.ts    -> Phaser config
  solver/        -> SolitaireState, Evaluator, NestedRolloutSolver
```

## 재사용 컴포넌트

### 완전 재사용 (수정 없음)

| 컴포넌트 | 용도 |
|---------|------|
| `solver/types.ts` | Card, Suit, Rank 타입 정의 |
| `solver/Deck.ts` | Seeded shuffle (Mulberry32) - 시드 기반 덱 생성 |
| `game/objects/CardSprite.ts` | 카드 스프라이트 렌더링 |
| `game/rendering/CardRenderer.ts` | 카드 텍스처 생성 |

### 확장 재사용 (인터페이스 확장)

| 컴포넌트 | 확장 방향 |
|---------|----------|
| `solver/SolitaireState.ts` | Defense용 상태 래퍼 (Foundation 이벤트 훅 추가) |
| `game/bridge/GameBridge.ts` | Defense 모드용 이벤트/콜백 추가 |
| `game/rendering/LayoutManager.ts` | 디펜스 레인 레이아웃 계산 추가 |
| `game/rendering/AnimationManager.ts` | 전투 애니메이션 추가 |

### 신규 구현

| 컴포넌트 | 설명 |
|---------|------|
| `game/scenes/DefenseScene.ts` | 디펜스 모드 메인 Phaser 씬 |
| `game/defense/DefenseLane.ts` | 5슬롯 디펜스 레인 관리 |
| `game/defense/UnitManager.ts` | 유닛 생성/배치/전투 관리 |
| `game/defense/WaveController.ts` | 웨이브 진행/적 스폰 관리 |
| `game/defense/BattleEngine.ts` | 전투 계산 엔진 |
| `game/defense/UnitSprite.ts` | 유닛 스프라이트 |
| `game/defense/EnemySprite.ts` | 적 스프라이트 |
| `game/defense/DefenseState.ts` | 디펜스 게임 상태 관리 |
| `hooks/useDefenseGame.ts` | 디펜스 모드 React 훅 |
| `components/DefenseControls.tsx` | 디펜스 UI 컴포넌트 |
| `app/defense/page.tsx` | 디펜스 모드 라우트 |

## GameBridge 확장

기존 GameBridge 패턴을 그대로 따르되, Defense 전용 콜백을 추가한다.

```typescript
// 추가될 GameBridge 콜백
interface DefenseBridgeCallbacks {
  onCardToFoundation?: (card: Card, suit: Suit) => void;
  onDeployUnit?: (unit: UnitData, slotIndex: number) => void;
  onBattleEnd?: (result: WaveBattleResult) => void;
  onPhaseChange?: (phase: GamePhase) => void;
}
```

기존 `showHintCallback`, `applySimMoveCallback` 등과 동일한 직접 콜백 패턴 사용.
React strict mode double-mount 대응을 위해 cleanup 시 콜백 해제.

## SolitaireState 래핑

기존 SolitaireState를 직접 수정하지 않고, **래퍼 클래스**로 감싼다.

```typescript
class DefenseSolitaireState {
  private inner: SolitaireState;
  private foundationListeners: ((card: Card) => void)[];

  applyMove(move: Move): void {
    const beforeFoundation = this.getFoundationCounts();
    this.inner.applyMove(move);
    const afterFoundation = this.getFoundationCounts();
    // Foundation에 새 카드가 올라갔으면 리스너 호출
    this.detectNewFoundationCards(beforeFoundation, afterFoundation);
  }
}
```

## Phase 상태 머신

```
         ┌──────────────┐
         │  CARD_PHASE   │ <-- 솔리테어 조작
         └──────┬───────┘
                │ (턴 소진 or End Phase)
         ┌──────▼───────┐
         │ DEPLOY_PHASE  │ <-- 유닛 배치
         └──────┬───────┘
                │ (배치 완료 or Start Battle)
         ┌──────▼───────┐
         │ BATTLE_PHASE  │ <-- 자동 전투
         └──────┬───────┘
                │ (웨이브 클리어)
                │
         ┌──────▼───────┐
         │  WAVE_RESULT  │ <-- 결과 표시
         └──────┬───────┘
                │
        ┌───────┴───────┐
        │               │
   (다음 웨이브)    (게임 오버)
        │               │
  CARD_PHASE      GAME_OVER
```

## Solver 활용 (AI Hint)

기존 NestedRolloutSolver를 Card Phase에서 "힌트" 기능으로 제공한다.

- 기존 `/play` 모드의 Hint와 동일한 방식
- 다만 Defense 모드에서는 **단순 솔리테어 최적 수** 대신 **디펜스 전략을 고려한 Suit 우선순위**를 반영해야 함
- 향후 개선: Defense-aware heuristic (어떤 Suit가 현재 웨이브에 더 유리한지 고려)

### Phase 1 구현 (MVP)
- 기존 Solver 그대로 Hint 제공 (솔리테어 관점 최적 수)
- "현재 웨이브에 내성이 있는 Suit 카드를 우선 회피" 정도의 간단한 필터

### Phase 2 구현 (향후)
- Defense-aware Evaluator: Foundation 적재 시 디펜스 가치를 고려하는 평가 함수
- 웨이브 적 구성에 따른 동적 Suit 가중치 조정

## 기술적 제약 사항

1. **Phaser Scene 분리**: DefenseScene은 기존 TableScene과 완전 분리. 동시 활성화 안 됨
2. **State 직렬화**: DefenseState는 JSON 직렬화 가능해야 함 (세이브/로드 대비)
3. **성능**: Battle Phase 애니메이션은 60fps 유지. 유닛/적 합계 30체 이내로 설계
4. **Web Worker**: Battle 계산은 메인 스레드에서 처리 (복잡도 낮음). Solver만 Worker 사용
