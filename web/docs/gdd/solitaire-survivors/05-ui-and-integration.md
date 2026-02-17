# UI & Integration - 화면 구성 및 기존 코드베이스 통합

## 화면 구조

게임 화면은 **상하 분할** 구조로, 상단에 2D 전투 뷰, 하단에 솔리테어 영역을 배치한다. 두 영역은 **실시간으로 동시에 진행**되며, 플레이어는 하단의 솔리테어를 조작하면서 상단의 전투 상황을 계속 의식해야 한다.

### 전체 레이아웃

```
┌─────────────────────────────────────────────────────┐
│  [시간/웨이브]     [점수]         [HP 바]  [설정]     │  <- HUD (5% 높이)
├─────────────────────────────────────────────────────┤
│                                                     │
│              상단: 전투 뷰 (55%)                     │
│                                                     │
│    적    적                           적    적      │
│                                                     │
│  적            [플레이어 캐릭터]            적       │
│                   (중앙 고정)                       │
│                                                     │
│        적                             적            │
│    적                                       적      │
│                                                     │
│  [♠️x3] [♥️x2] [♦️x1] [♣️x0]  <- 투사체 수 표시      │
├─────────────────────────────────────────────────────┤
│ [체인 게이지 ████████░░] [🃏][👁️][💣]  <- 중간 바 (5%) │
├─────────────────────────────────────────────────────┤
│                                                     │
│          하단: 솔리테어 뷰 (35%)                     │
│                                                     │
│    [F♠️] [F♥️] [F♦️] [F♣️]      [Stock] [Waste]     │
│     A     3     2     K                            │
│                                                     │
│  [T1] [T2] [T3] [T4] [T5] [T6] [T7]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**비율 배분**:
- 상단 HUD: 5%
- 전투 뷰: 55% (실시간 액션의 시각적 피드백 중시)
- 중간 바: 5%
- 솔리테어 뷰: 35% (기존 Klondike 레이아웃 비율 유지)

## HUD 요소 상세

### 상단 고정 HUD

| 요소 | 내용 | 위치 | 시각 피드백 |
|------|------|------|-----------|
| **시간/웨이브** | "Wave 3/10 - 2:47" | 좌상 | 웨이브 전환 시 플래시 이펙트 |
| **점수** | 현재 누적 점수 | 중앙 좌 | 적 처치/콤보 시 증가 애니메이션 |
| **HP 바** | 플레이어 체력 (100/100) | 중앙 우 | 피격 시 흔들림, 낮을수록 빨강 |
| **설정** | 사운드/일시정지/종료 | 우상 | 톱니바퀴 아이콘 |

### 전투 뷰 (상단)

**플레이어 캐릭터**:
- 중앙에 고정, 이동하지 않음
- HP 바는 캐릭터 아래가 아닌 상단 HUD에 통합 (화면 혼잡도 감소)
- 피격 시 화이트 플래시 + 0.5초 무적 표시 (반투명)
- 넉백 시 약간 밀려나는 애니메이션

**적 시각화**:
- 360도 방향에서 스폰, 플레이어를 향해 직선 이동
- 각 적의 머리 위에 **Suit 약점 아이콘** (♠️/♥️/♦️/♣️ 중 하나)
  - 약점 Suit로 공격 시 데미지 배율 표시 ("WEAK! x2.0")
- HP 바는 적 위에 작은 게이지로 표시
- 적 타입별 색상/크기 구분:
  - 일반: 작은 크기, 회색
  - 정예: 중간 크기, 노랑 테두리
  - 보스: 큰 크기, 빨강 테두리 + 이름표

**투사체 시각화**:
- **Suit별 색상 구분**:
  - ♠️ Spade: 보라색 검기 (부채�ol 범위)
  - ♥️ Heart: 빨강 성탄오브 (플레이어 주변 공전)
  - ♦️ Diamond: 파랑 화살 (유도 탄환)
  - ♣️ Club: 초록 화염구 (범위 폭발)
- 투사체 수는 Foundation Rank에 따라 0~5발
- 공격 히트 시 Suit 색상의 파티클 이펙트

**결계 존 (빈 Tableau 열)**:
- 빈 Tableau 열이 있으면 플레이어 주변에 **반투명 결계 영역** 표시
- 결계 내 진입한 적은 감속 (속도 50%) + 색상 변화 (파랑 톤)
- 빈 열 수만큼 결계 반경 확대

**Full Suit 궁극기 이펙트**:
- K 완성 시 화면 전체에 Suit 색상 플래시
- Suit별 특수 효과 애니메이션:
  - Spade: 화면 중앙에서 방사형 검기 폭발
  - Heart: 플레이어 주변에 치유 파티클
  - Diamond: 화살 3발 → 5발 → 7발로 확산
  - Club: 화면 전체에 화염 바닥 생성

**투사체 수 표시 (전투 뷰 하단)**:
- 현재 활성 투사체 수를 Suit별로 표시: `[♠️x3] [♥️x2] [♦️x1] [♣️x0]`
- 투사체 발사될 때마다 카운터 깜빡임
- 0발인 Suit는 회색 처리

### 중간 바 (체인 게이지 + 야생카드)

**체인 게이지**:
- Tableau 이동 시 충전되는 게이지 바
- 충전 비율 표시: `[████████░░] 80%`
- 100% 도달 시 자동 발동:
  - 화면 전체에 "CHAIN BURST!" 텍스트
  - 3초간 모든 투사체 발사속도 2배
  - 게이지 소진 후 0%로 리셋

**야생카드 슬롯 (3개)**:
- 적 처치 시 드랍되는 야생카드를 보관하는 슬롯
- 각 슬롯에 카드 아이콘 표시:
  - 🃏 **Joker** (7% 드랍): 만능 카드, Foundation/Tableau 어디든 사용 가능
  - 👁️ **Peek** (5% 드랍): face-down 카드 미리보기 (3장)
  - 💣 **Bomb** (3% 드랍): Foundation 배치 시 전체 적 데미지, Tableau 배치 시 인접 face-down 카드 뒤집기
- 슬롯이 비어있으면 회색 윤곽선
- 드랍 시 슬롯으로 날아오는 애니메이션
- 클릭 또는 드래그 앤 드롭으로 사용

### 솔리테어 뷰 (하단)

**표준 Klondike 레이아웃**:
- Foundation 4열 (♠️♥️♦️♣️): 좌측 상단
- Stock/Waste: 우측 상단
- Tableau 7열: 하단

**Foundation 시각 피드백**:
| 액션 | 시각 효과 |
|------|----------|
| 카드 적재 | 1. 카드가 Foundation으로 이동 애니메이션<br>2. Suit 색상의 파티클 이펙트<br>3. 상단 전투 뷰에 해당 Suit 투사체 1발 즉시 발사 |
| 듀얼 콤보 충족 | Foundation 파일에 글로우 이펙트 (Red/Black/Royal 조합) |
| Full Suit (K) 완성 | 금색 테두리 + 별 파티클 + 궁극기 발동 |

**Foundation 현재 Tier 표시**:
- 각 Foundation 파일 상단에 현재 Rank 숫자 표시 (예: "A", "3", "10", "K")
- Tier가 높을수록 숫자 크기 확대 + 금색 톤

**Tableau 시각 피드백**:
| 액션 | 시각 효과 |
|------|----------|
| Tableau → Tableau 이동 | 체인 게이지 상승 애니메이션 (중간 바) |
| face-down 카드 뒤집기 | 카드 회전 애니메이션 + 작은 파티클 |
| Peek 사용 | face-down 카드가 0.5초간 반투명으로 앞면 표시 |
| 빈 열 생성 | 빈 열 배경에 미세한 글로우 + 상단 전투 뷰에 결계 영역 생성 |

**웨이브 클리어 자동 reveal**:
- 웨이브 클리어 시 face-down 카드 1장이 자동으로 뒤집힘
- 해당 카드에 금색 테두리 + 회전 애니메이션
- "WAVE CLEARED! +1 REVEAL" 텍스트 표시

## 레벨업 UI

레벨업 시 게임이 **슬로우 모션(0.2배속)**으로 전환되며, 화면 중앙에 선택지가 표시된다.

```
┌─────────────────────────────────────────┐
│                                         │
│          ★ LEVEL UP! ★                  │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  │  [⚔️]     │  │  [❤️]     │  │  [🎴]     │
│  │          │  │          │  │          │
│  │ Spade    │  │ Max HP   │  │ Wild     │
│  │ Damage   │  │ +20      │  │ Drop     │
│  │ +20%     │  │          │  │ +5%      │
│  │          │  │          │  │          │
│  └──────────┘  └──────────┘  └──────────┘
│   투사체 강화     생존 강화     솔리테어 보조
│                                         │
└─────────────────────────────────────────┘
```

**카드 형태 선택지**:
- 3개의 카드 모양 UI (솔리테어 테마)
- 각 카드에 카테고리 아이콘 + 효과 명 + 수치
- 마우스 호버 시 상세 설명 툴팁
- 클릭 시 즉시 적용 + 슬로우 모션 해제
- 선택 전까지는 슬로우 모션 유지 (시간은 계속 흐름)

**3개 카테고리 색상 구분**:
- 투사체 강화: 빨강 테두리
- 생존 강화: 파랑 테두리
- 솔리테어 보조: 초록 테두리

## 게임 오버 / 승리 UI

### 게임 오버 (HP 0)

```
┌─────────────────────────────────────────┐
│                                         │
│            💀 GAME OVER 💀               │
│                                         │
│        Survived: 5:32 (Wave 5)         │
│        Score: 12,450                    │
│        Rank: B                          │
│                                         │
│  Foundation Progress:                   │
│    ♠️ Tier 7  ♥️ Tier 5                 │
│    ♦️ Tier 3  ♣️ Tier 9                 │
│                                         │
│  Achievements:                          │
│    • Chain Burst x4                     │
│    • Combo Max x12                      │
│                                         │
│   [다시 하기]      [메뉴로]             │
│                                         │
└─────────────────────────────────────────┘
```

### 승리 (10분 생존)

```
┌─────────────────────────────────────────┐
│                                         │
│           🎉 VICTORY! 🎉                 │
│                                         │
│     You survived all 10 waves!         │
│        Final Score: 45,320              │
│        Rank: S                          │
│                                         │
│  Foundation Completion:                 │
│    ♠️ FULL (K)  ♥️ FULL (K)            │
│    ♦️ Tier 11   ♣️ FULL (K)            │
│                                         │
│  Solitaire: COMPLETED ✓                │
│  (All 52 cards in Foundation)           │
│                                         │
│  Achievements:                          │
│    • Perfect Run                        │
│    • Chain Burst x15                    │
│    • Combo Max x23                      │
│                                         │
│   [다시 하기]      [메뉴로]             │
│                                         │
└─────────────────────────────────────────┘
```

**점수 등급**:
- S: 40,000+
- A: 30,000+
- B: 20,000+
- C: 10,000+
- D: 10,000 미만

**특수 뱃지**:
- "Perfect Run": HP 손실 없이 클리어
- "Solitaire Master": 52장 모두 Foundation 완성
- "Chain King": Chain Burst 10회 이상

## 반응형 레이아웃

### Desktop (1024px+)
- 위 레이아웃 그대로
- 솔리테어 카드 크기: 기존 Solitary와 동일
- 전투 뷰 해상도: 최대화

### Tablet (768-1023px)
- 동일 구조 유지
- 카드 크기: 80% 축소
- 전투 뷰 적 수: 동일 (밀도만 조정)
- HUD 폰트 크기: 90%

### Mobile (< 768px)
- **Phase 전환 방식**: 스와이프로 전투 뷰 <-> 솔리테어 뷰 전환
- 기본 뷰: 전투 뷰 (생존이 우선)
- 하단에 "⬆️ 솔리테어" 버튼 (스와이프 업 힌트)
- 솔리테어 뷰로 전환 시:
  - 전투 뷰는 작은 미니맵(20% 높이)으로 축소
  - 솔리테어는 전체 화면(80%)으로 확장
- 체인 게이지 + 야생카드 슬롯은 하단 오버레이로 고정

**모바일 최적화**:
- 카드 터치 영역 확대 (+20% 패딩)
- 드래그 앤 드롭 대신 탭-탭 방식 선택 가능
- 투사체 수 표시는 숫자만 (아이콘 축소)

## 기존 코드베이스 통합

### 프로젝트 구조 참조

```
web/src/
  app/           # Next.js 라우트
  components/    # React UI
  hooks/         # React 훅
  game/
    bridge/      # GameBridge (React <-> Phaser)
    scenes/      # Phaser 씬
    objects/     # 게임 오브젝트
    rendering/   # 렌더링 유틸
    defense/     # 디펜스 모드 (기존)
    survivors/   # 서바이버 모드 (신규)
    config.ts
  solver/        # 솔리테어 로직
