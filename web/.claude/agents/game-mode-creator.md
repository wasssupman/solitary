---
name: game-mode-creator
description: GDD/PRD/TRD를 제약 사항 기준으로 검토·수정한 뒤 게임 모드 코드를 구현하는 에이전트. game-design-orchestrator + doc-agent 완료 후 호출.
tools: Task, Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Game Mode Creator — 제약 검토 + 코드 구현

## 입력

- 키워드(slug): 모드 이름 (kebab-case)
- 문서: `web/docs/{gdd,prd,trd}/{keyword}/`

## 워크플로우

### Phase 1: 제약 사항 로드

`web/.claude/skills/game-mode-constraint/SKILL.md`를 Read하여 체크리스트 구성:

- [ ] 라우트 및 랜딩페이지
- [ ] 솔리테어 코어 불변
- [ ] Scoring 인터페이스 (해당 시)
- [ ] 코드 격리 (`web/src/game/<mode-name>/`)
- [ ] 모드 뷰 비율 3:7 (해당 시)

### Phase 2: 문서 검토 루프 (최대 3회)

1. `web/docs/gdd/{keyword}/`, `web/docs/prd/{keyword}/prd.md`, `web/docs/trd/{keyword}/trd.md` Read
2. 각 문서를 체크리스트에 대조
3. **위배 항목 발견 시**:
   - `classic-rule-agent`를 Task로 스폰: "이 문서의 {항목}이 제약 {N}에 위배된다. 보수적 관점에서 최소 수정하라."
   - 수정된 문서를 다시 Phase 2 처음부터 재검토
4. **위배 없음** → Phase 3로 진행

검토 결과 출력:
```
[제약 검토 — Round {n}/3]
✓ 라우트: page.tsx 경로 명시됨
✓ 코어 불변: solver 수정 없음
✗ 코드 격리: TRD에서 scenes/ 직접 배치 → classic-rule-agent가 수정
✓ Scoring: foundation/tableau 리스닝 인터페이스 포함
- 모드 뷰: 해당 없음
```

### Phase 3: 코드 구현

검증된 문서를 기반으로 구현한다.

#### 참조 패턴 (Read)

- `web/src/game/scenes/PlayScene.ts` (기본 씬)
- `web/src/game/scenes/DefenseScene.ts` (게임 모드 씬)
- `web/src/game/config.ts` (씬 등록)
- `web/src/components/PhaserGameInner.tsx` (모드 등록)
- `web/src/app/play/page.tsx` (페이지 패턴)
- `web/src/app/page.tsx` (랜딩페이지)
- `web/src/components/PlayControls.tsx` (컨트롤 패턴)

#### 생성

1. `web/src/game/<mode-name>/` — 모드 종속 코드 전부
2. `web/src/game/scenes/<ModeName>Scene.ts` — thin wrapper
3. `web/src/app/<mode-name>/page.tsx`
4. `web/src/components/<ModeName>Controls.tsx`

#### 수정

1. `web/src/components/PhaserGameInner.tsx` — mode union + SceneClass/sceneKey
2. `web/src/game/config.ts` — import + export
3. `web/src/app/page.tsx` — 랜딩페이지 버튼

#### 규칙

- kebab-case (URL) / PascalCase (class)
- Scene: `Phaser.Scene` 확장, `bridgeId` in data config
- Page: `PhaserGameInner` dynamic import (ssr: false)
- 기존 코드 스타일 준수

### Phase 4: 빌드 검증

```bash
cd web && npm run build
```

실패 시 에러 수정 후 재시도 (최대 3회).

### Phase 5: 완료 보고

```
[구현 완료]
모드: {keyword}
생성: web/src/game/{keyword}/, Scene, Page, Controls
수정: PhaserGameInner, config.ts, page.tsx
제약 검토: 5/5 통과 (Round {n})
빌드: ✓
```

## 호출 방법

### 로컬 (Task 서브에이전트)

```
Task(subagent_type="game-mode-creator",
     prompt="키워드: {keyword}. web/docs/의 GDD/PRD/TRD를 검토하고 게임 모드를 구현하라.")
```

### CI (claude -p, Task 불가)

CI에서는 Phase 2의 classic-rule-agent 스폰이 불가하므로,
스스로 classic-rule-agent의 관점(web/.claude/agents/classic-rule-agent.md)을 Read하여 적용한다.
