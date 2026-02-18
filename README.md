Solitaire — AI 솔버 기반 클론다이크 솔리테어

## 1. 프로젝트 개요
* **프로젝트명**: Solitary
* **핵심 기능**: 
NRPA 알고리즘 기반 AI 솔버를 탑재한 클론다이크 솔리테어 웹 게임. 
챗봇을 활용하여 신규 모드 생성, 게임 플레이 리팩토링 원격으로 진행.
* **기술 스택**: Next.js 16, React 19, Phaser 3, TypeScript, Tailwind CSS 4, Web Worker
* **배포 주소**: [solitaire-hunter.vercel.app](https://solitaire-hunter.vercel.app)

---

## 2. 개발 방법론: 100% AI 오케스트레이션 (Vibe Coding)
이 프로젝트는 **프롬프트 문서와 에이전트 워크플로우를 통한 '바이브 코딩(Vibe Coding)'으로 개발**되었습니다.

* **개발 환경**: Claude Code + oh-my-claudecode (OMC)
* **기획 프로세스**: 커스텀 에이전트 5종(game-design-orchestrator, classic-rule-agent, creative-rule-agent, doc-agent, game-mode-creator)으로 구성된 **Game Design Orchestrator** 시스템 구축.
    * 에이전트 간 3라운드 토론 및 비판 프로토콜을 통해 기획안(GDD) 도출.
    * 도출된 기획을 바탕으로 Doc Agent가 PRD 및 TRD를 자동 생성하여 구현 가이드 마련.
* **구현 방식**: 생성된 기술 설계 문서(TRD)와 기존 코드베이스의 인터페이스를 에이전트가 참조하여 기능 단위별 코드를 생성하고 통합을 수행함.

---

## 3. 핵심 기술 구현

### AI 솔버 알고리즘 (NRPA)
논문 "Searching Solitaire in Real Time"의 **Nested Rollout Policy Adaptation** 알고리즘을 TypeScript로 구현했습니다.

* **중첩 탐색 및 이중 휴리스틱**: H1(파운데이션 적재 우선)과 H2(탈론 접근성 및 다양성 확보) 휴리스틱을 단계별로 교차 적용하여 최적해 탐색.
* **K+ 매크로 액션**: 스톡과 웨이스트 조작을 하나의 논리적 단위로 묶어 최대 60턴을 선행 시뮬레이션함으로써 도달 가능한 모든 카드를 탐색 후보에 포함.
* **성능 최적화**: Web Worker 연산 분리로 메인 스레드 점유 방지, FNV-1a 해시 기반 루프 탐지 및 역방향 수 필터링 적용.

### 벤치마크 결과
| 비교 항목 | 기존 논문 (C++) | 본 프로젝트 (TS) | 비고 |
| :--- | :--- | :--- | :--- |
| **승률** | 74.94% | **74%** | 동일 수준 도달 |
| **시간 제한** | 60초 | **2초** | 30배 빠른 연산 효율 확보 |

---

## 4. 소프트웨어 아키텍처

코어 로직과 프레젠테이션 레이어를 엄격히 분리하여 알고리즘의 독립성과 게임 모드 확장성을 확보했습니다.

* **Solver Core (Pure Logic)**: 의존성이 없는 순수 알고리즘 레이어. Web Worker, Node.js 등 다양한 환경에서 독립 실행 가능.
* **Game Core (Domain Layer)**: 게임의 규칙, 수 실행(Move Execution), Undo/Redo를 담당하는 엔진 레이어.
* **GameBridge**: React 19와 Phaser 3 사이의 싱글턴 이벤트 버스. Strict Mode의 더블 마운트 이슈를 해결하기 위한 직접 콜백 바인딩 패턴 적용.

---

## 5. 확장 모드 (Game Modes)
코어 로직의 분리 덕분에 동일한 엔진 위에서 서로 다른 룰과 시각 요소를 결합한 다양한 모드를 제공합니다.

| 모드 | 경로 | 주요 특징 |
| :--- | :--- | :--- |
| **Play** | `/play` | 클래식 클론다이크 룰, AI 힌트 및 드래그 앤 드롭 지원 |
| **Defense** | `/defense` | 솔리테어와 타워 디펜스(Paladog 스타일)의 메카닉 매쉬업 |
| **Survivors** | `/survivors` | 뱀파이어 서바이벌 + 솔리테어. 실시간 아레나에서 적을 처치하며 카드 플레이 |
| **Simulate** | `/simulate` | AI 솔버의 자동 플레이 시각화 및 실시간 승률 측정 |
| **Replay** | `/replay` | 저장된 게임 로그를 기반으로 한 프레임 단위 재생 기능 |

---

## 6. AI 에이전트 파이프라인

챗봇에서 프롬프트를 입력하면, 5종의 AI 에이전트가 순차적으로 협업하여 **기획 → 문서화 → 검증 → 구현 → 빌드**까지 자동으로 수행합니다.

### 파이프라인 흐름

```
사용자 프롬프트
  │
  ▼
┌─────────────────────────────┐
│  Stage 1: Game Design (GDD) │
│  game-design-orchestrator   │
│  ├─ classic-rule-agent      │
│  └─ creative-rule-agent     │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Stage 2: Documentation     │
│  doc-agent                  │
│  ├─ PRD (제품 요구사항)       │
│  └─ TRD (기술 요구사항)       │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Stage 3: Review & Implement│
│  game-mode-creator          │
│  ├─ 제약 검토 루프 (최대 3회) │
│  ├─ 코드 구현                │
│  └─ 빌드 검증                │
└─────────────┬───────────────┘
              ▼
        자동 커밋 & 배포
```

### 에이전트 소개

| 에이전트 | 역할 |
| :--- | :--- |
| **game-design-orchestrator** | Classic과 Creative 에이전트 간 3라운드 토론을 중재하여 통합 기획안(GDD) 도출 |
| **classic-rule-agent** | 검증된 클론다이크 메카닉을 보호하는 보수적 비평가. "이게 정말 게임을 더 재미있게 만드는가?" |
| **creative-rule-agent** | 기존 공식에 도전하는 혁신적 디자이너. "이미 있는 게임을 왜 만드는가?" |
| **doc-agent** | GDD 기반으로 PRD(제품 요구사항)와 TRD(기술 요구사항)를 자동 생성 |
| **game-mode-creator** | 문서를 제약 사항 체크리스트에 대조 검증한 뒤, TRD 기반으로 코드 구현 및 빌드 검증 수행 |

### 스킬 & 제약 사항

| 스킬 | 용도 |
| :--- | :--- |
| **game-mode-constraint** | 모드 생성 시 반드시 준수해야 할 5가지 제약 사항 (라우트, 코어 불변, 스코어링, 코드 격리, 뷰 비율) |
| **generate-prd** | GDD → PRD 변환 템플릿 (12개 섹션) |
| **generate-trd** | GDD + PRD → TRD 변환 템플릿 (16개 섹션) |
| **solver-benchmark** | NRPA 솔버 벤치마크 실행 및 리포트 생성 |

---

## 7. Game Agent 챗봇

웹 UI 우측 하단의 플로팅 챗봇을 통해 에이전트 파이프라인을 직접 트리거할 수 있습니다.

### 지원 명령어

| 명령어 | 동작 | 예시 |
| :--- | :--- | :--- |
| `모드! <설명>` | 새로운 게임 모드 생성 | `모드! 솔리테어 + 타이머 스피드런` |
| `개선! <설명>` | 기존 모드 버그 수정/개선 | `개선! 디펜스 모드 밸런스 조정` |

### 동작 방식

1. 사용자가 명령어 입력 → 프리픽스(`모드!`/`개선!`) 파싱
2. 해당 GitHub Actions 워크플로우에 `workflow_dispatch` 전송
3. 10초 간격 폴링으로 워크플로우 진행 상태 모니터링
4. 완료 시 결과(성공/실패) 및 GitHub Actions 링크 표시

### GitHub Actions 워크플로우

| 워크플로우 | 트리거 | 용도 | 제한 시간 |
| :--- | :--- | :--- | :--- |
| `agent-create-mode.yml` | `workflow_dispatch` (챗봇 `모드!`) | 3단계 파이프라인으로 새 게임 모드 생성 | 45분 |
| `agent-improve-mode.yml` | `workflow_dispatch` (챗봇 `개선!`) | 기존 모드 최소 변경으로 수정/개선 | 30분 |

#### 워크플로우 실행 과정

```
챗봇 → API Route → GitHub Actions workflow_dispatch
                         │
                         ▼
                  Checkout + Node.js + npm ci
                         │
                         ▼
                  Claude Code CLI 설치
                         │
                         ▼
                  claude -p (에이전트 프롬프트 실행)
                         │
                         ▼
                  npm run build (빌드 검증)
                         │
                         ▼
                  git commit & push → Vercel 자동 배포
```

---