```

### 완전 재사용 (수정 없음)

| 모듈 | 파일 | 용도 |
|------|------|------|
| **Card/Suit/Rank 타입** | `solver/types.ts` | 카드 타입 정의 |
| **Deck** | `solver/Deck.ts` | 시드 기반 덱 생성 (Mulberry32) |
| **SolitaireState** | `solver/SolitaireState.ts` | Klondike 게임 로직 + 이동 생성 |
| **CardSprite** | `game/objects/CardSprite.ts` | 카드 스프라이트 렌더링 |
| **CardRenderer** | `game/rendering/CardRenderer.ts` | 카드 텍스처 생성 |
| **LayoutManager** | `game/rendering/LayoutManager.ts` | 솔리테어 레이아웃 계산 |
| **AnimationManager** | `game/rendering/AnimationManager.ts` | 카드 이동 애니메이션 |

**재사용 방식**:
- SolitaireState를 그대로 사용하되, Foundation 적재 이벤트를 **외부에서 후킹**
- 솔리테어 렌더링 레이어는 100% 동일

### 확장 재사용 (인터페이스 확장)

| 모듈 | 파일 | 확장 내용 |
|------|------|----------|
| **GameBridge** | `game/bridge/GameBridge.ts` | Survivors 전용 콜백 추가 |

**GameBridge 확장 예시**:
```typescript
// 추가될 콜백
interface SurvivorsBridgeCallbacks {
  onCardToFoundation?: (card: Card, suit: Suit) => void;
  onTableauMove?: (move: Move) => void;
  onWildCardUsed?: (cardType: WildCardType) => void;
  onWaveCleared?: (waveNumber: number) => void;
}
```

기존 Defense 모드와 동일한 **직접 콜백 패턴** 사용. React strict mode double-mount 대응을 위해 cleanup 시 콜백 해제.

### 부분 재사용 (Defense 모드에서)

| 모듈 | 파일 | 재사용 방식 |
|------|------|----------|
| **EnemyType** | `game/defense/constants.ts` | 적 타입 정의 차용 (속성만 변경) |
| **GRADE_MULTIPLIER** | `game/defense/constants.ts` | 점수 배율 공식 |
| **SCORE_*** | `game/defense/constants.ts` | 점수 체계 기반 |
| **WaveController 패턴** | `game/defense/WaveController.ts` | 웨이브 관리 구조 참고 |

**차이점**:
- Defense: 1D 레인, 턴제, 유닛 소환
- Survivors: 2D 아레나, 실시간, 투사체 발사

공통점은 "웨이브 진행 + 적 스폰 관리"이므로 WaveController의 **구조만 차용**.

### 신규 구현 필요

| 모듈 | 파일 | 설명 |
|------|------|------|
| **SurvivorsScene** | `game/survivors/SurvivorsScene.ts` | 메인 Phaser 씬 (상단 전투 + 하단 솔리테어) |
| **SurvivorsBattleEngine** | `game/survivors/SurvivorsBattleEngine.ts` | 2D 전투 계산 (적 이동, 투사체 발사, 충돌, 데미지) |
| **ProjectileSystem** | `game/survivors/ProjectileSystem.ts` | 투사체 매니저 (Suit별 발사, 풀링, 타겟팅) |
| **WildCardManager** | `game/survivors/WildCardManager.ts` | 야생카드 드랍/보관/사용 |
| **ChainGaugeSystem** | `game/survivors/ChainGaugeSystem.ts` | 체인 게이지 충전/버스트 |
| **LevelUpSystem** | `game/survivors/LevelUpSystem.ts` | 경험치 + 레벨업 선택지 |
| **ComboTimerSystem** | `game/survivors/ComboTimerSystem.ts` | 콤보 타이머 + 배율 계산 |
| **WeaknessSystem** | `game/survivors/WeaknessSystem.ts` | 적 약점 부여/표시/데미지 계산 |
| **PlayerCharacter** | `game/survivors/PlayerCharacter.ts` | 플레이어 캐릭터 (중앙 고정, HP, 넉백) |
| **EnemySprite** | `game/survivors/EnemySprite.ts` | 적 스프라이트 (2D 이동, 약점 아이콘) |
| **ProjectileSprite** | `game/survivors/ProjectileSprite.ts` | 투사체 스프라이트 (Suit별 비주얼) |
| **BarrierZoneRenderer** | `game/survivors/BarrierZoneRenderer.ts` | 결계 영역 렌더링 (빈 열) |
| **SurvivorsState** | `game/survivors/SurvivorsState.ts` | 서바이버 게임 상태 (HP, 경험치, 레벨, 점수) |
| **SurvivorsControls** | `components/SurvivorsControls.tsx` | 서바이버 UI 컴포넌트 (React) |
| **useSurvivorsGame** | `hooks/useSurvivorsGame.ts` | 서바이버 게임 React 훅 |
| **SurvivorsPage** | `app/survivors/page.tsx` | 서바이버 모드 라우트 |

### Scene 분리 및 라우팅

**기존**:
- `/` → 메인 메뉴
- `/play` → PlayScene (Classic 솔리테어)
- `/simulate` → PlayScene (AI 시뮬레이션)
- `/defense` → DefenseScene (디펜스 모드)

**추가**:
- `/survivors` → SurvivorsScene (서바이버 모드)

**Scene 구조**:
```
TableScene (Classic)
  └─> 솔리테어만

