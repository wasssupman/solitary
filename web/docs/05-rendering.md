# Rendering (Phaser 3)

## Phaser Config
```typescript
{
  type: Phaser.AUTO,           // WebGL 우선, Canvas fallback
  backgroundColor: 0x35654d,   // Green felt
  scale: { mode: Phaser.Scale.RESIZE },  // 반응형
  scene: [TableScene],
}
```
`PhaserGame.tsx`에서 `dynamic(() => import('./PhaserGameInner'), { ssr: false })`로 SSR 방지.

## Card Texture (런타임 생성)
이미지 에셋 없음. `CardRenderer.generateTextures(scene, w, h)` 가 52장 + 뒷면을 RenderTexture로 생성.

### 앞면
- 흰색 rounded rect 배경
- 좌상단: rank + suit 심볼 (빨강 `#e74c3c` / 검정 `#2c3e50`)
- 중앙: 큰 suit 심볼
- 우하단: 180도 회전된 rank + suit

### 뒷면
- 진한 파란색 (`#1a3a5c`)
- 격자 패턴 overlay
- 내부 테두리

### 텍스처 키
- `card_R_S` (R=rank 1-13, S=suit 0-3)
- `card_back`

## Layout (LayoutManager)
```
┌────────────────────────────────────────────┐
│ Stock  Waste  (gap)  F0  F1  F2  F3        │  Row 0
├────────────────────────────────────────────┤
│ T0   T1   T2   T3   T4   T5   T6          │  Row 1+
│      ┊    ┊    ┊    ┊    ┊    ┊            │  (overlapping)
└────────────────────────────────────────────┘
```

### Card Size
- 너비: `canvasWidth / 7 - gap`, max 100px
- 높이: `width * 1.4`
- Column gap: `width * 0.15`

### Overlap (Tableau)
- Face-down: `height * 0.18`
- Face-up: `height * 0.25`

### Stock Count Badge
- Stock pile 우상단에 남은 카드 수 표시
- `fontSize = cardWidth * 0.22`, 검정 반투명 배경

## CardSprite
```typescript
class CardSprite extends Phaser.GameObjects.Container {
  rank: number;
  suit: number;    // _sv 값 (0-3)
  faceUp: boolean;

  flip(faceUp, animated): void;        // scaleX 애니메이션
  resizeCard(w, h): void;              // 반응형 리사이즈
}
```

## PileZone
빈 pile 위치를 나타내는 rounded rect outline (`#ffffff22`).

## AnimationManager
순차 실행 tween 큐. `isProcessing` flag로 중복 방지.
```typescript
moveCard(card, x, y, duration): Promise<void>
enqueue(fn: () => Promise<void>): void
```

## 반응형 리사이즈
`this.scale.on('resize', (gameSize) => this.handleResize(w, h))`
- LayoutManager 재계산
- 모든 CardSprite `resizeCard()` 호출
- 텍스처 재생성
