# Bridge Pattern (React <-> Phaser)

## 문제
React와 Phaser는 서로 다른 렌더링 루프. 직접 참조 불가.
React strict mode에서 double-mount (mount → unmount → remount) 발생 → stale listener crash.

## 해결: GameBridge Singleton

```typescript
// bridge/GameBridge.ts
class GameBridge {
  private listeners = new Map<string, Set<Listener>>();

  // Direct callbacks (stale listener 방지)
  solverState: SolverSnapshot | null = null;
  showHintCallback: ((move: unknown) => void) | null = null;
  applySimMoveCallback: ((move: unknown) => void) | null = null;
  newGameCallback: ((seed?: number) => void) | null = null;

  on(event, fn): void;
  off(event, fn): void;
  emit(event, ...args): void;
  clearSceneListeners(): void;  // Phaser 측 이벤트만 제거
}

let _bridge: GameBridge | null = null;
export function getGameBridge(): GameBridge;
```

## Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `stateChanged` | Phaser → React | `GameDisplayState` |
| `gameWon` | Phaser → React | (none) |
| `newGame` | React → Phaser | `seed?: number` |
| `undo` | React → Phaser | (none) |
| `requestHintFromUI` | React → React | (none, triggers triggerHint) |
| `getState` | React → Phaser | `callback: (state) => void` |
| `simMove` | React → Phaser | `Move` |

## Direct Callback 패턴

### 왜 event가 아닌 callback?
```
// 문제: React strict mode
mount   → bridge.on('showHint', handler_v1)  // scene_v1
unmount → scene_v1 destroyed (but listener remains!)
mount   → bridge.on('showHint', handler_v2)  // scene_v2

emit('showHint') → handler_v1 실행 → scene_v1.sys.add null → CRASH
```

### Direct callback 해법
```typescript
// TableScene.create()
bridge.showHintCallback = (move) => {
  try {
    if (!this.scene?.isActive()) return;  // scene 상태 확인
    this.showHint(move as Move);
  } catch {
    // Scene partially destroyed — ignore
  }
};

// PhaserGameInner cleanup
return () => {
  bridge.showHintCallback = null;       // 즉시 null
  bridge.applySimMoveCallback = null;
  bridge.newGameCallback = null;
  bridge.clearSceneListeners();         // event listeners 제거
  game.destroy(true);
};
```

### 핵심 Guard
```typescript
// this.sys 체크만으로는 부족! (partially destroyed state에서 truthy)
if (!this.scene?.isActive()) return;  // 정확한 체크
```

## Scene → Bridge State 동기화
```typescript
// TableScene.emitState() — 매 move 후 호출
private emitState(): void {
  bridge.solverState = this.getSerializableState();  // solver용
  bridge.emit('stateChanged', displayState);          // React UI용
}
```

## clearSceneListeners()
```typescript
clearSceneListeners(): void {
  const sceneEvents = ['showHint', 'getState', 'simMove', 'newGame', 'undo'];
  for (const ev of sceneEvents) {
    this.listeners.delete(ev);
  }
}
```
React 측 이벤트 (`stateChanged`, `gameWon`, `requestHintFromUI`)는 유지.