DefenseScene (Defense)
  └─> 솔리테어 (상단 60%)
  └─> 디펜스 레인 (하단 30%)
  └─> 턴제 3단계

SurvivorsScene (Survivors)
  └─> 전투 뷰 (상단 55%)
  └─> 솔리테어 (하단 35%)
  └─> 실시간 동시 진행
```

3개 Scene은 완전 독립적으로, 동시 활성화되지 않음.

## SolitaireState 래핑

기존 SolitaireState는 수정하지 않고, **이벤트 리스너 래퍼**로 감싼다.

```typescript
class SurvivorsSolitaireWrapper {
  private state: SolitaireState;
  private listeners: {
    onFoundation?: (card: Card, suit: Suit) => void;
    onTableauMove?: (move: Move) => void;
    onFaceDownFlip?: (card: Card) => void;
  };

  applyMove(move: Move): void {
    const beforeFoundation = this.getFoundationTops();

    this.state.applyMove(move);

    const afterFoundation = this.getFoundationTops();

    // Foundation 변화 감지
    if (this.hasFoundationChanged(beforeFoundation, afterFoundation)) {
      const { card, suit } = this.getNewFoundationCard(...);
      this.listeners.onFoundation?.(card, suit);
    }

    // Tableau 이동 감지
    if (move.actionType === ActionType.TABLEAU_TO_TABLEAU) {
      this.listeners.onTableauMove?.(move);
    }
  }
}
```

이를 통해 SolitaireState의 로직은 일체 변경하지 않으면서, Foundation 적재 / Tableau 이동 등의 이벤트를 전투 시스템에 전달한다.

## 실시간 상태 동기화

### React <-> Phaser 양방향 통신

```
React (UI)
  └─> GameBridge
       └─> SurvivorsScene (Phaser)
            ├─> SolitaireWrapper (하단)
            │    └─> onFoundation → ProjectileSystem
            │    └─> onTableauMove → ChainGaugeSystem
            │
            └─> BattleEngine (상단)
                 └─> onEnemyKilled → WildCardManager
                 └─> onPlayerHit → React (HP 업데이트)
