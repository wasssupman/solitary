---
name: generate-prd
description: GDD(Game Design Document)를 기반으로 신규 게임 모드의 PRD(Product Requirements Document)를 생성한다. PRD 생성, 제품 요구사항 문서, product requirements 요청 시 트리거.
---

# PRD 생성 스킬 — 신규 게임 모드

기존 Solitary 프로젝트의 코어 솔리테어 위에 추가되는 **신규 게임 모드**에 대한 PRD을 GDD로부터 생성한다.

## 범위

- 신규 프로젝트가 아닌 **기존 코드베이스 위의 새 게임 모드**
- 기존 Phaser 씬, GameBridge, SolitaireCore 패턴을 기반으로 확장
- 솔리테어 코어 게임을 참조하고 신규 모드에 필요한 기능을 정의

## 입력

- GDD 문서 경로: `web/docs/gdd/{keyword}/` 내 모든 `.md` 파일
- 키워드(slug): 출력 디렉토리명으로 사용

## 출력

- `web/docs/prd/{keyword}/prd.md`

## PRD 섹션 구조

상세 작성 가이드는 `references/prd-template.md` 참조.

### 1. Executive Summary
- 게임 모드 명칭, 장르 태그
- 코어 솔리테어 대비 핵심 차별점 1-3개
- 모드 컨셉 요약 (2-3문장)

### 2. Mode Vision & Goals
- 이 게임 모드가 프로젝트에 추가하는 가치
- 성공 기준 (기존 DAU 대비 세션 증가, 모드 전환율 등)

### 3. Target Players & Personas
- GDD 타겟 플레이어 기반 페르소나 2-3개
- 기존 솔리테어 유저 vs 신규 유입 유저 비중

### 4. Core Loop & Session Design
- GDD 페이즈 구조 기반 핵심 루프 다이어그램
- 기존 솔리테어 루프와의 관계 (공유/분기점)
- 세션 길이, FTUE, 리텐션 루프

### 5. Shared Infrastructure
- 기존 코드베이스에서 재사용하는 요소 목록
  - GameBridge, CardSprite, LayoutManager, CardRenderer 등
- 솔리테어 코어 게임 참조 방식 (규칙 재사용 vs 변형)

### 6. Feature Requirements (MoSCoW)
- **Must/Should/Could/Won't**, 각 항목에 GDD 출처 태그
- 기존 기능 재사용 vs 신규 구현 명시
- Acceptance criteria

### 7. Monetization Impact
- 기존 수익 모델에 미치는 영향
- 모드별 추가 수익 기회 (있을 경우)

### 8. KPI Framework
- 모드 진입률, 모드별 세션 길이, 모드 전환율
- 기존 KPI에 대한 영향 (카니발리제이션 vs 시너지)

### 9. Competitive Reference
- 유사 게임 모드를 제공하는 경쟁작 2-3개
- 차별점 요약

### 10. Release Plan
- 기존 프로젝트 릴리즈 사이클 내 통합 계획
- Alpha → Beta → Launch 단계별 목표

### 11. Risks & Mitigations
- 기존 모드와의 충돌, 코드 복잡도 증가
- 유저 분산 리스크

### 12. Appendix
- GDD 교차참조 테이블 (PRD 섹션 ↔ GDD 문서)
- 용어집

## 작성 규칙

1. GDD에 명시된 내용은 충실히 반영, 없는 내용은 `[ASSUMPTION]` 태그
2. 미결정 사항은 `[TBD]` 태그로 명시
3. 모든 Feature Requirement에 GDD 출처 추적 태그 포함 (예: `[GDD: 01-phase-loop]`)
4. GDD가 한국어인 경우 PRD는 영문으로 작성
5. 기존 코드베이스 재사용 항목은 실제 파일/클래스명으로 참조
6. Mermaid 다이어그램 적극 활용 (Core Loop, Release Timeline)
