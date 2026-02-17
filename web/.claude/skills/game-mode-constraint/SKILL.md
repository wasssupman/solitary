---
name: game-mode-constraint
description: 솔리테어 + @ 게임 모드 생성/개선 시 반드시 지켜야 하는 제약 사항. 게임 모드, 모드 생성, 모드 개선, game mode 요청 시 트리거.
---

# 게임 모드 제약 사항

솔리테어 + @ 의 게임 모드를 생성하거나 개선할 때 반드시 지켜야 하는 제약 사항이다.

## 1. 라우트 및 랜딩페이지

- `web/src/app/<mode-name>/page.tsx` 라우트를 생성한다.
- `web/src/app/page.tsx` 랜딩페이지에 해당 모드 진입 버튼을 추가한다.

## 2. 솔리테어 코어 불변

- 솔리테어 코어의 룰은 바꾸지 않는다.
- 기존 `SolitaireState`, `Deck`, `Evaluator`, `NestedRolloutSolver` 등 `web/src/solver/` 하위 코드를 수정하지 않는다.

## 3. Scoring 인터페이스

Scoring이 필요한 모드라면 점수는 아래 룰로 제공한다:

1. **Foundation 조합 리스닝** — foundation에 카드 조합이 만들어졌는지 감지한다 (A, A-2-3-4, 6-7-8, K-Q-J-10 등). 각 모드에서 foundation 변화를 리스닝할 수 있도록 인터페이스를 제공한다.
2. **Tableau 조합 리스닝** — tableau의 각 컬럼에 대한 카드 조합이 만들어졌는지 감지한다. 각 모드에서 tableau 변화를 리스닝할 수 있도록 인터페이스를 제공한다.

## 4. 코드 격리

- 모드 종속 코드는 `web/src/game/<mode-name>/` 디렉토리에 생성한다.
- 다른 모드의 코드를 직접 수정하지 않는다.

## 5. 모드 뷰 비율

- 모드 전용 뷰가 필요한 경우 화면 비율은 PC/모바일 모두 **3:7 (모드 UI : 솔리테어)** 비율로 생성한다.
