import Phaser from 'phaser';
import { LayoutManager } from '../rendering/LayoutManager';
import { CardRenderer } from '../rendering/CardRenderer';
import { SolitaireCore } from '../core/SolitaireCore';
import { SpriteManager } from '../sprites/SpriteManager';
import { ThemeManager } from '../rendering/ThemeManager';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import { CardSprite } from '../objects/CardSprite';
import { getGameBridge } from '../bridge/GameBridge';
import { ActionType, type Move } from '../../solver/types';
import type { PileType } from '../movement/CardMovementData';
import type { GameRecording } from '../recording/types';
import type { SerializedMove } from '../../solver/workerProtocol';

export class ReplayScene extends Phaser.Scene {
  private layout!: LayoutManager;
  private core!: SolitaireCore;
  private sprites!: SpriteManager;
  private themeManager!: ThemeManager;
  private moveRunner!: CardMovementRunner;

  private bridgeId = 'default';
  private recording: GameRecording | null = null;
  private actionIndex = 0;
  private placeholderText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'ReplayScene' });
  }

  init(data?: { bridgeId?: string }): void {
    this.bridgeId = data?.bridgeId ?? 'default';
  }

  create(): void {
    const { width, height } = this.scale;
    this.layout = new LayoutManager(width, height);

    this.core = new SolitaireCore();

    this.themeManager = new ThemeManager(this, this.layout, null as unknown as SpriteManager);
    this.themeManager.loadSaved();
    this.cameras.main.setBackgroundColor(this.themeManager.theme.tableColor);

    CardRenderer.generateTextures(this, this.layout.cardWidth, this.layout.cardHeight, this.themeManager.theme);

    this.sprites = new SpriteManager(this, this.layout, this.themeManager.theme);
    // Don't create pile zones yet — wait until a recording is loaded

    (this.themeManager as unknown as { sprites: SpriteManager }).sprites = this.sprites;

    this.moveRunner = new CardMovementRunner(this, this.layout, () => {
      this.sprites.rebuild(this.core.state);
    });

    this.core.on('moveExecuted', () => this.syncBridge());
    this.core.on('stockDrawn', () => this.syncBridge());
    this.core.on('newGame', () => this.syncBridge());
    this.core.on('gameWon', () => {
      const bridge = getGameBridge(this.bridgeId);
      bridge.emit('gameWon');
    });

    // Placeholder text
    this.placeholderText = this.add.text(width / 2, height / 2, 'Select a recording above', {
      fontSize: '24px',
      color: '#ffffff66',
      fontFamily: 'sans-serif',
    });
    this.placeholderText.setOrigin(0.5, 0.5);

    this.wireBridge();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  private syncBridge(): void {
    const bridge = getGameBridge(this.bridgeId);
    bridge.solverState = this.core.getSerializableState();
    bridge.emit('stateChanged', this.core.getDisplayState());
  }

  private wireBridge(): void {
    const bridge = getGameBridge(this.bridgeId);

    bridge.loadRecordingCallback = (recording: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.loadRecording(recording as GameRecording);
      } catch (e) { console.error('ReplayScene.loadRecording failed:', e); }
    };

    bridge.replayStepCallback = () => {
      try {
        if (!this.scene?.isActive()) return;
        this.stepForward();
      } catch (e) { console.error('ReplayScene.stepForward failed:', e); }
    };

    bridge.applyThemeCallback = (themeId: string) => {
      try {
        if (!this.scene?.isActive()) return;
        this.themeManager.apply(themeId, this.core.state);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('setTheme', (themeId: unknown) => {
      if (!this.sys) return;
      if (typeof themeId === 'string') this.themeManager.apply(themeId, this.core.state);
    });
  }

  private loadRecording(recording: GameRecording): void {
    this.recording = recording;
    this.actionIndex = 0;

    // Remove placeholder
    if (this.placeholderText) {
      this.placeholderText.destroy();
      this.placeholderText = null;
    }

    this.sprites.clearAll();
    this.sprites.tableauSprites = [[], [], [], [], [], [], []];
    this.sprites.foundationSprites = [[], [], [], []];
    this.sprites.stockSprites = [];
    this.sprites.wasteSprites = [];

    // Now create pile zones (first load or re-load)
    this.sprites.createPileZones();

    this.core.newGame(recording.seed);
    this.sprites.buildFromState(this.core.state);

    const bridge = getGameBridge(this.bridgeId);
    bridge.emit('replayLoaded', {
      totalActions: recording.actions.length,
      seed: recording.seed,
      sourceMode: recording.sourceMode,
      result: recording.result,
    });
    bridge.emit('replayProgress', { current: 0, total: recording.actions.length });
  }

  private stepForward(): void {
    if (!this.recording) return;
    if (this.actionIndex >= this.recording.actions.length) return;

    const action = this.recording.actions[this.actionIndex];
    this.actionIndex++;

    if (action.type === 'move') {
      this.applyReplayMove(action.move);
    } else if (action.type === 'stockDraw') {
      this.applyStockDraw();
    }

    const bridge = getGameBridge(this.bridgeId);
    bridge.emit('replayProgress', {
      current: this.actionIndex,
      total: this.recording.actions.length,
    });
  }

  private applyReplayMove(sm: SerializedMove): void {
    if (this.moveRunner.isAnimating) this.moveRunner.fastForward();

    const move = sm as unknown as Move;
    const at = Number(move.actionType);

    // Handle stock turns first
    if (move.stockTurns > 0) {
      this.core.applyStockTurns(move.stockTurns);
      this.sprites.rebuild(this.core.state);
    }

    // Extract sprites based on action type
    let movingSprites: CardSprite[] = [];
    let fromPile: string = 'waste';
    let fromIndex = 0;
    let toPile: 'tableau' | 'foundation' = 'tableau';
    const toIndex = move.destIdx;
    let flipSprite: CardSprite | undefined;

    if (at === ActionType.WASTE_TO_FOUNDATION || at === ActionType.WASTE_TO_TABLEAU) {
      fromPile = 'waste';
      const s = this.sprites.wasteSprites.pop();
      if (s) movingSprites = [s];
      toPile = at === ActionType.WASTE_TO_FOUNDATION ? 'foundation' : 'tableau';
    } else if (at === ActionType.TABLEAU_TO_FOUNDATION) {
      fromPile = 'tableau';
      fromIndex = move.srcIdx;
      const s = this.sprites.tableauSprites[move.srcIdx].pop();
      if (s) movingSprites = [s];
      toPile = 'foundation';
      const srcCol = this.sprites.tableauSprites[move.srcIdx];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    } else if (at === ActionType.TABLEAU_TO_TABLEAU) {
      fromPile = 'tableau';
      fromIndex = move.srcIdx;
      const srcCol = this.sprites.tableauSprites[move.srcIdx];
      const startIdx = srcCol.length - move.numCards;
      movingSprites = srcCol.splice(startIdx, move.numCards);
      toPile = 'tableau';
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    } else if (at === ActionType.FOUNDATION_TO_TABLEAU) {
      fromPile = 'foundation';
      fromIndex = move.srcIdx;
      const s = this.sprites.foundationSprites[move.srcIdx].pop();
      if (s) movingSprites = [s];
      toPile = 'tableau';
    }

    this.core.executeMove(move);

    if (movingSprites.length === 0) {
      this.sprites.rebuild(this.core.state);
      return;
    }

    const endPositions = this.sprites.computeEndPositions(toPile, toIndex, movingSprites.length, this.core.state);
    this.moveRunner.runMove(movingSprites, fromPile as PileType, fromIndex, toPile as PileType, toIndex, endPositions, flipSprite);
  }

  private applyStockDraw(): void {
    if (this.moveRunner.isAnimating) this.moveRunner.fastForward();
    this.core.drawStock();
    this.sprites.rebuild(this.core.state);
  }

  private handleResize(width: number, height: number): void {
    this.layout = new LayoutManager(width, height);
    this.moveRunner.updateLayout(this.layout);
    this.sprites.updateLayout(this.layout);
    if (this.recording) {
      this.sprites.createPileZones();
      this.sprites.reposition(this.core.state);
    }
    if (this.placeholderText) {
      this.placeholderText.setPosition(width / 2, height / 2);
    }
  }
}
