---
name: generate-trd
description: GDD와 PRD를 기반으로 신규 게임 모드의 TRD(Technical Requirements Document)를 생성한다. TRD 생성, 기술 요구사항 문서, technical requirements 요청 시 트리거.
---

# TRD 생성 스킬 — 신규 게임 모드

기존 Solitary 코드베이스 위에 추가되는 **신규 게임 모드**의 기술 요구사항을 정의한다.
새 Phaser 씬을 생성하고, 솔리테어 코어를 참조하며, 필요한 이벤트/컴포넌트를 확장하는 데 초점을 맞춘다.

## 범위

- 새로운 Phaser Scene 클래스 생성 (PlayScene/SimulateScene 패턴 참조)
- 기존 GameBridge 이벤트 확장
- SolitaireCore 참조 또는 래핑을 통한 게임 로직 구성
- 기존 CardSprite, CardRenderer, LayoutManager 등 재사용

## 입력

- GDD 문서 경로: `web/docs/gdd/{keyword}/` 내 모든 `.md` 파일
- PRD 문서 경로: `web/docs/prd/{keyword}/prd.md`
- 키워드(slug): 출력 디렉토리명으로 사용

## 출력

- `web/docs/trd/{keyword}/trd.md`

## TRD 섹션 구조

상세 작성 가이드는 `references/trd-template.md` 참조.

### 1. Technical Overview
- 시스템 요약: 신규 씬, 확장 컴포넌트, 신규 컴포넌트 리스트
- 아키텍처 원칙: 기존 패턴 준수 (GameBridge, Core/Scene 분리)
- 기술 제약: 브라우저 환경, Phaser 3, TypeScript

### 2. Scene Architecture
- 신규 Scene 클래스 설계 (PlayScene 패턴 기반)
- Scene lifecycle: `preload → create → update` 흐름
- 기존 씬과의 전환 방식 (Phaser SceneManager)
- 라우팅: Next.js route 추가 (`/play/{mode}` 또는 `/mode/{keyword}`)

### 3. Game State & Core Logic
- 신규 게임 상태 스키마 (TypeScript interface)
- 기존 SolitaireState 참조 방식 (상속 / 조합 / 독립)
- 상태 전이 다이어그램 (Mermaid state machine)
- Undo 전략 (기존 SolitaireCore 패턴 재사용)

### 4. GameBridge Event Extensions
- 기존 이벤트 중 재사용 가능한 것
  - `stateChanged`, `gameWon`, `undo`, `newGame` 등
- 신규 이벤트 정의
  - 이벤트명, payload 타입, emit 위치, 소비 위치
- 콜백 확장 (bridgeId 기반 다중 인스턴스)

### 5. Rendering & Layout
- 새 LayoutManager 설정 (카드 배치, 추가 UI 요소 위치)
- 기존 CardRenderer 재사용 (동일 텍스처)
- 추가 게임 오브젝트 (신규 PileZone, 보드 요소 등)
- 레이어/뎁스 전략

### 6. Interaction Design
- InteractionController 확장 또는 신규 작성
- 새로운 드래그/드롭 타겟
- 새로운 클릭/탭 인터랙션
- DropTargetResolver 확장

### 7. Entity & Component Design
- 신규 게임 오브젝트 (CardSprite 확장, 새 엔티티)
- 기존 SpriteManager 확장 방안
- 컴포넌트 구성과 소유권

### 8. AI & Solver Adaptation
- 기존 NestedRolloutSolver 활용 가능 여부
- 신규 Evaluator 필요 시 heuristic 설계
- Hint 시스템 적용 방안
- Worker 프로토콜 확장 (신규 state 직렬화)

### 9. Animation & Effects
- 기존 CardMovementRunner 재사용
- 신규 애니메이션 (모드 전용 이펙트)
- 승리/패배 연출

### 10. Audio Design
- 사운드 카테고리 (SFX, BGM)
- 모드별 BGM 전환
- 기존 오디오 시스템 확장

### 11. React Integration
- 신규 React 컴포넌트 (Controls, HUD)
- 신규 Hook 또는 기존 hook 확장 (`useGameState`, `useSolver`)
- 라우트/페이지 컴포넌트

### 12. Performance Budget
- 기존 코어 게임에 미치는 영향 없을 것
- 신규 씬 메모리/CPU 예산
- 번들 사이즈 증가 허용치

### 13. Analytics & Events
- 신규 이벤트 분류 (모드 진입, 라운드 완료, 승/패 등)
- 기존 이벤트와의 구분 (event prefix 또는 property)

### 14. Testing Strategy
- 신규 Core Logic 단위 테스트
- 씬 통합 테스트
- 기존 코어 솔리테어 회귀 테스트

### 15. File Structure
- 신규/수정 파일 목록과 위치
- 디렉토리 구조 제안

### 16. Appendix
- GDD/PRD 교차참조
- 기술 결정 기록 (ADR)

## 작성 규칙

1. 모든 컴포넌트 참조 시 실제 파일 경로와 클래스명 사용
2. 기존 코드 패턴(GameBridge, Core/Scene 분리, callback 방식)을 준수
3. 신규 이벤트는 TypeScript 타입 정의 포함
4. 상태 머신은 Mermaid stateDiagram 사용
5. GDD가 한국어인 경우 TRD는 영문으로 작성
6. `[ASSUMPTION]`, `[TBD]` 태그로 가정과 미결정 사항 명시
7. PRD의 Feature Requirements와 1:1 매핑 가능하도록 작성