```

**이벤트 흐름**:
1. 플레이어가 카드 이동 → SolitaireWrapper.applyMove()
2. Foundation 적재 감지 → onFoundation 콜백
3. ProjectileSystem이 투사체 발사
4. 적 처치 → onEnemyKilled 콜백
5. WildCardManager가 야생카드 드랍 판정
6. React UI 업데이트 (야생카드 슬롯 표시)

### 상태 직렬화 (Save/Load 대비)

SurvivorsState는 JSON 직렬화 가능해야 한다:

```typescript
interface SurvivorsState {
  // 솔리테어 상태
  solitaireState: SerializedSolitaireState;

  // 전투 상태
  playerHP: number;
  playerMaxHP: number;
  currentWave: number;
  elapsedTime: number;
  score: number;

  // 진행도
  level: number;
  experience: number;
  foundationTiers: { [suit: string]: number };

  // 수집 상태
  wildCards: WildCardType[];
  chainGauge: number;

  // 레벨업 효과
  upgrades: UpgradeEffect[];
}
```

## 성능 고려사항

### 렌더링 최적화

**목표**: 60fps 유지

**전투 뷰**:
- 적 수 상한: 동시 최대 30마리
- 투사체 풀링: Suit별 20발 재사용
- 파티클 시스템: Phaser Emitter 사용 (GPU 가속)

**솔리테어 뷰**:
- 기존 CardSprite 재사용 (검증된 성능)
- 애니메이션은 기존 AnimationManager와 동일

### 메모리 관리

- 적/투사체 오브젝트 풀링 (생성/파괴 최소화)
- 텍스처 아틀라스 사용 (스프라이트 시트)
- 사용하지 않는 파티클 이미터 즉시 파괴

### 복잡도 제한

- 전투 계산: 메인 스레드 (복잡도 낮음, O(n) 수준)
- Solver: Web Worker (기존과 동일, Hint 기능 제공)
- 레벨업 선택 시 슬로우 모션으로 부하 분산

## UI/UX 원칙

### 1. 정보 계층 (Information Hierarchy)

**1순위**: 생존 관련 (HP, 적 위치, 투사체)
**2순위**: 전략 관련 (Foundation Tier, 체인 게이지, 야생카드)
**3순위**: 부가 정보 (점수, 시간, 웨이브)

### 2. 시각적 피드백 (Visual Feedback)

모든 플레이어 액션에 즉각적인 시각 피드백:
- Foundation 적재 → 투사체 발사 (0.1초 이내)
- Tableau 이동 → 체인 게이지 상승 (즉시)
- 적 처치 → 점수 팝업 + 드랍 (즉시)

### 3. 색상 일관성 (Color Consistency)

**Suit 색상 통일**:
- Spade: 보라 (#9B59B6)
- Heart: 빨강 (#E74C3C)
- Diamond: 파랑 (#3498DB)
- Club: 초록 (#2ECC71)

상단 투사체 색상 = 하단 Foundation Suit 색상 = 중간 바 아이콘 색상

### 4. 접근성 (Accessibility)

- 색맹 모드: Suit 심볼 + 색상 동시 표시
- 큰 글씨 모드: HUD 폰트 120% 확대
- 고대비 모드: 배경/전경 명도 차이 확대

## 메뉴 통합

### 메인 메뉴 (/)

```
┌─────────────────────────────────────┐
│                                     │
│        SOLITAIRE HUNTER             │
│                                     │
│   [Classic Solitaire]               │
│   > 전통 클론다이크 솔리테어          │
│                                     │
│   [Defense Mode] 🆕                 │
│   > 타워 디펜스 + 솔리테어            │
│                                     │
│   [Survivors Mode] 🆕               │
│   > 뱀파이어 서바이벌 + 솔리테어       │
│                                     │
│   [Simulate]                        │
│   > AI 자동 플레이                   │
│                                     │
└─────────────────────────────────────┘
```

### 모드 선택 설명

**Defense**:
- "Turn-based strategy"
- "Summon units from cards"
- "Defend 10 waves"

**Survivors**:
- "Real-time action"
- "Auto-attacking projectiles"
- "Survive 10 minutes"

## 기술적 제약 사항

1. **Phaser Scene 분리**: SurvivorsScene은 기존 TableScene, DefenseScene과 완전 독립
2. **State 직렬화**: SurvivorsState는 JSON 직렬화 가능 (Save/Load 대비)
3. **성능**: 전투 애니메이션 60fps 유지, 적+투사체 합계 50체 이내
4. **Web Worker**: 전투 계산은 메인 스레드 (단순), Solver만 Worker
5. **모바일 지원**: 터치 최적화, 스와이프 전환, 오버레이 UI

## 구현 우선순위

### Phase 1: 핵심 루프 (MVP)
1. SurvivorsScene 골격 (상하 분할 레이아웃)
2. SolitaireWrapper + Foundation 이벤트 후킹
3. ProjectileSystem (기본 발사)
4. BattleEngine (2D 적 이동 + 충돌)
5. 기본 HUD (HP, 시간, 점수)

### Phase 2: 전투 시스템
1. Suit별 투사체 타입 구현
2. 적 약점 시스템
3. 투사체 Tier 스케일링
4. Full Suit 궁극기

### Phase 3: 피드백 루프
1. 야생카드 드랍 + UI
2. 체인 게이지 시스템
3. 콤보 타이머
4. 결계 존

### Phase 4: 진행도 시스템
1. 레벨업 + 선택지 UI
2. 웨이브 클리어 보상
3. 듀얼 콤보
4. 게임 오버/승리 화면

### Phase 5: 폴리시
1. 파티클 이펙트
2. 사운드 이펙트
3. 모바일 최적화
4. 접근성 옵션

## 요약

**핵심 원칙**:
1. **Klondike 규칙 100% 보존** → 기존 SolitaireState 완전 재사용
2. **실시간 동시 진행** → 상단 전투 + 하단 솔리테어 독립 렌더링
3. **양방향 긍정 피드백** → 솔→전(투사체), 전→솔(야생카드)
4. **명확한 시각 연결** → Suit 색상 통일, 즉각적 피드백

**기존 코드 활용**:
- 솔리테어 레이어: 100% 재사용
- Defense 패턴: 구조 참고 (WaveController, 점수 체계)
- 신규 구현: 2D 전투 엔진, 투사체 시스템, 레벨업 시스템

**차별점**:
- Defense: 턴제, 유닛 소환, 1D 레인
- Survivors: 실시간, 투사체 강화, 2D 아레나
